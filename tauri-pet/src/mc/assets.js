import * as THREE from 'three'
import { configure, prepareAssets, readFile } from 'block-model-renderer'
import { bareId } from './ids.js'
import { listPack } from './pack-list.js'

const PACK_META = JSON.stringify({
  pack: {
    pack_format: 15,
    description: 'MC-pet vanilla',
  },
})

const MC_VERSION = '1.20.4'

function packUrl(filePath) {
  const clean = filePath.replace(/\\/g, '/').replace(/^\/+/, '')
  if (clean === 'pack.mcmeta') {
    return null
  }
  if (clean.startsWith('assets/')) {
    return `/resource-pack/${clean.slice('assets/'.length)}`
  }
  return `/resource-pack/${clean}`
}

function makeHandler() {
  const fileCache = new Map()
  const listCache = new Map()
  return {
    async read(filePath) {
      const clean = String(filePath).replace(/\\/g, '/').replace(/^\/+/, '')
      if (clean === 'pack.mcmeta') {
        return PACK_META
      }
      if (fileCache.has(clean)) {
        return fileCache.get(clean)
      }
      const url = packUrl(clean)
      if (!url) {
        return null
      }
      try {
        const response = await fetch(url)
        if (!response.ok) {
          fileCache.set(clean, null)
          return null
        }
        const bytes = new Uint8Array(await response.arrayBuffer())
        fileCache.set(clean, bytes)
        return bytes
      } catch {
        fileCache.set(clean, null)
        return null
      }
    },
    async list(dir) {
      const clean = String(dir ?? '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
      if (listCache.has(clean)) {
        return listCache.get(clean)
      }
      if (!clean) {
        const names = ['assets', 'pack.mcmeta']
        listCache.set(clean, names)
        return names
      }
      const list = await listPack(clean)
      listCache.set(clean, list)
      return list
    },
  }
}

let prepared = null
let preparing = null

export async function getAssets() {
  if (prepared) {
    return prepared
  }
  if (preparing) {
    return preparing
  }
  configure({
    THREE,
    assetsUrl: '/bmr-assets.zip',
  })
  preparing = prepareAssets(makeHandler(), {
    cache: true,
    version: MC_VERSION,
    defaults: 'game',
  }).then((assets) => {
    prepared = assets
    preparing = null
    return assets
  }).catch((error) => {
    preparing = null
    throw error
  })
  return preparing
}

export async function blockExists(id) {
  const name = bareId(id)
  if (!name) {
    return false
  }
  const assets = await getAssets()
  const file = await readFile(`assets/minecraft/blockstates/${name}.json`, assets)
  return Boolean(file)
}

export async function itemExists(id) {
  const name = bareId(id)
  if (!name) {
    return false
  }
  const assets = await getAssets()
  const asItem = await readFile(`assets/minecraft/models/item/${name}.json`, assets)
  if (asItem) {
    return true
  }
  return blockExists(name)
}

export const PLAINS = {
  temperature: 0.8,
  downfall: 0.4,
  tint: '#91BD59',
}
export { MC_VERSION }
