import { findPath } from '../src/mc/pathfind.js'

function near(value, expected, message) {
  if (Math.abs(value - expected) > 1e-3) {
    throw new Error(`${message}: ${value} != ${expected}`)
  }
}

function floorSupport() {
  return (x, fromY) => (fromY + 0.08 >= 0 ? 0 : -99)
}

const flat = findPath({
  startX: 1,
  startY: 0,
  goalX: 6,
  goalY: 0,
  hw: 0.3,
  hh: 1.8,
  solids: [],
  supportAt: floorSupport(),
})
if (!flat || flat.length < 5) {
  throw new Error(`flat path too short ${flat && flat.length}`)
}
near(flat[0].x, 1.5, 'flat path starts on the start cell')
near(flat[flat.length - 1].x, 6.5, 'flat path ends on the goal cell')

const wall = [{ minX: 3, maxX: 4, minY: 0, maxY: 1, minZ: 0, maxZ: 1 }]
function wallSupport(x, fromY) {
  let best = 0
  if (x > 3 && x < 4 && 1 <= fromY + 0.08) {
    best = 1
  }
  return best
}
const over = findPath({
  startX: 1,
  startY: 0,
  goalX: 6,
  goalY: 0,
  hw: 0.3,
  hh: 1.8,
  solids: wall,
  supportAt: wallSupport,
})
if (!over) {
  throw new Error('expected a path over a 1-block wall')
}
if (!over.some((node) => node.y >= 0.9 || node.jump)) {
  throw new Error('path did not step or jump the wall')
}

const tower = [{ minX: 3, maxX: 4, minY: 0, maxY: 3, minZ: 0, maxZ: 1 }]
function towerSupport(x, fromY) {
  if (x > 3 && x < 4 && 3 <= fromY + 0.08) {
    return 3
  }
  return 0
}
const blocked = findPath({
  startX: 1,
  startY: 0,
  goalX: 6,
  goalY: 0,
  hw: 0.3,
  hh: 1.8,
  solids: tower,
  supportAt: towerSupport,
})
if (blocked && blocked.some((node) => node.x > 3.2 && node.x < 3.8 && node.y < 2.5)) {
  throw new Error('path walked through a tall wall')
}

console.log('pathfind ok')
