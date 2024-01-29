import type { Plugin } from 'vite'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve, parse } from 'node:path'

interface IPluginConfig {
  /**
   * @default localStorage.getItem("debug")
   * @description 开启devmode的条件
   */
  devCondition?: string;
  /**
   * @default false
   * @description 是否在开发模式注入cordova脚本
   */
  devInject?: boolean;
}

export const injectCordovaAndDevModePlugin: (config?: IPluginConfig) => Plugin[] = (config = {}) => {
  const { devCondition = 'localStorage.getItem("debug")', devInject = false } = config

  const CSPContent = `default-src 'self' 'unsafe-eval';
  script-src 'self' https://inner.shell.emtob.com 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: content:;
  font-src 'self' data: content:;
  media-src *;
  blob-src *;
  connect-src *;`

  let outDir: string = ''
  let intputs: string | string[] | { [entryAlias: string]: string } = ''
  const headMatch = /([ \t]*)<head[^>]*>/i

  const injectScript = async (filepath: string) => {
    let html = String(await readFile(resolve(outDir, `${parse(filepath).name}.html`)))

    // 注入cordova脚本
    const injectCordova = html.replace(
      headMatch,
      (match) => `${match}
  <meta http-equiv="Content-Security-Policy" content="${CSPContent}">
  <script src="https://inner.shell.emtob.com/cordova.js"></script>
  <script>IN_CORDOVA=!!window._cordovaNative;</script>`,
    )

    // 注入前往调试页的条件动作
    const injectDevModeCondition = injectCordova.replace(
      headMatch,
      (match) => `${match}
  <script>if(${devCondition}){location.href="./${parse(filepath).name}.dev.html"+location.search+location.hash};</script>`,
    )
    await writeFile(resolve(outDir, `${parse(filepath).name}.html`), injectDevModeCondition)

    // 创建devpage注入vconsole
    const injectDevMode = injectCordova.replace(
      headMatch,
      (match) => `${match}
  <script src="./vconsole.min.js"></script>
  <script>vConsole=new VConsole({onReady(){vConsole.show()}});console.log(navigator.userAgent);</script>`,
    )
    await writeFile(resolve(outDir, `${parse(filepath).name}.dev.html`), injectDevMode)
  }

  return [
    {
      name: 'inject-cordova-dev-mode',
      apply: 'build',
      enforce: 'post',
      configResolved: (cfg) => {
        outDir = cfg.build.outDir
        intputs = cfg.build.rollupOptions.input ?? resolve(outDir, 'index.html')
      },
      closeBundle: async () => {
        if(typeof intputs === 'string') {
          await injectScript(intputs)
        } else if(intputs instanceof Array) {
          await Promise.all((intputs as string[]).map(async (output) => await injectScript(output)))
        } else {
          await Promise.all(Object.values(intputs).map(async (output) => await injectScript(output)))
        }
      },
    },
    {
      name: 'inject-cordova-dev-mode-when-serve',
      apply: 'serve',
      transformIndexHtml: {
        handler: (html) => {
          return {
            html,
            tags: devInject ? [
              {
                tag: 'script',
                injectTo: 'head',
                children: 'IN_CORDOVA=!!window.cordova',
              },
              {
                tag: 'meta',
                injectTo: 'head-prepend',
                attrs: {
                  'http-equiv': 'Content-Security-Policy',
                  'content': CSPContent,
                },
              },
              {
                tag: 'script',
                injectTo: 'head-prepend',
                attrs: {
                  'src': 'https://inner.shell.emtob.com/cordova.js',
                },
              }
            ] : [
              {
                tag: 'script',
                injectTo: 'head',
                children: 'IN_CORDOVA=!!window._cordovaNative',
              },
            ],
          }
        },
        order: 'post',
      },
    },
  ]
}
