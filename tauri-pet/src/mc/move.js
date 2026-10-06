import { fluidWorldBox, overlap, shiftBox, worldBoxes } from './collision.js'
import { isFluid } from './ids.js'
import {
  BLOCK_PX,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  screenToWorld,
  worldToScreen,
  workSize,
} from './scale.js'
import { atScreenTop, visibleTopSpans } from './window-order.js'

export const GRAVITY = 32
export const JUMP_VY = 9
export const WALK_SPEED = 2.8
export const STEP_HEIGHT = 0.5
export const JUMP_HEIGHT = 1.25
export const MAX_JUMP_RISE = 1
export const WATER_GRAVITY = 8
export const WATER_RISE = 6
export const CHUTE_FALL = 2.2

function actorBox(wx, wy, hw = PLAYER_WIDTH / 2, hh = PLAYER_HEIGHT) {
  return {
    minX: wx - hw,
    maxX: wx + hw,
    minY: wy,
    maxY: wy + hh,
    minZ: 0.2,
    maxZ: 0.8,
  }
}

function playerBox(wx, wy) {
  return actorBox(wx, wy)
}

export function screenRectBox(rect) {
  const { height } = workSize()
  return {
    minX: rect.x / BLOCK_PX,
    maxX: (rect.x + rect.width) / BLOCK_PX,
    minY: (height - rect.y - rect.height) / BLOCK_PX,
    maxY: (height - rect.y) / BLOCK_PX,
    minZ: 0,
    maxZ: 1,
  }
}

export function desktopSolids(windows, taskbar) {
  const { width, height } = workSize()
  const boxes = []
  if (taskbar && taskbar.width > 8 && taskbar.height > 8) {
    boxes.push({ ...screenRectBox(taskbar), kind: 'taskbar' })
  }
  for (const win of windows ?? []) {
    if (!win || atScreenTop(win)) {
      continue
    }
    if (win.width > width * 0.88 && win.height > height * 0.88) {
      continue
    }
    boxes.push({ ...screenRectBox(win), kind: 'window', windowId: win.id })
  }
  return boxes
}

function windowPlatforms(windows, ignoreId) {
  const { height } = workSize()
  const list = windows ?? []
  const platforms = []
  for (const win of list) {
    if (!win || atScreenTop(win) || win.id === ignoreId) {
      continue
    }
    const worldY = (height - win.y) / BLOCK_PX
    for (const [left, right] of visibleTopSpans(win, list)) {
      platforms.push({
        minX: left / BLOCK_PX,
        maxX: right / BLOCK_PX,
        minY: worldY - 0.08,
        maxY: worldY,
        minZ: 0,
        maxZ: 1,
        platform: true,
        windowId: win.id,
      })
    }
  }
  return platforms
}

function collectSolids(getBlock, aabb) {
  const solids = []
  const minX = Math.floor(aabb.minX) - 1
  const maxX = Math.floor(aabb.maxX) + 1
  const minY = Math.floor(aabb.minY) - 1
  const maxY = Math.floor(aabb.maxY) + 2
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      const block = getBlock(x, y)
      if (!block || isFluid(block.id)) {
        continue
      }
      solids.push(...worldBoxes(block, x, y))
    }
  }
  return solids
}

function collectFluids(getBlock, aabb) {
  const fluids = []
  const minX = Math.floor(aabb.minX)
  const maxX = Math.floor(aabb.maxX)
  const minY = Math.floor(aabb.minY)
  const maxY = Math.floor(aabb.maxY)
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      const block = getBlock(x, y)
      const box = fluidWorldBox(block, x, y)
      if (box) {
        fluids.push(box)
      }
    }
  }
  return fluids
}

const SEPARATE_EPS = 0.001

