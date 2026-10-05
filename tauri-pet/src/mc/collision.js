import { fluidBox } from './fluids.js'
import {
  bareId,
  hasNoCollision,
  isBed,
  isCarpet,
  isChest,
  isDoor,
  isFence,
  isFenceGate,
  isFluid,
  isPane,
  isSlab,
  isStairs,
  isTorch,
  isTrapdoor,
  isWall,
} from './ids.js'
import { cachedModelBoxes, primeModelBoxes } from './model-boxes.js'

function box(minX, minY, minZ, maxX, maxY, maxZ) {
  return { minX, minY, minZ, maxX, maxY, maxZ }
}

function full() {
  return [box(0, 0, 0, 1, 1, 1)]
}

function prop(block, key, fallback) {
  const value = block?.properties?.[key]
  return value == null || value === '' ? fallback : String(value)
}

function boolProp(block, key) {
  return prop(block, key, 'false') === 'true'
}

function doorBoxes(block) {
  const facing = prop(block, 'facing', 'east')
  const open = boolProp(block, 'open')
  const hinge = prop(block, 'hinge', 'left')
  const thin = 3 / 16
  let dir = facing
  if (open) {
    dir = hinge === 'left'
      ? { east: 'south', west: 'north', south: 'west', north: 'east' }[facing]
      : { east: 'north', west: 'south', south: 'east', north: 'west' }[facing]
  }
  if (dir === 'east') {
    return [box(0, 0, 0, thin, 1, 1)]
  }
  if (dir === 'west') {
    return [box(1 - thin, 0, 0, 1, 1, 1)]
  }
  if (dir === 'south') {
    return [box(0, 0, 0, 1, 1, thin)]
  }
  return [box(0, 0, 1 - thin, 1, 1, 1)]
}

function stairBoxes(block) {
  const facing = prop(block, 'facing', 'east')
  const half = prop(block, 'half', 'bottom')
  const shape = prop(block, 'shape', 'straight')
  const top = half === 'top'
  const slabs = [top ? box(0, 0.5, 0, 1, 1, 1) : box(0, 0, 0, 1, 0.5, 1)]
  const y0 = top ? 0 : 0.5
  const y1 = top ? 0.5 : 1
  if (shape.startsWith('outer')) {
    if (facing === 'east') {
      slabs.push(box(0.5, y0, 0.5, 1, y1, 1))
    } else if (facing === 'west') {
      slabs.push(box(0, y0, 0, 0.5, y1, 0.5))
    } else if (facing === 'south') {
      slabs.push(box(0.5, y0, 0.5, 1, y1, 1))
    } else {
      slabs.push(box(0, y0, 0, 0.5, y1, 0.5))
    }
    return slabs
  }
  if (facing === 'east') {
    slabs.push(box(0.5, y0, 0, 1, y1, 1))
  } else if (facing === 'west') {
    slabs.push(box(0, y0, 0, 0.5, y1, 1))
  } else if (facing === 'south') {
    slabs.push(box(0, y0, 0.5, 1, y1, 1))
  } else {
    slabs.push(box(0, y0, 0, 1, y1, 0.5))
  }
  return slabs
}

function fenceBoxes(block) {
  const post = box(6 / 16, 0, 6 / 16, 10 / 16, 1.5, 10 / 16)
  const boxes = [post]
  if (prop(block, 'east', 'false') === 'true') {
    boxes.push(box(10 / 16, 0, 6 / 16, 1, 1.5, 10 / 16))
  }
  if (prop(block, 'west', 'false') === 'true') {
    boxes.push(box(0, 0, 6 / 16, 6 / 16, 1.5, 10 / 16))
  }
  return boxes
}

function wallBoxes(block) {
  const boxes = [box(4 / 16, 0, 4 / 16, 12 / 16, 1, 12 / 16)]
  if (prop(block, 'east', 'none') !== 'none') {
    boxes.push(box(12 / 16, 0, 5 / 16, 1, 14 / 16, 11 / 16))
  }
  if (prop(block, 'west', 'none') !== 'none') {
    boxes.push(box(0, 0, 5 / 16, 4 / 16, 14 / 16, 11 / 16))
  }
  return boxes
}

function paneBoxes(block) {
  const boxes = [box(7 / 16, 0, 7 / 16, 9 / 16, 1, 9 / 16)]
  if (prop(block, 'east', 'false') === 'true') {
    boxes.push(box(9 / 16, 0, 7 / 16, 1, 1, 9 / 16))
  }
  if (prop(block, 'west', 'false') === 'true') {
    boxes.push(box(0, 0, 7 / 16, 7 / 16, 1, 9 / 16))
  }
  return boxes
}

