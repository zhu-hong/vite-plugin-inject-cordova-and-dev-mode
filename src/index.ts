import type { HtmlTagDescriptor, Plugin } from 'vite'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve, parse, dirname } from 'node:path'

interface IPluginConfig {
  injectSdkWhenDev?: boolean
  jumpDevpageCondition?: string
  injectResetcss?: boolean
}

type PluginType = (config?: IPluginConfig) => Plugin[]

export const injectUsefulPlugin: PluginType = (config) => {
  const { jumpDevpageCondition = `localStorage.getItem('devmode')`, injectSdkWhenDev = false, injectResetcss = true } = config ?? {}

  let outDir: string = ''
  let inputs: string | string[] | { [entryAlias: string]: string } = ''

  const resetcss = `@font-face{font-family:emoji;src:local(Apple Color Emoji),local(Segoe UI Emoji),local(Segoe UI Symbol),local(Noto Color Emoji);unicode-range:U+1F000-1F644,U+203C-3299}.fontserif{font-family:Georgia,Cambria,Times New Roman,Times,serif}.fontmono{font-family:Menlo,Monaco,Consolas,Liberation Mono,Courier New,monospace}*,:after,:before{-webkit-tap-highlight-color:transparent;box-sizing:border-box;--un-rotate:0;--un-rotate-x:0;--un-rotate-y:0;--un-rotate-z:0;--un-scale-x:1;--un-scale-y:1;--un-scale-z:1;--un-skew-x:0;--un-skew-y:0;--un-translate-x:0;--un-translate-y:0;--un-translate-z:0;--un-ring-offset-shadow:0 0 #0000;--un-ring-shadow:0 0 #0000;--un-shadow-inset: ;--un-shadow:0 0 #0000;--un-ring-inset: ;--un-ring-offset-width:0px;--un-ring-offset-color:#fff;--un-ring-width:0px;--un-ring-color:#93c5fd80;border:0 solid #cecece}html{text-size-adjust:100%;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;tab-size:4;font-family:system-ui,—apple-system,Segoe UI,Roboto,emoji,Helvetica,Arial,sans-serif;line-height:1.5}body{line-height:inherit;margin:0}hr{color:inherit;border-top-width:1px;height:0}abbr:where([title]){text-decoration:underline dotted}h1,h2,h3,h4,h5,h6{font-size:inherit;font-weight:inherit}a{color:inherit;text-decoration:inherit}b,strong{font-weight:bolder}code,kbd,pre,samp{font-family:Menlo,Monaco,Consolas,Liberation Mono,Courier New,monospace;font-size:1em}small{font-size:80%}sub,sup{vertical-align:baseline;font-size:75%;line-height:0;position:relative}sub{bottom:-.25em}sup{top:-.5em}table{border-collapse:collapse;border-color:inherit;text-indent:0}button,input,optgroup,select,textarea{color:inherit;font-feature-settings:inherit;font-variation-settings:inherit;font-family:inherit;font-size:100%;font-weight:inherit;line-height:inherit;margin:0;padding:0}button,select{text-transform:none}[type=button],[type=reset],[type=submit],button{-webkit-appearance:button;background-image:none}:-moz-focusring{outline:auto}:-moz-ui-invalid{box-shadow:none}progress{vertical-align:baseline}::-webkit-inner-spin-button{height:auto}::-webkit-outer-spin-button{height:auto}[type=search]{-webkit-appearance:textfield;outline-offset:-2px}::-webkit-search-decoration{-webkit-appearance:none}::-webkit-file-upload-button{-webkit-appearance:button;font:inherit}summary{display:list-item}blockquote,dd,dl,fieldset,figure,h1,h2,h3,h4,h5,h6,hr,p,pre{margin:0}fieldset,legend{padding:0}menu,ol,ul{margin:0;padding:0;list-style:none}textarea{resize:vertical}input::placeholder,textarea::placeholder{color:#cecece;opacity:1}[role=button],button{cursor:pointer}:disabled{cursor:default}audio,canvas,embed,iframe,img,object,svg,video{vertical-align:middle;display:block}img,video{max-width:100%;height:auto}body,html{min-height:100vh;position:relative}`

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
  <script src='https://inner.shell.emtob.com/cordova.js'></script>${injectResetcss ? `\n\t<style data-tag='reset-css'>${resetcss}</style>` : ''}`
    )

    // 注入前往调试页的条件动作和vconsole
    const injectDevModeConditionAndVConsole = injectCordova.replace(
      headMatch,
      (match) => `${match}
  <script>if(${jumpDevpageCondition}){location.href='./${parse(filepath).name}.dev.html'+location.search+location.hash}</script>
  <script src='./vconsole.min.js'></script>`,
    )
    await writeFile(outputHtml, injectDevModeConditionAndVConsole)

    // 创建devpage
    const injectDevMode = injectCordova.replace(
      headMatch,
      (match) => `${match}
  <script src='./vconsole.min.js'></script>
  <script>_vConsole=new VConsole({onReady(){console.log(navigator.userAgent),_vConsole.show()}});</script>`,
    )
    await writeFile(resolve(outDir, dirname(filepath), `${parse(filepath).name}.dev.html`), injectDevMode)
  }

  return [
    {
      name: 'inject-useful',
      apply: 'build',
      enforce: 'post',
      configResolved: (cfg) => {
        outDir = cfg.build.outDir
        inputs = cfg.build.rollupOptions.input ?? resolve(process.cwd(), 'index.html')
      },
      writeBundle: async () => {
        console.log('⚙️ 打包完成现在注入SDK等文件')

        if (typeof inputs === 'string') {
          await injectScript(inputs)
        } else if (inputs instanceof Array) {
          await Promise.all((inputs as string[]).map(async (output) => await injectScript(output)))
        } else {
          await Promise.all(Object.values(inputs).map(async (output) => await injectScript(output)))
        }

        console.log('✅ 打包完成注入SDK等文件完成')
      },
    },
    {
      name: 'inject-useful-on-dev',
      apply: 'serve',
      enforce: 'pre',
      transformIndexHtml: {
        handler: (html) => {
          const tags: HtmlTagDescriptor[] = [
            {
              tag: 'script',
              injectTo: 'head-prepend',
              attrs: {
                'src': './vconsole.min.js',
              },
            },
          ]
          if (injectSdkWhenDev) {
            tags.push({
              tag: 'script',
              injectTo: 'head-prepend',
              attrs: {
                'src': 'https://inner.shell.emtob.com/cordova.js',
              },
            })
          }
          if (injectResetcss) {
            tags.push({
              tag: 'style',
              injectTo: 'head',
              attrs: {
                'data-tag': 'reset-css',
              },
              children: resetcss,
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
