import { defineConfig } from 'rollup'
import commonjs from '@rollup/plugin-commonjs'
import nodeResolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import dts from 'rollup-plugin-dts'

export default [
  defineConfig({
    input: 'src/index.ts',
    external: ['fs', 'path'],
    plugins: [
      commonjs(),
      nodeResolve(),
      typescript(),
    ],
    output: {
      dir: 'dist',
      format: 'esm',
      sourcemap: false,
    },
  }),
  defineConfig({
    input: 'src/index.ts',
    plugins: [
      dts(),
    ],
    output: {
      dir: 'dist',
      format: 'esm',
    },
  }),
]
