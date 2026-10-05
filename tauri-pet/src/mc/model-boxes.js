import { readFile } from 'block-model-renderer'
import { getAssets } from './assets.js'
import { bareId } from './ids.js'
import { boxesFromState, chooseModelSpecs, modelFilePath } from './model-shape.js'

export { boxesFromElements, boxesFromState, collectElements, chooseModelSpecs, modelFilePath } from './model-shape.js'

const cache = new Map()
const pending = new Map()
const modelCache = new Map()

function decodeJson(bytes) {
  if (!bytes) {
    return null
  }
  try {
    const text = typeof bytes === 'string' ? bytes : new TextDecoder().decode(bytes)
    return JSON.parse(text)
  } catch {
    return null
  }
}

function cacheKey(id, properties) {
  const name = bareId(id)
  const props = properties ?? {}
  const keys = Object.keys(props).sort()
  return `${name}|${keys.map((key) => `${key}=${props[key]}`).join(',')}`
}

function readCachedModel(name) {
  return modelCache.get(String(name ?? '').replace(/^minecraft:/, '')) ?? null
}

async function loadModelJson(name) {
  const id = String(name ?? '').replace(/^minecraft:/, '')
  if (!id) {
    return null
  }
  if (modelCache.has(id)) {
    return modelCache.get(id)
  }
  const assets = await getAssets()
  const json = decodeJson(await readFile(modelFilePath(id), assets))
  modelCache.set(id, json)
  if (json?.parent) {
    await loadModelJson(json.parent)
  }
  return json
}

export function cachedModelBoxes(id, properties) {
  const key = cacheKey(id, properties)
  if (!cache.has(key)) {
    return undefined
  }
  return cache.get(key)
}

export async function primeModelBoxes(id, properties = {}) {
  const name = bareId(id)
  if (!name) {
    return []
  }
  const key = cacheKey(name, properties)
  if (cache.has(key)) {
    return cache.get(key)
  }
  if (pending.has(key)) {
    return pending.get(key)
  }
  const work = (async () => {
    try {
      const assets = await getAssets()
      const state = decodeJson(await readFile(`assets/minecraft/blockstates/${name}.json`, assets))
      if (!state) {
        cache.set(key, null)
        return null
      }
      const specs = chooseModelSpecs(state, properties)
      for (const spec of specs) {
        await loadModelJson(spec.model)
      }
      const boxes = boxesFromState(state, properties, readCachedModel)
      cache.set(key, boxes)
      return boxes
    } catch (error) {
      console.error(error)
      cache.set(key, null)
      return null
    } finally {
      pending.delete(key)
    }
  })()
  pending.set(key, work)
  return work
}
