import path from 'path'
import { fileURLToPath } from 'url'
import tabs from '../src/mc/data/creative-tabs-1.20.1.json' with { type: 'json' }
import { buildPackIndex, listFromIndex } from './pack-index.mjs'

function assert(cond, message) {
  if (!cond) {
    throw new Error(message)
  }
}

function ids(names) {
  return names
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -'.json'.length))
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../assets')
const index = buildPackIndex(root)
const have = new Set([
  ...ids(listFromIndex(index, 'minecraft/blockstates')),
  ...ids(listFromIndex(index, 'minecraft/models/item')),
])
const building = tabs.building_blocks.filter((id) => have.has(id))

assert(listFromIndex(index, 'assets').includes('minecraft'), 'assets root')
assert(building.length > 200, `building filtered to ${building.length}`)
assert(building[0] === 'oak_log', building[0])
assert(
  listFromIndex(index, 'assets/minecraft/textures/item').some((name) => name.endsWith('.png')),
  'item pngs',
)
assert(listFromIndex(index, 'minecraft/recipes').some((name) => name.endsWith('.json')), 'recipes')
assert(listFromIndex(index, 'assets/minecraft/atlases').includes('blocks.json'), 'atlases')
console.log('pack index ok', {
  dirs: Object.keys(index).length,
  building: building.length,
  have: have.size,
})
