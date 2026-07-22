import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const packageJson = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'),
) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages project sites need "/<repo>/"; set BASE_PATH in CI (see deploy-pages.yml).
  base: process.env.BASE_PATH || '/',
  plugins: [vue()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  optimizeDeps: {
    exclude: ['tesseract-wasm'],
  },
  assetsInclude: ['**/*.wasm'],
})
