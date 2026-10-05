globalThis.window = { innerWidth: 1600, innerHeight: 900 }

const { choosePlaceStand } = await import('../src/mc/place-tree.js')
const { parseSchematic } = await import('../src/mc/build.js')
const schematic = (await import('../src/mc/schematic.json', { with: { type: 'json' } })).default
const blocks = parseSchematic(schematic)
const world = new Map()

function key(x, y, z) {
  return `${x},${y},${z}`
}

function getLayer(z) {
  return (x, y) => world.get(key(Math.floor(x), Math.floor(y), z)) ?? null
}

let feet = { x: 2.25, y: 0 }
const dropped = []
const placed = []

for (const block of blocks) {
  let plan = null
  for (let attempt = 0; attempt < 3 && !plan; attempt += 1) {
    plan = choosePlaceStand({
      feet,
      block,
      getBlock: getLayer(block.z ?? 0),
      getSupport: getLayer(1),

    })
    if (!plan && attempt < 2) {
      // other blocks would be tried; this sim retries immediately
    }
  }
  if (!plan) {
    dropped.push(`${block.id}@${block.x},${block.y},z${block.z}`)
    continue
  }
  feet = { x: plan.stand.x, y: plan.stand.y }
  world.set(key(block.x, block.y, block.z ?? 0), { id: block.id, properties: block.properties ?? {} })
  placed.push(`${block.id}@${block.x},${block.y},z${block.z} -> ${plan.stand.x},${plan.stand.y} move=${plan.move}`)
}

console.log('placed', placed.length, 'dropped', dropped.length)
console.log(dropped.join('\n') || 'none dropped')
console.log('--- last stands ---')
console.log(placed.slice(-12).join('\n'))
