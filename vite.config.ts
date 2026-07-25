import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

const packageJson = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'),
) as { version: string }

/**
 * ORT loads its WASM glue via dynamic import(wasmPaths + '*.mjs').
 * In Vite dev, those imports get a `?import` query and then hit the transform
 * pipeline, which refuses to process files under /public. Strip the query so
 * the static middleware serves them as plain ES modules (prod is unaffected).
 */
function servePublicOrtModules(): Plugin {
  return {
    name: 'serve-public-ort-modules',
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        const url = request.url
        if (!url) {
          next()
          return
        }
        const queryStart = url.indexOf('?')
        if (queryStart === -1) {
          next()
          return
        }
        const pathname = url.slice(0, queryStart)
        if (!pathname.startsWith('/ort/') || !pathname.endsWith('.mjs')) {
          next()
          return
        }
        const params = new URLSearchParams(url.slice(queryStart + 1))
        if (!params.has('import')) {
          next()
          return
        }
        params.delete('import')
        const remaining = params.toString()
        request.url = remaining ? `${pathname}?${remaining}` : pathname
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages project sites need "/<repo>/"; set BASE_PATH in CI (see deploy-pages.yml).
  base: process.env.BASE_PATH || '/',
  plugins: [vue(), servePublicOrtModules()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  assetsInclude: ['**/*.wasm'],
  optimizeDeps: {
    // Both ship their own dynamic wasm/worker loading that Vite's dev-time
    // import transform breaks (works fine in the production build).
    exclude: ['@paddleocr/paddleocr-js', 'onnxruntime-web'],
    // Excluding paddleocr-js above stops Vite from crawling into its CJS
    // deps, so force those to still get the CJS→ESM interop shim.
    include: ['clipper-lib', 'js-yaml', '@techstark/opencv-js'],
  },
})
