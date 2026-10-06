function overlap(a, b) {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY
}

const COST_WALK = 1
const COST_STEP = 1.35
const COST_JUMP = 2.45
const COST_DROP = 1.12

function key(x, y) {
  return `${x},${y}`
}

function heur(ax, ay, bx, by) {
  const dx = Math.abs(ax - bx)
  const dy = Math.abs(ay - by)
  return dx + dy * 0.55
}

function bodyBox(x, y, hw, hh) {
  return {
    minX: x - hw + 0.02,
    maxX: x + hw - 0.02,
    minY: y + 0.05,
    maxY: y + hh,
    minZ: 0.2,
    maxZ: 0.8,
  }
}

function blocked(aabb, solids) {
  for (const solid of solids) {
    if (solid.platform) {
      continue
    }
    if (overlap(aabb, solid)) {
      return true
    }
  }
  return false
}

export function findPath(opts) {
  const hw = opts.hw ?? 0.3
  const hh = opts.hh ?? 1.8
  const stepH = opts.stepH ?? 0.5
  const jumpH = opts.jumpH ?? 1.25
  const solids = opts.solids ?? []
  const supportAt = opts.supportAt
  const startX = opts.startX
  const startY = opts.startY
  const goalX = opts.goalX
  const goalY = opts.goalY
  const sx = Math.round(startX)
  const gx = Math.round(goalX)
  const startStand = supportAt(startX, startY + jumpH)
  const goalStand = supportAt(goalX, (goalY ?? startY) + jumpH)
  const sy = Math.round(startStand)
  const gy = Math.round(goalStand)

  const open = [{
    x: sx,
    y: sy,
    land: startStand,
    g: 0,
    f: heur(sx, sy, gx, gy),
    parent: null,
  }]
  const best = new Map([[key(sx, sy), 0]])
  let guard = 0
  let found = null
  while (open.length && guard < 2800) {
    guard += 1
    let pick = 0
    for (let i = 1; i < open.length; i += 1) {
      if (open[i].f < open[pick].f) {
        pick = i
      }
    }
    const cur = open.splice(pick, 1)[0]
    if (cur.x === gx && Math.abs(cur.y - gy) <= 1) {
      found = cur
      break
    }
    for (const dx of [-1, 1]) {
      const nx = cur.x + dx
      const land = supportAt(nx + 0.5, cur.land + jumpH + 0.02)
      const rise = land - cur.land
      if (rise > jumpH + 0.08 || rise < -10) {
        continue
      }
      if (blocked(bodyBox(nx + 0.5, land, hw, hh), solids)) {
        continue
      }
      const ny = Math.round(land)
      let cost = COST_WALK
      if (rise > stepH + 0.05) {
        cost = COST_JUMP
      } else if (rise > 0.12) {
        cost = COST_STEP
      } else if (rise < -0.12) {
        cost = COST_DROP + Math.min(1.6, -rise * 0.12)
      }
      const g = cur.g + cost
      const id = key(nx, ny)
      if (best.has(id) && best.get(id) <= g + 1e-6) {
        continue
      }
      best.set(id, g)
      open.push({
        x: nx,
        y: ny,
        land,
        g,
        f: g + heur(nx, ny, gx, gy),
        parent: cur,
      })
    }
  }
  if (!found) {
    return null
  }
  const path = []
  for (let node = found; node; node = node.parent) {
    path.push({ x: node.x + 0.5, y: node.land, jump: false })
  }
  path.reverse()
  for (let i = 1; i < path.length; i += 1) {
    if (path[i].y - path[i - 1].y > stepH + 0.05) {
      path[i].jump = true
    }
  }
  return path
}
