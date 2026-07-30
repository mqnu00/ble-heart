import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    electron([
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron'
          }
        }
      },
      {
        entry: 'electron/main.ts',
        onstart(args) {
          // Unset ELECTRON_RUN_AS_NODE — if set, Electron behaves as pure Node.js
          // (no browser process), breaking require('electron').
          args.startup(['.', '--no-sandbox'], { env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined } })
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: [
                'koffi',
                'electron-store',
                'electron',
                'child_process',
                'fs',
                'path',
                'os',
                'crypto',
                'events'
              ]
            }
          }
        }
      }
    ]),
    renderer()
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@/styles/variables.scss" as *;\n`
      }
    }
  }
})
