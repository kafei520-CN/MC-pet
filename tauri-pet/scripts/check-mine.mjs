import { hardness, mineRate, mineStage, pickMineLayer } from '../src/mc/hardness.js'

function assert(ok, message) {
  if (!ok) {
    throw new Error(message)
  }
}

assert(hardness('torch') === 0, 'torch is instant')
assert(!Number.isFinite(hardness('bedrock')), 'bedrock does not break')
assert(hardness('dirt') === 0.5, 'dirt hardness')
assert(hardness('stone') === 1.5, 'stone hardness')
assert(hardness('obsidian') === 50, 'obsidian hardness')

assert(mineRate('torch') === Infinity, 'torch mines instantly')
assert(mineRate('bedrock') === 0, 'bedrock cannot mine')

const dirtFist = mineRate('dirt')
const dirtShovel = mineRate('dirt', 'iron_shovel')
assert(dirtFist > 1 && dirtFist < 1.5, `dirt by hand ~0.75s, rate=${dirtFist}`)
assert(dirtShovel > dirtFist, 'shovel mines dirt faster')

const stoneFist = mineRate('stone')
const stonePick = mineRate('stone', 'stone_pickaxe')
assert(stoneFist < 0.2, `stone by hand is slow, rate=${stoneFist}`)
assert(stonePick > stoneFist, 'pickaxe mines stone faster')

const obsidianDiamond = mineRate('obsidian', 'diamond_pickaxe')
assert(obsidianDiamond > 0.08 && obsidianDiamond < 0.15, `obsidian with diamond ~9s, rate=${obsidianDiamond}`)

assert(mineStage(0) === -1, 'no cracks before progress')
assert(mineStage(0.05) === 0, 'first crack')
assert(mineStage(0.95) === 9, 'last crack')
assert(mineStage(1) === 9, 'full crack before break')

const cells = {
  '2,3,1': { id: 'grass_block' },
  '2,3,0': { id: 'oak_planks' },
  '4,1,0': { id: 'stone' },
}
const get = (x, y, z) => cells[`${x},${y},${z}`] ?? null
const covered = pickMineLayer(get, 2, 3)
assert(covered.z === 1 && covered.id === 'grass_block', 'front layer is mined first')
const openBack = pickMineLayer(get, 4, 1)
assert(openBack.z === 0 && openBack.id === 'stone', 'back layer mines when the front is empty')
assert(pickMineLayer(get, 0, 0) == null, 'empty cell has no mine target')

console.log('mine ok')
