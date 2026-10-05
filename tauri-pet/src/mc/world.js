import { extraCells, partnerCells, touchNeighbors } from './connect.js'
import { localBoxes, worldBoxes } from './collision.js'
import { primeModelBoxes } from './model-boxes.js'
import { normalizeFluidId, updateFluids } from './fluids.js'
import { blockExists } from './assets.js'
import { bareId, isDoor, isFluid } from './ids.js'

export const BACK_Z = 0
export const FRONT_Z = 1

function key(x, y, z = 0) {
  return `${x},${y},${z}`
}

function cloneBlock(block) {
  return {
    id: block.id,
    z: block.z ?? 0,
    properties: { ...(block.properties ?? {}) },
    nbt: block.nbt ? { ...block.nbt } : undefined,
  }
}

export function createStore() {
  const cells = new Map()

  function get(x, y, z) {
    const block = rawGet(x, y, z)
    return block ? cloneBlock(block) : null
  }

  function rawGet(x, y, z) {
    if (z == null) {
      return cells.get(key(x, y, FRONT_Z)) ?? cells.get(key(x, y, BACK_Z)) ?? null
    }
    return cells.get(key(x, y, z)) ?? null
  }

  function walkGet(x, y) {
    return cells.get(key(x, y, FRONT_Z)) ?? null
  }

  function set(x, y, block, z) {
    const depth = Number.isFinite(z) ? z : (Number.isFinite(block?.z) ? block.z : 0)
    if (!block) {
      cells.delete(key(x, y, depth))
      return
    }
    cells.set(key(x, y, depth), {
      x,
      y,
      z: depth,
      id: bareId(block.id),
      properties: { ...(block.properties ?? {}) },
      nbt: block.nbt ? { ...block.nbt } : undefined,
    })
  }

  function list() {
    return [...cells.values()].map((block) => ({
      x: block.x,
      y: block.y,
      ...cloneBlock(block),
    }))
  }

  function clear() {
    cells.clear()
  }

  return { get, rawGet, walkGet, set, list, clear, cells }
}

export async function placeBlock(store, x, y, id, properties = {}, nbt, z = 0) {
  const name = isFluid(id) ? normalizeFluidId(id) : bareId(id)
  if (!name) {
    return { ok: false, error: 'missing id' }
  }
  const exists = await blockExists(name)
  if (!exists) {
    return { ok: false, error: `${name} is not a block` }
  }
  const bx = Math.floor(Number(x))
  const by = Math.floor(Number(y))
  const bz = Math.floor(Number.isFinite(Number(z)) ? Number(z) : 0)
  if (!Number.isFinite(bx) || !Number.isFinite(by)) {
    return { ok: false, error: 'invalid coordinates' }
  }
  const cells = extraCells(name, bx, by, properties)
  for (const cell of cells) {
    if (cell.x === bx && cell.y === by) {
      continue
    }
    const occupied = store.rawGet(cell.x, cell.y, bz)
    if (occupied && occupied.id !== name) {
      return { ok: false, error: `blocked at ${cell.x},${cell.y}` }
    }
  }
  for (const cell of cells) {
    store.set(cell.x, cell.y, {
      id: cell.id,
      properties: cell.properties,
      z: bz,
      nbt: cell.x === bx && cell.y === by ? nbt : undefined,
    }, bz)
  }
  const get = (gx, gy) => store.rawGet(gx, gy, bz)
  const set = (sx, sy, block) => store.set(sx, sy, block, bz)
  for (const cell of cells) {
    touchNeighbors(get, set, cell.x, cell.y)
  }
  if (isFluid(name)) {
    updateFluids(get, set, bx, by)
  }
  await primeModelBoxes(name, properties)
  return { ok: true, placed: cells }
}

export function removeBlock(store, x, y, z = 0) {
  const bx = Math.floor(Number(x))
  const by = Math.floor(Number(y))
  const bz = Math.floor(Number(z) || 0)
  const block = store.rawGet(bx, by, bz)
  if (!block) {
    return { ok: false, error: 'empty' }
  }
  const cells = partnerCells(block, bx, by)
  for (const cell of cells) {
    store.set(cell.x, cell.y, null, bz)
  }
  const get = (gx, gy) => store.rawGet(gx, gy, bz)
  const set = (sx, sy, next) => store.set(sx, sy, next, bz)
  for (const cell of cells) {
    touchNeighbors(get, set, cell.x, cell.y)
    updateFluids(get, set, cell.x, cell.y)
  }
  return { ok: true, removed: cells }
}

export function setBlockState(store, x, y, properties = {}, nbt, z = 0) {
  const bx = Math.floor(Number(x))
  const by = Math.floor(Number(y))
  const bz = Math.floor(Number(z) || 0)
  const block = store.rawGet(bx, by, bz)
  if (!block) {
    return { ok: false, error: 'empty' }
  }
  const next = {
    ...block,
    properties: { ...block.properties, ...properties },
    nbt: nbt === undefined ? block.nbt : nbt,
  }
  const cells = isDoor(block.id) ? extraCells(block.id, bx, by, next.properties) : [{ x: bx, y: by, id: block.id, properties: next.properties }]
  for (const cell of cells) {
    const current = store.rawGet(cell.x, cell.y, bz)
    store.set(cell.x, cell.y, {
      id: cell.id,
      properties: cell.properties,
      z: bz,
      nbt: cell.x === bx && cell.y === by ? next.nbt : current?.nbt,
    }, bz)
  }
  const get = (gx, gy) => store.rawGet(gx, gy, bz)
  const set = (sx, sy, value) => store.set(sx, sy, value, bz)
  for (const cell of cells) {
    touchNeighbors(get, set, cell.x, cell.y)
  }
  return { ok: true, properties: next.properties }
}

export function serialize(store, hands) {
  return {
    v: 1,
    blocks: store.list().map((block) => ({
      x: block.x,
      y: block.y,
      z: block.z ?? 0,
      id: block.id,
      p: block.properties,
      n: block.nbt,
    })),
    hand: hands.right,
    offhand: hands.left,
  }
}

export function applySave(store, data) {
  store.clear()
  const blocks = data?.blocks ?? []
  for (const block of blocks) {
    const properties = block.p ?? block.properties ?? {}
    store.set(block.x, block.y, {
      id: block.id,
      properties,
      nbt: block.n ?? block.nbt,
      z: block.z ?? 0,
    }, block.z ?? 0)
    primeModelBoxes(block.id, properties)
  }
}

export function collisionAt(store, x, y) {
  const block = store.rawGet(x, y)
  return worldBoxes(block, x, y)
}

export { localBoxes }
