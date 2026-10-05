import { canPlace, choosePlaceStand, rayReaches } from '../src/mc/place-tree.js'

function world(solids) {
  const set = new Set(solids)
  return (x, y) => (set.has(`${x},${y}`) ? { id: 'stone', properties: {} } : null)
}

function assert(cond, message) {
  if (!cond) {
    throw new Error(message)
  }
}

const ground = []
for (let x = 0; x <= 12; x += 1) {
  ground.push(`${x},0`)
}
const flat = world(ground)

assert(rayReaches(flat, 7.5, 2.62, 4.5, 1.5), 'open ray')
assert(!rayReaches(world([...ground, '6,1']), 8.5, 2.62, 4.5, 1.5), 'wall blocks ray')

const beside = choosePlaceStand({
  feet: { x: 10.5, y: 1 },
  block: { x: 4, y: 1, z: 0 },
  getBlock: flat,
  getSupport: flat,
})
assert(beside?.move === true, 'walk toward the block')
assert(beside.stand.x > 4.5, `stand on the right, got ${beside.stand.x}`)
assert(beside.stand.y === 1, 'stay on the same floor')

const stay = choosePlaceStand({
  feet: { x: beside.stand.x, y: 1 },
  block: { x: 4, y: 1, z: 0 },
  getBlock: flat,
  getSupport: flat,
})
assert(stay?.move === false, 'clear ground beside the block can place')

const buried = choosePlaceStand({
  feet: { x: 5.5, y: 0 },
  block: { x: 6, y: 1, z: 0 },
  getBlock: flat,
  getSupport: flat,
})
assert(buried?.move === true, 'leave a spot inside the ground')
assert(buried.stand.y >= 1, `stand on top of the ground, got ${buried?.stand?.y}`)

const upper = []
for (let x = 0; x <= 8; x += 1) {
  upper.push(`${x},0`, `${x},1`)
}
const high = world(upper)
const fromDeck = choosePlaceStand({
  feet: { x: 5.5, y: 2 },
  block: { x: 5, y: 0, z: 0 },
  getBlock: () => null,
  getSupport: high,
})
assert(fromDeck?.move === false, 'second floor reaches the first floor in place')
assert(canPlace({ x: 5.5, y: 2 }, { x: 5, y: 0 }, () => null), 'reach from above')

const far = choosePlaceStand({
  feet: { x: 12.5, y: 1 },
  block: { x: 0, y: 1, z: 0 },
  getBlock: flat,
  getSupport: flat,
})
assert(far == null || far.stand.x <= 4.5 + 4, 'stand stays inside 4 blocks')
if (far) {
  assert(canPlace(far.stand, { x: 0, y: 1 }, flat), 'chosen stand can raycast')
}

console.log('place checks ok', beside.stand, fromDeck, buried.stand)
