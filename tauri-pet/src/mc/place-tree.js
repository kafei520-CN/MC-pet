import { hasNoCollision, isFluid, isFullSolid } from './ids.js'
import { MAX_JUMP_RISE, STEP_HEIGHT } from './move.js'
import { PLAYER_HEIGHT, PLAYER_WIDTH } from './scale.js'

export const PLACE_REACH = 4
const EYE = 1.62
const SAME_FLOOR = 0.25

function selector(nodes) {
  return (ctx) => {
    for (const node of nodes) {
      const result = node(ctx)
      if (result) {
        return result
      }
    }
    return null
  }
}

function blocksRay(block) {
  if (!block || isFluid(block.id) || hasNoCollision(block.id)) {
    return false
  }
  return true
}

function canSupport(block) {
  return Boolean(block) && isFullSolid(block.id, block.properties)
}

function bodyFits(isSolid, wx, wy) {
  const minX = Math.floor(wx - PLAYER_WIDTH / 2)
  const maxX = Math.floor(wx + PLAYER_WIDTH / 2 - 1e-4)
  const minY = Math.floor(wy + 0.01)
  const maxY = Math.floor(wy + PLAYER_HEIGHT - 0.05)
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      if (isSolid(x, y)) {
        return false
      }
    }
  }
  return true
}

function overlapsBlock(stand, block) {
  const minX = stand.x - PLAYER_WIDTH / 2
  const maxX = stand.x + PLAYER_WIDTH / 2
  return maxX > block.x + 0.05
    && minX < block.x + 0.95
    && stand.y + PLAYER_HEIGHT > block.y + 0.05
    && stand.y < block.y + 0.95
}

function floorsAt(getSupport, isSolid, x) {
  const minX = Math.floor(x - PLAYER_WIDTH / 2)
  const maxX = Math.floor(x + PLAYER_WIDTH / 2 - 1e-4)
  const floors = []
  const seen = new Set()
  function add(y) {
    if (seen.has(y) || !bodyFits(isSolid, x, y)) {
      return
    }
    seen.add(y)
    floors.push(y)
  }
  add(0)
  for (let col = minX; col <= maxX; col += 1) {
    for (let y = 0; y <= 8; y += 1) {
      if (!canSupport(getSupport(col, y))) {
        continue
      }
      add(y + 1)
    }
  }
  return floors
}

function solidAt(ctx) {
  const getSupport = ctx.getSupport ?? ctx.getBlock
  return (x, y) => blocksRay(getSupport(x, y)) || blocksRay(ctx.getBlock(x, y))
}

export function rayReaches(getBlock, x0, y0, x1, y1) {
  const targetX = Math.floor(x1)
  const targetY = Math.floor(y1)
  let x = Math.floor(x0)
  let y = Math.floor(y0)
  if (x === targetX && y === targetY) {
    return true
  }
  const dirX = x1 - x0
  const dirY = y1 - y0
  const stepX = Math.sign(dirX)
  const stepY = Math.sign(dirY)
  const tDeltaX = stepX === 0 ? Infinity : 1 / Math.abs(dirX)
  const tDeltaY = stepY === 0 ? Infinity : 1 / Math.abs(dirY)
  let tMaxX = stepX === 0 ? Infinity : ((stepX > 0 ? Math.floor(x0) + 1 - x0 : x0 - Math.floor(x0)) * tDeltaX)
  let tMaxY = stepY === 0 ? Infinity : ((stepY > 0 ? Math.floor(y0) + 1 - y0 : y0 - Math.floor(y0)) * tDeltaY)
  for (let step = 0; step < 24; step += 1) {
    if (tMaxX < tMaxY) {
      if (tMaxX > 1) {
        return false
      }
      x += stepX
      tMaxX += tDeltaX
    } else {
      if (tMaxY > 1) {
        return false
      }
      y += stepY
      tMaxY += tDeltaY
    }
    if (x === targetX && y === targetY) {
      return true
    }
    if (blocksRay(getBlock(x, y))) {
      return false
    }
  }
  return false
}

function inReach(feet, block) {
  const dx = block.x + 0.5 - feet.x
  const dy = block.y + 0.5 - (feet.y + EYE)
  return dx * dx + dy * dy <= PLACE_REACH * PLACE_REACH
}

export function canPlace(feet, block, getBlock) {
  if (!inReach(feet, block)) {
    return false
  }
  return rayReaches(getBlock, feet.x, feet.y + EYE, block.x + 0.5, block.y + 0.5)
}

