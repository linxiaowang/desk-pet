import path from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'

const rendererSrc = path.resolve('src/renderer/src')

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': path.resolve('src/shared'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': path.resolve('src/shared'),
      },
    },
  },
  renderer: {
    resolve: {
      alias: {
        '~/': `${rendererSrc}/`,
        '@shared': path.resolve('src/shared'),
      },
    },
    plugins: [
      vue({
        script: {
          propsDestructure: true,
          defineModel: true,
        },
      }),
      AutoImport({
        imports: ['vue', '@vueuse/core'],
        vueTemplate: true,
      }),
      UnoCSS(),
    ],
  },
})
