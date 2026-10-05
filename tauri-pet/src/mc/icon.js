import { DISPLAYS, readFile, renderBlock, renderItem, renderModel } from 'block-model-renderer'
import { blockExists, getAssets, MC_VERSION, PLAINS } from './assets.js'
import { bareId } from './ids.js'
import {
  DEFAULT_LEATHER_COLOR,
  isEntityItem,
  isGeneratedItem,
  isLeatherArmor,
  isLilyPad,
  LILY_PAD_ITEM_COLOR,
} from './item-shape.js'
import { composeBannerTexture } from './banner-composer.js'
import { bedColorOf, renderBedIcon } from './bed-composer.js'
import { isSpawnEgg, paintSpawnEgg } from './spawn-egg.js'

export const ICON_SIZE = 16
export const PACK_ICON_INSET = 1
export const CREATIVE_ICON_INSET = 0

export function drawGuiIcon(ctx, icon, slotX, slotY, scale, inset = PACK_ICON_INSET) {
  if (!icon) {
    return
  }
  ctx.drawImage(
    icon,
    (slotX + inset) * scale,
    (slotY + inset) * scale,
    ICON_SIZE * scale,
    ICON_SIZE * scale,
  )
}

const ITEM_DISPLAY = {
  type: 'fallback',
  display: 'gui',
  generated: false,
}

const POT_GUI = {
  rotation: [30, 45, 0],
  translation: [0, -3, 0],
  scale: [0.5, 0.5, 0.5],
}

const CONDUIT_GUI = {
  rotation: [30, 45, 0],
  translation: [0, 0, 0],
  scale: [1, 1, 1],
}

const BLOCK_DISPLAY = {
  ...DISPLAYS.block,
  rotateFlat: true,
}

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

const ICON_CACHE = new Map()
const ICON_JOBS = new Map()

function unwrapRender(result) {
  if (!result) {
    return null
  }
  if (Array.isArray(result)) {
    return unwrapRender(result[0])
  }
  if (result.canvas && result.canvas !== result) {
    return result.canvas
  }
  return result
}

function usableImage(image) {
  const source = unwrapRender(image)
  if (!source || !source.width) {
    return null
  }
  if (typeof document === 'undefined' || source instanceof Image) {
    return source
  }
  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(source, 0, 0)
  return canvas
}

function hasPixels(image) {
  if (!image || !image.width) {
    return false
  }
  if (typeof document === 'undefined' || image instanceof Image) {
    return true
  }
  const ctx = image.getContext?.('2d')
  if (!ctx) {
    return true
  }
  const { data } = ctx.getImageData(0, 0, image.width, image.height)
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 8) {
      return true
    }
  }
  return false
}

function loadPng(url) {
  return new Promise((resolve) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(usableImage(image))
    image.onerror = () => resolve(null)
    image.src = url
  })
}

let itemPngs = null

async function listedItemPngs() {
  if (itemPngs) {
    return itemPngs
  }
  try {
    const response = await fetch('/resource-pack/__list?dir=assets/minecraft/textures/item')
    const list = await response.json()
    itemPngs = new Set(Array.isArray(list) ? list : [])
  } catch {
    itemPngs = new Set()
  }
  return itemPngs
}

export async function readItemModel(id) {
  const name = bareId(id)
  if (!name) {
    return null
  }
  const assets = await getAssets()
  return decodeJson(await readFile(`assets/minecraft/models/item/${name}.json`, assets))
}

function tintImage(image, color) {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, 0, 0)
  if (color == null) {
    return canvas
  }
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const r = (color >> 16) & 255
  const g = (color >> 8) & 255
  const b = color & 255
  const data = pixels.data
  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i] * r / 255
    data[i + 1] = data[i + 1] * g / 255
    data[i + 2] = data[i + 2] * b / 255
  }
  ctx.putImageData(pixels, 0, 0)
  return canvas
}

async function paintLayers(size, layers) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  for (const layer of layers) {
    const image = await loadPng(layer.url)
    if (!image) {
      return null
    }
    ctx.drawImage(layer.color == null ? image : tintImage(image, layer.color), 0, 0, size, size)
  }
  return canvas
}

async function paintLilyPad(size) {
  return paintLayers(size, [{
    url: '/resource-pack/minecraft/textures/block/lily_pad.png',
    color: LILY_PAD_ITEM_COLOR,
  }])
}

async function paintLeather(name, size) {
  const layers = [{
    url: `/resource-pack/minecraft/textures/item/${name}.png`,
    color: DEFAULT_LEATHER_COLOR,
  }]
  if (name !== 'leather_horse_armor') {
    layers.push({
      url: `/resource-pack/minecraft/textures/item/${name}_overlay.png`,
      color: null,
    })
  }
  return paintLayers(size, layers)
}