function sameFloor(a, b) {
  return Math.abs(a - b) <= SAME_FLOOR
}

function pathKind(getSupport, isSolid, from, to) {
  const distance = Math.abs(to.x - from.x)
  const steps = Math.max(1, Math.ceil(distance / 0.25))
  let kind = 'walk'
  let prev = from.y
  for (let index = 1; index <= steps; index += 1) {
    const x = from.x + (to.x - from.x) * (index / steps)
    const choices = floorsAt(getSupport, isSolid, x)
    let next = null
    for (const y of choices) {
      if (next == null || Math.abs(y - prev) < Math.abs(next - prev)) {
        next = y
      }
    }
    if (next == null) {
      return 'blocked'
    }
    const rise = next - prev
    if (rise > MAX_JUMP_RISE + 0.05) {
      return 'blocked'
    }
    if (rise > STEP_HEIGHT + 0.05) {
      kind = 'jump'
    }
    prev = next
  }
  if (Math.abs(prev - to.y) > STEP_HEIGHT + 0.05) {
    return 'blocked'
  }
  return kind
}

function faceOf(stand, block) {
  if (block.x + 0.5 === stand.x) {
    return 1
  }
  return block.x + 0.5 > stand.x ? 1 : -1
}

function plan(stand, block, move) {
  return {
    move,
    stand: { x: stand.x, y: stand.y },
    face: faceOf(stand, block),
  }
}

function rank(feet, stand, block) {
  const jump = stand.kind === 'jump' ? 8 : 0
  const drop = Math.abs(stand.y - feet.y) * 4
  const walk = Math.abs(stand.x - feet.x) * 10
  const column = Math.floor(stand.x) === block.x ? 3 : 0
  const opposite = (stand.x - (block.x + 0.5)) * (feet.x - (block.x + 0.5)) < 0 ? 30 : 0
  return walk + jump + drop + column + opposite
}

function spotClear(ctx, stand) {
  if (overlapsBlock(stand, ctx.block)) {
    return false
  }
  return bodyFits(ctx.isSolid, stand.x, stand.y)
}

function collectStands(ctx) {
  const { feet, block, getBlock } = ctx
  const getSupport = ctx.getSupport ?? getBlock
  const stands = []
  const minX = block.x - PLACE_REACH
  const maxX = block.x + PLACE_REACH
  for (let col = minX; col <= maxX; col += 1) {
    const x = col + 0.5
    for (const y of floorsAt(getSupport, ctx.isSolid, x)) {
      const stand = { x, y }
      if (!spotClear(ctx, stand) || !canPlace(stand, block, getBlock)) {
        continue
      }
      const kind = pathKind(getSupport, ctx.isSolid, feet, stand)
      if (kind !== 'walk' && kind !== 'jump') {
        continue
      }
      stands.push({ x, y, kind })
    }
  }
  return stands
}

function pick(ctx, accept) {
  let best = null
  let bestRank = Infinity
  for (const stand of ctx.stands) {
    if (!accept(stand)) {
      continue
    }
    const score = rank(ctx.feet, stand, ctx.block)
    if (score < bestRank) {
      best = stand
      bestRank = score
    }
  }
  if (!best) {
    return null
  }
  return plan(best, ctx.block, true)
}

function hereNode(ctx) {
  if (!spotClear(ctx, ctx.feet) || !canPlace(ctx.feet, ctx.block, ctx.getBlock)) {
    return null
  }
  return plan(ctx.feet, ctx.block, false)
}

function sameFloorNode(ctx) {
  return pick(ctx, (stand) => stand.kind === 'walk' && sameFloor(stand.y, ctx.feet.y))
}

function walkNode(ctx) {
  return pick(ctx, (stand) => stand.kind === 'walk')
}

function jumpNode(ctx) {
  return pick(ctx, (stand) => stand.kind === 'jump')
}

const placeTree = selector([
  hereNode,
  sameFloorNode,
  walkNode,
  jumpNode,
])

export function feetInside(feet, getSupport, getBlock) {
  const isSolid = (x, y) => blocksRay(getSupport(x, y)) || blocksRay(getBlock(x, y))
  return !bodyFits(isSolid, feet.x, feet.y)
}

export function choosePlaceStand(ctx) {
  const next = {
    ...ctx,
    isSolid: solidAt(ctx),
  }
  return placeTree({
    ...next,
    stands: collectStands(next),
  })
}
