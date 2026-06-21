import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { readFileSync } from 'fs'

const { version } = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))

export default defineConfig({
  main: {
    entry: 'src/main/index.ts',
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist-electron/main',
      rollupOptions: { external: ['better-sqlite3', 'serialport'] },
    },
    resolve: {
      alias: { '@andiko/shared': resolve('../../packages/shared/src/index.ts') },
    },
  },
  preload: {
    input: 'src/preload/index.ts',
    plugins: [externalizeDepsPlugin()],
    build: { outDir: 'dist-electron/preload' },
  },
  renderer: {
    root: 'src/renderer',
    plugins: [react()],
    build: { outDir: 'dist-electron/renderer' },
    define: {
      __APP_VERSION__: JSON.stringify(version),
    },
    resolve: {
      alias: {
        '@andiko/shared': resolve('../../packages/shared/src/index.ts'),
        '@andiko/ui': resolve('../../packages/ui/src/index.ts'),
        '@': resolve('./src/renderer'),
      },
    },
  },
})