export function depenetrate(aabb, solids, maxIter = 8) {
  let current = { ...aabb }
  for (let step = 0; step < maxIter; step += 1) {
    let hit = null
    let bestOx = Infinity
    let bestOy = Infinity
    for (const solid of solids) {
      if (solid.platform) {
        continue
      }
      if (!overlap(current, solid)) {
        continue
      }
      const ox = Math.min(current.maxX, solid.maxX) - Math.max(current.minX, solid.minX)
      const oy = Math.min(current.maxY, solid.maxY) - Math.max(current.minY, solid.minY)
      if (ox <= 0 || oy <= 0) {
        continue
      }
      if (ox < bestOx || (ox === bestOx && oy < bestOy)) {
        bestOx = ox
        bestOy = oy
        hit = solid
      }
    }
    if (!hit) {
      return current
    }
    if (bestOx < bestOy) {
      const cx = (current.minX + current.maxX) / 2
      const sx = (hit.minX + hit.maxX) / 2
      const push = bestOx + SEPARATE_EPS
      current = shiftBox(current, cx < sx ? -push : push, 0)
    } else {
      const cy = (current.minY + current.maxY) / 2
      const sy = (hit.minY + hit.maxY) / 2
      const lift = hit.maxY - current.minY
      if (lift > 0 && lift <= STEP_HEIGHT + 0.02 && cy >= sy) {
        current = shiftBox(current, 0, lift + SEPARATE_EPS)
      } else {
        const push = bestOy + SEPARATE_EPS
        current = shiftBox(current, 0, cy < sy ? -push : push)
      }
    }
  }
  return current
}

export function spawnBlocked(getBlock, wx, wy) {
  const aabb = playerBox(wx, wy)
  aabb.minY += 0.06
  const solids = collectSolids(getBlock, {
    minX: aabb.minX,
    maxX: aabb.maxX,
    minY: aabb.minY,
    maxY: aabb.maxY,
  })
  return solids.some((solid) => !solid.platform && overlap(aabb, solid) && solid.maxY > wy + 0.08)
}

export function resolveSpawn(getBlock, screenX, screenY) {
  const startY = screenY == null || screenY < 8 ? workSize().height : screenY
  let feet = screenToWorld(screenX, startY)
  for (let i = 0; i < 48; i += 1) {
    if (!spawnBlocked(getBlock, feet.x, feet.y)) {
      return worldToScreen(feet.x, feet.y)
    }
    feet.y += 1
  }
  return worldToScreen(feet.x, feet.y)
}

export function resolveScreenPosition(getBlock, sx, sy) {
  const feet = screenToWorld(sx, sy)
  let aabb = playerBox(feet.x, feet.y)
  const solids = collectSolids(getBlock, {
    minX: aabb.minX - 1,
    maxX: aabb.maxX + 1,
    minY: aabb.minY - 1,
    maxY: aabb.maxY + 2,
  })
  aabb = depenetrate(aabb, solids)
  return worldToScreen((aabb.minX + aabb.maxX) / 2, aabb.minY)
}

function resolveAxis(aabb, solids, axis, delta) {
  if (!delta) {
    return { delta: 0, hit: false }
  }
  const moved = shiftBox(aabb, axis === 'x' ? delta : 0, axis === 'y' ? delta : 0)
  let allowed = delta
  let hit = false
  for (const solid of solids) {
    if (!overlap(moved, solid)) {
      continue
    }
    hit = true
    if (axis === 'x') {
      if (delta > 0) {
        allowed = Math.min(allowed, solid.minX - aabb.maxX)
      } else {
        allowed = Math.max(allowed, solid.maxX - aabb.minX)
      }
    } else if (delta > 0) {
      allowed = Math.min(allowed, solid.minY - aabb.maxY)
    } else {
      allowed = Math.max(allowed, solid.maxY - aabb.minY)
    }
  }
  if (delta > 0) {
    allowed = Math.max(0, allowed)
  } else {
    allowed = Math.min(0, allowed)
  }
  return { delta: allowed, hit }
}

function canStand(solids, wx, wy) {
  const probe = playerBox(wx, wy + 0.02)
  probe.maxY = wy + 0.08
  return solids.some((solid) => overlap(probe, solid) && Math.abs(solid.maxY - wy) < 0.12)
}

