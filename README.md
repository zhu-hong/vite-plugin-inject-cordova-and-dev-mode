# vite-plugin-inject-cordova-and-dev-mode

## Feature

+ 打包时自动生成一个和输出html一样的带用VConsole的页面，打开输出html时，检测到条件符合配置的condition时，自动跳到带有VConsole的页面（便于调试）

+ 自动注入cordova需要的`meta`和`script`

## Usage

安装

```sh
pnpm add vite-plugin-inject-cordova-and-dev-mode -D
```

添加到你的 `rollup.config.js`

```js
import { injectCordovaAndDevModePlugin } from 'vite-plugin-inject-cordova-and-dev-mode'

export default defineConfig({
  plugins: [
    injectCordovaAndDevModePlugin(),
  ],
})
```

## Configuration

```ts
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
```