async function paintSprite(name, model) {
  const files = await listedItemPngs()
  if (files.has(`${name}.png`)) {
    return loadPng(`/resource-pack/minecraft/textures/item/${name}.png`)
  }
  if (files.has(`${name}_00.png`)) {
    return loadPng(`/resource-pack/minecraft/textures/item/${name}_00.png`)
  }
  if (isGeneratedItem(model)) {
    const layer = String(model?.textures?.layer0 ?? '').replace(/^minecraft:/, '')
    if (layer) {
      return loadPng(`/resource-pack/minecraft/textures/${layer}.png`)
    }
  }
  return null
}

function bannerColor(name) {
  return name === 'banner' ? 'white' : name.slice(0, -'_banner'.length)
}

async function paintModel(assets, size, model, display) {
  return usableImage(await renderModel({
    model,
    assets,
    width: size,
    height: size,
    version: MC_VERSION,
    lighting: 'item',
    display,
    ignoreAtlases: true,
  }))
}

async function paintBed(name, assets, size) {
  return usableImage(await renderBedIcon(assets, bedColorOf(name), size))
}

async function paintBanner(name, assets, size) {
  const cloth = await composeBannerTexture(bannerColor(name))
  return paintModel(assets, size, {
    model: 'block-model-renderer:block/banner/_template_banner',
    texture_images: cloth ? { 'entity/banner/base': cloth } : undefined,
  }, 'gui')
}

async function paintPot(assets, size) {
  return paintModel(assets, size, 'block-model-renderer:block/decorated_pot', POT_GUI)
}

async function paintConduit(assets, size) {
  return paintModel(assets, size, 'block-model-renderer:block/conduit', CONDUIT_GUI)
}

async function paintItem(name, assets, size, display = ITEM_DISPLAY) {
  return usableImage(await renderItem({
    id: name,
    assets,
    width: size,
    height: size,
    version: MC_VERSION,
    lighting: 'item',
    display,
    ignoreAtlases: true,
  }))
}

async function paintBlock(name, assets, size, extra = {}) {
  return usableImage(await renderBlock({
    id: name,
    assets,
    width: size,
    height: size,
    version: MC_VERSION,
    biome: PLAINS,
    defaults: 'game',
    lighting: 'item',
    display: BLOCK_DISPLAY,
    ...extra,
  }))
}

async function renderGuiIconUncached(name, size) {
  if (isSpawnEgg(name)) {
    const egg = await paintSpawnEgg(name, size)
    if (egg) {
      return egg
    }
  }
  if (isLilyPad(name)) {
    const pad = await paintLilyPad(size)
    if (pad) {
      return pad
    }
  }
  if (isLeatherArmor(name)) {
    const leather = await paintLeather(name, size)
    if (leather) {
      return leather
    }
  }
  const model = await readItemModel(name)
  if (name.endsWith('_bed') || name === 'bed' || name.endsWith('_banner') || name === 'banner' || name === 'decorated_pot' || name === 'conduit') {
    const assets = await getAssets()
    try {
      if (name.endsWith('_bed') || name === 'bed') {
        return await paintBed(name, assets, size)
      }
      if (name.endsWith('_banner') || name === 'banner') {
        return await paintBanner(name, assets, size)
      }
      if (name === 'decorated_pot') {
        return await paintPot(assets, size)
      }
      return await paintConduit(assets, size)
    } catch (error) {
      console.error(error)
      return null
    }
  }
  if (isEntityItem(model)) {
    const assets = await getAssets()
    if (await blockExists(name)) {
      try {
        const block = await paintBlock(name, assets, size, { ignoreAtlases: true })
        if (hasPixels(block)) {
          return block
        }
      } catch (error) {
        console.error(error)
      }
    }
    try {
      const item = await paintItem(name, assets, size, ITEM_DISPLAY)
      if (hasPixels(item)) {
        return item
      }
    } catch (error) {
      console.error(error)
    }
    return null
  }
  const sprite = await paintSprite(name, model)
  if (sprite) {
    return sprite
  }
  const assets = await getAssets()
  if (await blockExists(name)) {
    try {
      const image = await paintBlock(name, assets, size)
      if (image) {
        return image
      }
    } catch (error) {
      console.error(error)
    }
  }
  try {
    return await paintItem(name, assets, size)
  } catch (error) {
    console.error(error)
    return null
  }
}

export async function renderGuiIcon(id, size = 32) {
  const name = bareId(id)
  if (!name) {
    return null
  }
  const key = `${name}@${size}`
  if (ICON_CACHE.has(key)) {
    return ICON_CACHE.get(key)
  }
  if (ICON_JOBS.has(key)) {
    return ICON_JOBS.get(key)
  }
  const job = renderGuiIconUncached(name, size).then((image) => {
    ICON_CACHE.set(key, image)
    ICON_JOBS.delete(key)
    return image
  }, (error) => {
    ICON_JOBS.delete(key)
    throw error
  })
  ICON_JOBS.set(key, job)
  return job
}