export function highestSupport(getBlock, windows, wx, fromY, ignoreId, extra = []) {
  const platforms = windowPlatforms(windows, ignoreId)
  const range = {
    minX: wx - PLAYER_WIDTH / 2,
    maxX: wx + PLAYER_WIDTH / 2,
    minY: 0,
    maxY: fromY + 0.05,
  }
  const solids = [...collectSolids(getBlock, {
    minX: range.minX,
    maxX: range.maxX,
    minY: 0,
    maxY: fromY + 2,
  }), ...platforms, ...extra]
  let best = 0
  for (const solid of solids) {
    if (solid.maxX <= range.minX || solid.minX >= range.maxX) {
      continue
    }
    if (solid.maxY <= fromY + 0.08 && solid.maxY > best) {
      best = solid.maxY
    }
  }
  return best
}

export function supportScreenY(getBlock, windows, screenX, screenY, ignoreId, extra) {
  const feetY = screenY == null || screenY < 8 ? workSize().height : screenY
  const world = screenToWorld(screenX, feetY)
  const y = highestSupport(getBlock, windows, world.x, world.y, ignoreId, extra)
  return worldToScreen(world.x, y).y
}

export function supportAt(getBlock, windows, extra, wx, fromY, hw = PLAYER_WIDTH / 2) {
  const platforms = windowPlatforms(windows, null)
  const solids = [...collectSolids(getBlock, {
    minX: wx - hw - 1,
    maxX: wx + hw + 1,
    minY: 0,
    maxY: fromY + 2,
  }), ...platforms, ...extra]
  let best = 0
  for (const solid of solids) {
    if (solid.maxX <= wx - hw || solid.minX >= wx + hw) {
      continue
    }
    if (solid.maxY <= fromY + 0.08 && solid.maxY > best) {
      best = solid.maxY
    }
  }
  return best
}

export function blockSolids(getBlock, minX, minY, maxX, maxY) {
  return collectSolids(getBlock, { minX, minY, maxX, maxY, minZ: 0, maxZ: 1 })
}

function findClimbWall(solids, feet, face) {
  let best = null
  let bestRise = 0
  for (const dist of [0.02, 0.08]) {
    const probe = playerBox(feet.x + face * dist, feet.y + 0.02)
    for (const solid of solids) {
      if (solid.platform || !overlap(probe, solid)) {
        continue
      }
      const rise = solid.maxY - feet.y
      if (rise > 0.2 && rise >= bestRise) {
        best = solid
        bestRise = rise
      }
    }
  }
  return best
}

