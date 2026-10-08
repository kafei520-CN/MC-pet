import { itemStack, maxStackSize, mergeInto, stackCount, stackRoom } from '../src/mc/item-stack.js'
import { normalizeStack } from '../src/mc/stations.js'

function assert(ok, message) {
  if (!ok) {
    throw new Error(message)
  }
}

assert(maxStackSize('dirt') === 64, 'dirt stacks to 64')
assert(maxStackSize('minecraft:cobblestone') === 64, 'namespaced dirt-like blocks stack to 64')
assert(maxStackSize('ender_pearl') === 16, 'ender pearls stack to 16')
assert(maxStackSize('snowball') === 16, 'snowballs stack to 16')
assert(maxStackSize('egg') === 16, 'eggs stack to 16')
assert(maxStackSize('bucket') === 16, 'empty buckets stack to 16')
assert(maxStackSize('oak_sign') === 16, 'signs stack to 16')
assert(maxStackSize('white_banner') === 16, 'banners stack to 16')
assert(maxStackSize('honey_bottle') === 16, 'honey bottles stack to 16')
assert(maxStackSize('wooden_sword') === 1, 'swords do not stack')
assert(maxStackSize('diamond_pickaxe') === 1, 'tools do not stack')
assert(maxStackSize('iron_chestplate') === 1, 'armor does not stack')
assert(maxStackSize('oak_boat') === 1, 'boats do not stack')
assert(maxStackSize('water_bucket') === 1, 'filled buckets do not stack')
assert(maxStackSize('potion') === 1, 'potions do not stack')
assert(maxStackSize('white_bed') === 1, 'beds do not stack')
assert(maxStackSize('shulker_box') === 1, 'shulker boxes do not stack')
assert(maxStackSize('music_disc_cat') === 1, 'discs do not stack')

assert(itemStack('ender_pearl', 99).count === 16, 'itemStack clamps pearls to 16')
assert(itemStack('bow', 8).count === 1, 'itemStack clamps bows to 1')
assert(itemStack('dirt', 80).count === 64, 'itemStack clamps dirt to 64')
assert(normalizeStack({ id: 'snowball', count: 40 }).count === 16, 'normalizeStack uses max stack')

const merged = mergeInto({ id: 'snowball', count: 10 }, { id: 'snowball', count: 10 })
assert(merged.dest.count === 16 && merged.leftover.count === 4, '16-stack leftover')
const full = mergeInto({ id: 'diamond_sword', count: 1 }, { id: 'diamond_sword', count: 1 })
assert(full.dest.count === 1 && full.leftover.count === 1, 'unstackable does not merge')
assert(stackRoom({ id: 'dirt', count: 10 }) === 54, 'dirt room')
assert(stackCount({ id: 'egg', count: 99 }) === 16, 'stackCount clamps')

console.log('stack ok')