function trapdoorBoxes(block) {
  const open = boolProp(block, 'open')
  const half = prop(block, 'half', 'bottom')
  const facing = prop(block, 'facing', 'north')
  const thin = 3 / 16
  if (!open) {
    return half === 'top' ? [box(0, 1 - thin, 0, 1, 1, 1)] : [box(0, 0, 0, 1, thin, 1)]
  }
  if (facing === 'east') {
    return [box(1 - thin, 0, 0, 1, 1, 1)]
  }
  if (facing === 'west') {
    return [box(0, 0, 0, thin, 1, 1)]
  }
  if (facing === 'south') {
    return [box(0, 0, 1 - thin, 1, 1, 1)]
  }
  return [box(0, 0, 0, 1, 1, thin)]
}

export function localBoxes(block) {
  if (!block) {
    return []
  }
  const id = bareId(block.id)
  if (isFluid(id)) {
    return []
  }
  if (hasNoCollision(id) || isTorch(id)) {
    return []
  }
  if (isDoor(id)) {
    return doorBoxes(block)
  }
  if (isStairs(id)) {
    return stairBoxes(block)
  }
  if (isSlab(id)) {
    return prop(block, 'type', 'bottom') === 'top'
      ? [box(0, 0.5, 0, 1, 1, 1)]
      : prop(block, 'type', 'bottom') === 'double'
        ? full()
        : [box(0, 0, 0, 1, 0.5, 1)]
  }
  if (isFence(id) || isFenceGate(id)) {
    if (isFenceGate(id) && boolProp(block, 'open')) {
      return []
    }
    return fenceBoxes(block)
  }
  if (isWall(id)) {
    return wallBoxes(block)
  }
  if (isPane(id)) {
    return paneBoxes(block)
  }
  if (isTrapdoor(id)) {
    return trapdoorBoxes(block)
  }
  const modeled = cachedModelBoxes(id, block.properties)
  if (Array.isArray(modeled) && modeled.length) {
    return modeled
  }
  if (modeled === undefined) {
    primeModelBoxes(id, block.properties)
  }
  if (isCarpet(id) || id === 'moss_carpet') {
    return [box(0, 0, 0, 1, 1 / 16, 1)]
  }
  if (id === 'snow') {
    const layers = Math.max(1, Number(prop(block, 'layers', 1)))
    return [box(0, 0, 0, 1, layers / 8, 1)]
  }
  if (id === 'soul_sand') {
    return [box(0, 0, 0, 1, 14 / 16, 1)]
  }
  if (id === 'farmland' || id === 'dirt_path' || id === 'grass_path') {
    return [box(0, 0, 0, 1, 15 / 16, 1)]
  }
  if (isChest(id)) {
    return [box(1 / 16, 0, 1 / 16, 15 / 16, 14 / 16, 15 / 16)]
  }
  if (isBed(id)) {
    return [box(0, 0, 0, 1, 9 / 16, 1)]
  }
  if (id === 'end_portal_frame') {
    return [box(0, 0, 0, 1, 13 / 16, 1)]
  }
  if (id === 'lily_pad') {
    return [box(1 / 16, 0, 1 / 16, 15 / 16, 1.5 / 16, 15 / 16)]
  }
  return full()
}

export function worldBoxes(block, x, y) {
  const boxes = []
  for (const item of localBoxes(block)) {
    boxes.push({
      minX: x + item.minX,
      minY: y + item.minY,
      minZ: 0,
      maxX: x + item.maxX,
      maxY: y + item.maxY,
      maxZ: 1,
    })
    if (item.maxY - item.minY < 0.3) {
      continue
    }
    const skin = 2 / 16
    boxes.push({
      minX: x + item.minX - skin,
      minY: y + item.minY,
      minZ: 0,
      maxX: x + item.minX,
      maxY: y + item.maxY,
      maxZ: 1,
    })
    boxes.push({
      minX: x + item.maxX,
      minY: y + item.minY,
      minZ: 0,
      maxX: x + item.maxX + skin,
      maxY: y + item.maxY,
      maxZ: 1,
    })
  }
  return boxes
}

export function fluidWorldBox(block, x, y) {
  const local = fluidBox(block)
  if (!local) {
    return null
  }
  return {
    minX: x + local.minX,
    minY: y + local.minY,
    minZ: local.minZ,
    maxX: x + local.maxX,
    maxY: y + local.maxY,
    maxZ: local.maxZ,
    fluid: local.fluid,
  }
}

export function overlap(a, b) {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY
}

export function shiftBox(item, dx, dy) {
  return {
    minX: item.minX + dx,
    maxX: item.maxX + dx,
    minY: item.minY + dy,
    maxY: item.maxY + dy,
    minZ: item.minZ,
    maxZ: item.maxZ,
  }
}
