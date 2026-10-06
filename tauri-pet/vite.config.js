import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import { buildPackIndex } from './scripts/pack-index.mjs'

const root = path.dirname(fileURLToPath(import.meta.url))
const packRoot = path.resolve(root, '../assets')
const bmrZip = path.resolve(root, 'node_modules/block-model-renderer/assets.zip')

function inside(rootDir, file) {
  const base = path.resolve(rootDir)
  const target = path.resolve(file)
  return target === base || target.startsWith(base + path.sep)
}

function contentType(file) {
  if (file.endsWith('.png')) {
    return 'image/png'
  }
  if (file.endsWith('.json') || file.endsWith('.mcmeta')) {
    return 'application/json'
  }
  if (file.endsWith('.zip')) {
    return 'application/zip'
  }
  return 'application/octet-stream'
}

function onDisk(dir) {
  const clean = String(dir ?? '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  if (!clean || clean === 'assets') {
    return packRoot
  }
  if (clean.startsWith('assets/')) {
    return path.resolve(packRoot, clean.slice('assets/'.length))
  }
  return path.resolve(packRoot, clean)
}

function resourcePack() {
  const serve = (middlewares) => {
    middlewares.use((request, response, next) => {
      const url = request.url.split('?')[0]
      if (url === '/bmr-assets.zip') {
        if (!fs.existsSync(bmrZip)) {
          next()
          return
        }
        response.setHeader('Content-Type', 'application/zip')
        fs.createReadStream(bmrZip).pipe(response)
        return
      }
      if (url === '/resource-pack/__list') {
        const query = new URL(request.url, 'http://localhost').searchParams.get('dir') ?? ''
        const dir = onDisk(query)
        if (!inside(packRoot, dir) || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
          response.setHeader('Content-Type', 'application/json')
          response.end('[]')
          return
        }
        const names = fs.readdirSync(dir)
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify(names))
        return
      }
      if (!url.startsWith('/resource-pack/')) {
        next()
        return
      }
      const relative = decodeURIComponent(url.slice('/resource-pack/'.length))
      const file = path.resolve(packRoot, relative)
      if (!inside(packRoot, file) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        next()
        return
      }
      response.setHeader('Content-Type', contentType(file))
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
    closeBundle() {
      const outDir = path.resolve(root, 'dist')
      const dest = path.join(outDir, 'resource-pack')
      fs.mkdirSync(dest, { recursive: true })
      fs.cpSync(packRoot, dest, { recursive: true })
      fs.writeFileSync(
        path.join(dest, '__index.json'),
        JSON.stringify(buildPackIndex(packRoot)),
      )
      if (fs.existsSync(bmrZip)) {
        fs.copyFileSync(bmrZip, path.join(outDir, 'bmr-assets.zip'))
      }
    },
  }
}

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
