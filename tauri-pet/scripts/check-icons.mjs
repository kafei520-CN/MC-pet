import { DYE, patternTexture } from '../src/mc/banner-composer.js'
import { bedColorOf } from '../src/mc/bed-composer.js'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_LEATHER_COLOR,
  isEntityItem,
  isGeneratedItem,
  isLeatherArmor,
  isLilyPad,
  itemSpritePaths,
  LILY_PAD_ITEM_COLOR,
  usesItemSprite,
} from '../src/mc/item-shape.js'

function assert(cond, message) {
  if (!cond) {
    throw new Error(message)
  }
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'minecraft')

function loadItem(id) {
  return JSON.parse(readFileSync(join(root, 'models', 'item', `${id}.json`), 'utf8'))
}

function hasItemPng(id) {
  return existsSync(join(root, 'textures', 'item', `${id}.png`))
}

const sprites = ['torch', 'oak_door', 'oak_sign', 'redstone', 'oak_sapling', 'ladder', 'poppy']
for (const id of sprites) {
  assert(isGeneratedItem(loadItem(id)), `${id} should be a generated item icon`)
}
assert(hasItemPng('oak_door'), 'oak_door has item texture')
assert(hasItemPng('oak_sign'), 'oak_sign has item texture')
assert(hasItemPng('redstone'), 'redstone has item texture')
assert(!hasItemPng('torch'), 'torch uses the block texture as a generated layer')

const cubes = ['stone', 'grass_block', 'oak_fence', 'glass', 'bricks']
for (const id of cubes) {
  assert(!isGeneratedItem(loadItem(id)), `${id} should stay a block model`)
  assert(!hasItemPng(id), `${id} has no item texture`)
  assert(!usesItemSprite(loadItem(id), false), `${id} should not use an item sprite`)
}

for (const id of sprites) {
  assert(usesItemSprite(loadItem(id), hasItemPng(id)), `${id} should use an item sprite`)
}

assert(itemSpritePaths('oak_door', loadItem('oak_door'))[0] === 'minecraft/textures/item/oak_door.png', 'oak_door path')
assert(itemSpritePaths('torch', loadItem('torch')).includes('minecraft/textures/block/torch.png'), 'torch uses block layer')
assert(itemSpritePaths('compass', null).includes('minecraft/textures/item/compass_00.png'), 'compass frames')

assert(isEntityItem(loadItem('white_bed')), 'white_bed uses template_bed')
assert(isEntityItem(loadItem('orange_banner')), 'orange_banner uses template_banner')
assert(isEntityItem(loadItem('chest')), 'chest is builtin/entity')
assert(isEntityItem(loadItem('ender_chest')), 'ender_chest uses item/chest')
assert(isEntityItem(loadItem('trapped_chest')), 'trapped_chest uses item/chest')
assert(isEntityItem(loadItem('conduit')), 'conduit is builtin/entity')
assert(isEntityItem(loadItem('decorated_pot')), 'decorated_pot is builtin/entity')
assert(isEntityItem(loadItem('shield')), 'shield is builtin/entity')
assert(isEntityItem(loadItem('shulker_box')), 'shulker_box uses template_shulker_box')
assert(loadItem('template_bed').parent.replace(/^minecraft:/, '') === 'builtin/entity', 'template_bed is builtin/entity')
assert(loadItem('template_banner').parent.replace(/^minecraft:/, '') === 'builtin/entity', 'template_banner is builtin/entity')
assert(!usesItemSprite(loadItem('white_bed'), false), 'bed stays a 3D entity model')
assert(!usesItemSprite(loadItem('orange_banner'), hasItemPng('orange_banner')), 'banner stays a 3D entity model')
assert(isLilyPad('lily_pad') && LILY_PAD_ITEM_COLOR === 0x208030, 'lily pad item color from BlockColors')
assert(isLeatherArmor('leather_chestplate') && DEFAULT_LEATHER_COLOR === 0xa06540, 'leather default DyeableLeatherItem color')
assert(isLeatherArmor('leather_horse_armor'), 'leather horse armor is dyed')
assert(!isLeatherArmor('iron_chestplate'), 'iron is not leather')
assert(loadItem('enchanting_table').parent.replace(/^minecraft:/, '') === 'block/enchanting_table', 'enchanting table uses block model plus book overlay')

assert(bedColorOf('white_bed') === 'white' && bedColorOf('bed') === 'red', 'bed color selects entity/bed texture')
assert(patternTexture('creeper').endsWith('/banner/creeper.png'), 'banner pattern sprite path')
assert(patternTexture('skull').endsWith('/banner/skull.png'), 'skull pattern')
assert(DYE.orange === '#F9801D', 'orange dye')
console.log('icon checks ok')
