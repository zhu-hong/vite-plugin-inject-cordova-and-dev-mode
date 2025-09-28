import type { HtmlTagDescriptor, Plugin } from 'vite'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve, parse, dirname } from 'node:path'

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

  let outDir: string = ''
  let inputs: string | string[] | { [entryAlias: string]: string } = ''
  const headMatch = /([ \t]*)<head[^>]*>/i

  const injectScript = async (filepath: string) => {
    const pwd = process.cwd()
    filepath = filepath.replace(pwd + '/', '')

    const outputHtml = resolve(outDir, filepath)
    let html = String(await readFile(outputHtml))

    // 注入cordova脚本
    const injectCordova = html.replace(
      headMatch,
      (match) => `${match}
  <script src="https://inner.shell.emtob.com/cordova.js"></script>`,
    )

    await Promise.all([
      (async () => {
        // 注入前往调试页的条件动作和vconsole
        const injectDevModeConditionAndVConsole = injectCordova.replace(
          headMatch,
          (match) => `${match}
  <script>if(${devCondition}){location.href='./${parse(filepath).name}.dev.html'+location.search+location.hash}</script>`,
        )
        await writeFile(outputHtml, injectDevModeConditionAndVConsole)
      })(),
      (async () => {
        // 创建devpage
        const injectDevMode = injectCordova.replace(
          headMatch,
          (match) => `${match}
  <script src='./vconsole.min.js'></script>
  <script>_vConsole=new VConsole({onReady(){console.log(navigator.userAgent),_vConsole.show()}});</script>`,
        )
        await writeFile(resolve(outDir, dirname(filepath), `${parse(filepath).name}.dev.html`), injectDevMode)
      })(),
    ])
  }

  return [
    {
      name: 'inject-sdk',
      apply: 'build',
      enforce: 'post',
      configResolved: (cfg) => {
        outDir = cfg.build.outDir
        inputs = cfg.build.rollupOptions.input ?? resolve(process.cwd(), 'index.html')
      },
      writeBundle: async () => {
        if (typeof inputs === 'string') {
          await injectScript(inputs)
        } else if (inputs instanceof Array) {
          await Promise.all((inputs as string[]).map(async (output) => await injectScript(output)))
        } else {
          await Promise.all(Object.values(inputs).map(async (output) => await injectScript(output)))
        }
      },
    },
    {
      name: 'inject-sdk-on-dev',
      apply: 'serve',
      transformIndexHtml: {
        handler: (html) => {
          const tags: HtmlTagDescriptor[] = []

          if (devInject) {
            tags.push({
              tag: 'script',
              injectTo: 'head-prepend',
              attrs: {
                'src': 'https://inner.shell.emtob.com/cordova.js',
              },
            })
          }

          return {
            html,
            tags,
          }
        },
      },
    },
  ]
}
