import tabs from '../src/mc/data/creative-tabs-1.20.1.json' with { type: 'json' }

function assert(cond, message) {
  if (!cond) {
    throw new Error(message)
  }
}

assert(tabs.building_blocks[0] === 'oak_log', tabs.building_blocks[0])
assert(tabs.building_blocks[1] === 'oak_wood', 'oak set order')
assert(tabs.building_blocks.includes('cobblestone_stairs'), 'cobblestone stairs in building')
assert(!tabs.building_blocks.includes('iron_boots'), 'armor not in building')
assert(tabs.combat.includes('iron_boots'), 'boots in combat')
assert(tabs.colored_blocks[0] === 'white_wool', tabs.colored_blocks[0])
assert(tabs.natural_blocks[0] === 'grass_block', tabs.natural_blocks[0])
assert(tabs.redstone_blocks[0] === 'redstone', tabs.redstone_blocks[0])
assert(tabs.functional_blocks[0] === 'torch', tabs.functional_blocks[0])
console.log('creative tab dump ok', Object.fromEntries(Object.entries(tabs).map(([k, v]) => [k, v.length])))
