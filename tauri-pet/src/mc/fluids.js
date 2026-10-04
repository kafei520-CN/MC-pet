import { bareId, fluidKind, isFluid } from './ids.js'

function levelOf(block) {
  if (!block || !isFluid(block.id)) {
    return null
  }
  const raw = block.properties?.level
  const value = raw == null ? 0 : Number(raw)
  return Number.isFinite(value) ? value : 0
}

function falling(block) {
  return levelOf(block) === 8
}

function setFluid(set, x, y, kind, level) {
  set(x, y, {
    id: kind,
    properties: { level: String(level) },
  })
}

const MAX_SPREAD = { water: 7, lava: 3 }

export function updateFluids(get, set, originX, originY) {
  const seen = new Set()
  const queue = [[originX, originY]]
  const minX = originX - 8
  const maxX = originX + 8
  const minY = originY - 16
  const maxY = originY + 8
  while (queue.length) {
    const [x, y] = queue.shift()
    const key = `${x},${y}`
    if (seen.has(key) || x < minX || x > maxX || y < minY || y > maxY) {
      continue
    }
    seen.add(key)
    const block = get(x, y)
    const kind = block ? fluidKind(block.id) : null
    if (!kind) {
      continue
    }
    const below = get(x, y - 1)
    if (!below) {
      setFluid(set, x, y - 1, kind, 8)
      queue.push([x, y - 1])
      continue
    }
    if (fluidKind(below.id) === kind) {
      queue.push([x, y - 1])
    }
    const here = levelOf(block)
    if (here == null || here >= MAX_SPREAD[kind] || falling(block)) {
      continue
    }
    const nextLevel = here === 8 ? 1 : here + 1
    if (nextLevel > MAX_SPREAD[kind]) {
      continue
    }
    for (const dx of [-1, 1]) {
      const nx = x + dx
      const beside = get(nx, y)
      if (!beside) {
        setFluid(set, nx, y, kind, nextLevel)
        queue.push([nx, y])
        continue
      }
      const other = fluidKind(beside.id)
      if (other === kind && levelOf(beside) > nextLevel) {
        setFluid(set, nx, y, kind, nextLevel)
        queue.push([nx, y])
      }
    }
  }
}

export function fluidBox(block) {
  const kind = fluidKind(block?.id)
  if (!kind) {
    return null
  }
  const level = levelOf(block) ?? 0
  let height = 1
  if (level === 8) {
    height = 1
  } else if (level > 0) {
    height = (8 - level) / 9
  } else {
    height = 14 / 16
  }
  return { minX: 0, minY: 0, minZ: 0, maxX: 1, maxY: height, maxZ: 1, fluid: kind }
}

export function isSourceFluid(block) {
  return Boolean(block && isFluid(block.id) && (block.properties?.level == null || String(block.properties.level) === '0'))
}

export function normalizeFluidId(id) {
  const name = bareId(id)
  if (name === 'flowing_water') {
    return 'water'
  }
  if (name === 'flowing_lava') {
    return 'lava'
  }
  return name
}
