import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'

const packRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets')

function resourcePack() {
  const serve = (middlewares) => {
    middlewares.use('/resource-pack', (request, response, next) => {
      const relative = decodeURIComponent(request.url.split('?')[0]).replace(/^\/+/, '')
      const file = path.resolve(packRoot, relative)
      if (!file.startsWith(packRoot) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        next()
        return
      }
      response.setHeader('Content-Type', file.endsWith('.png') ? 'image/png' : 'application/json')
      fs.createReadStream(file).pipe(response)
    })
  }
  return {
    name: 'resource-pack',
    configureServer(server) {
      serve(server.middlewares)
    },
    configurePreviewServer(server) {
      serve(server.middlewares)
    },
  }
}

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  clearScreen: false,
  plugins: [resourcePack()],
  resolve: {
    alias: {
      three: path.resolve(root, 'node_modules/three'),
    },
    dedupe: ['three'],
  },
  optimizeDeps: {
    exclude: ['block-model-renderer'],
  },
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: 'es2022',
    minify: false,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: path.resolve(root, 'index.html'),
        menu: path.resolve(root, 'menu.html'),
      },
    },
  },
})
