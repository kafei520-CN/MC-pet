import colors from './data/spawn-egg-colors-1.20.1.json'
import { bareId } from './ids.js'

function loadPng(url) {
  return new Promise((resolve) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image.width > 0 ? image : null)
    image.onerror = () => resolve(null)
    image.src = url
  })
}

function tint(image, color) {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, 0, 0)
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

let baseEgg = null
let overlayEgg = null

async function eggLayers() {
  if (!baseEgg) {
    baseEgg = loadPng('/resource-pack/minecraft/textures/item/spawn_egg.png')
  }
  if (!overlayEgg) {
    overlayEgg = loadPng('/resource-pack/minecraft/textures/item/spawn_egg_overlay.png')
  }
  const [base, overlay] = await Promise.all([baseEgg, overlayEgg])
  return { base, overlay }
}

export function isSpawnEgg(id) {
  return bareId(id).endsWith('_spawn_egg')
}

export function eggType(id) {
  const name = bareId(id)
  return name.endsWith('_spawn_egg') ? name.slice(0, -'_spawn_egg'.length) : ''
}

export async function paintSpawnEgg(id, size = 32) {
  const name = bareId(id)
  const tinted = colors[name]
  if (!tinted) {
    return null
  }
  const { base, overlay } = await eggLayers()
  if (!base || !overlay) {
    return null
  }
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(tint(base, tinted.bg), 0, 0, size, size)
  ctx.drawImage(tint(overlay, tinted.fg), 0, 0, size, size)
  return canvas
}