export function stepActor(actor, dt, ctx) {
  const { getBlock, windows, wander, wantJump, ignoreWindowId } = ctx
  const extra = ctx.extraSolids ?? desktopSolids(windows, ctx.taskbar)
  const hw = ctx.hw ?? PLAYER_WIDTH / 2
  const hh = ctx.hh ?? PLAYER_HEIGHT
  actor.climbHint = null
  actor.blocked = false
  const feet = screenToWorld(actor.x, actor.y)
  let vx = actor.vx ?? 0
  let vy = actor.vy ?? 0
  let jumping = Boolean(wantJump)
  if (wander?.path && wander.pi < wander.path.length) {
    const node = wander.path[wander.pi]
    const dx = node.x - feet.x
    const dy = node.y - feet.y
    if (Math.abs(dx) < 0.28 && Math.abs(dy) < 0.4) {
      wander.pi += 1
    } else {
      vx = (dx === 0 ? (wander.face || 1) : Math.sign(dx)) * WALK_SPEED
      wander.face = vx >= 0 ? 1 : -1
      if (dy > STEP_HEIGHT + 0.05) {
        jumping = true
      }
    }
    if (wander.pi >= wander.path.length) {
      vx = 0
    }
  } else if (wander?.path) {
    vx = 0
  } else if (wander && !wander.needPath) {
    const face = wander.face >= 0 ? 1 : -1
    vx = face * WALK_SPEED
  } else if (!ctx.keepMomentum) {
    vx *= Math.max(0, 1 - dt * 8)
    if (Math.abs(vx) < 0.05) {
      vx = 0
    }
  }
  let aabb = actorBox(feet.x, feet.y, hw, hh)
  const solids = [...collectSolids(getBlock, {
    minX: aabb.minX + vx * dt - 1,
    maxX: aabb.maxX + vx * dt + 1,
    minY: aabb.minY + Math.min(0, vy) * dt - 1,
    maxY: aabb.maxY + Math.max(0, vy) * dt + 2,
  }), ...windowPlatforms(windows, ignoreWindowId), ...extra]
  for (const solid of solids) {
    if (solid.platform || !overlap(aabb, solid)) {
      continue
    }
    const lift = solid.maxY - aabb.minY
    if (lift > 0 && lift <= STEP_HEIGHT + 0.02) {
      aabb = shiftBox(aabb, 0, lift)
      feet.y += lift
      vy = Math.max(vy, 0)
    }
  }
  aabb = depenetrate(aabb, solids)
  feet.x = (aabb.minX + aabb.maxX) / 2
  feet.y = aabb.minY
  const fluids = collectFluids(getBlock, aabb)
  const inWater = fluids.some((box) => overlap(aabb, box))
  const groundedProbe = shiftBox(aabb, 0, -0.08)
  let onGround = aabb.minY <= 0.04 || solids.some((solid) => overlap(groundedProbe, solid) && aabb.minY >= solid.maxY - 0.12)
  if (jumping && onGround && !inWater) {
    vy = JUMP_VY
    onGround = false
  } else if (jumping && inWater) {
    vy = Math.max(vy, WATER_RISE)
  }
  if (inWater) {
    vy -= WATER_GRAVITY * dt
    vy *= Math.max(0.4, 1 - dt * 2)
    vx *= 0.7
  } else if (!onGround && ctx.parachute) {
    const terminal = -CHUTE_FALL
    if (vy < terminal) {
      vy += (terminal - vy) * Math.min(1, dt * 9)
    } else {
      vy -= GRAVITY * 0.12 * dt
      if (vy < terminal) {
        vy = terminal
      }
    }
    vx *= Math.max(0.15, 1 - dt * 2.4)
  } else if (!onGround) {
    vy -= GRAVITY * dt
  } else if (vy < 0) {
    vy = 0
  }

  const face = wander ? (wander.face >= 0 ? 1 : -1) : (vx >= 0 ? 1 : -1)
  const climbWall = findClimbWall(solids, feet, face)
  if (wander && onGround && climbWall) {
    const rise = climbWall.maxY - feet.y
    if (rise > 0.05 && rise <= STEP_HEIGHT) {
      feet.y = climbWall.maxY
      aabb = actorBox(feet.x, feet.y, hw, hh)
    } else if (rise > STEP_HEIGHT && rise <= JUMP_HEIGHT + 0.05) {
      vy = JUMP_VY
      onGround = false
    }
  }

  const xMove = resolveAxis(aabb, solids, 'x', vx * dt)
  aabb = shiftBox(aabb, xMove.delta, 0)
  const yMove = resolveAxis(aabb, solids, 'y', vy * dt)
  aabb = shiftBox(aabb, 0, yMove.delta)
  if (yMove.hit && vy < 0) {
    onGround = true
    vy = 0
  }
  if (yMove.hit && vy > 0) {
    vy = 0
  }
  if (xMove.hit) {
    vx = 0
    const nowFeet = { x: (aabb.minX + aabb.maxX) / 2, y: aabb.minY }
    const wall = findClimbWall(solids, nowFeet, face)
    const rise = wall ? wall.maxY - nowFeet.y : Infinity
    if (wander && onGround && !actor.climbHint && rise > STEP_HEIGHT && rise <= JUMP_HEIGHT + 0.05) {
      vy = JUMP_VY
      onGround = false
      vx = face * WALK_SPEED
    } else if (wander && rise > JUMP_HEIGHT + 0.05) {
      if (wander.path) {
        wander.pi = wander.path.length
      }
      actor.blocked = true
    }
  }
  feet.x = (aabb.minX + aabb.maxX) / 2
  feet.y = aabb.minY
  if (feet.y < 0) {
    feet.y = 0
    vy = 0
    onGround = true
  }
  const screen = worldToScreen(feet.x, feet.y)
  actor.x = screen.x
  actor.y = screen.y
  actor.vx = vx
  actor.vy = vy
  actor.onGround = onGround
  actor.inWater = inWater
  actor.jumping = !onGround && vy > 1
  return actor
}
