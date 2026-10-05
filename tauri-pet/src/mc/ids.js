export function bareId(id) {
  if (!id) {
    return ''
  }
  const text = String(id).trim().toLowerCase()
  return text.startsWith('minecraft:') ? text.slice(10) : text
}

export function isFluid(id) {
  const name = bareId(id)
  return name === 'water' || name === 'lava' || name === 'flowing_water' || name === 'flowing_lava' || name === 'bubble_column'
}

export function fluidKind(id) {
  const name = bareId(id)
  if (name === 'lava' || name === 'flowing_lava') {
    return 'lava'
  }
  if (name === 'water' || name === 'flowing_water' || name === 'bubble_column') {
    return 'water'
  }
  return null
}

export function isFence(id) {
  const name = bareId(id)
  return name.endsWith('_fence') && !name.endsWith('_fence_gate')
}

export function isFenceGate(id) {
  return bareId(id).endsWith('_fence_gate')
}

export function isWall(id) {
  const name = bareId(id)
  return name.endsWith('_wall') && name !== 'piston_head'
}

export function isPane(id) {
  const name = bareId(id)
  return name === 'iron_bars' || name === 'glass_pane' || name.endsWith('_glass_pane')
}

export function isStairs(id) {
  return bareId(id).endsWith('_stairs')
}

export function isSlab(id) {
  return bareId(id).endsWith('_slab')
}

export function isDoor(id) {
  return bareId(id).endsWith('_door')
}

export function isTrapdoor(id) {
  return bareId(id).endsWith('_trapdoor')
}

export function isBed(id) {
  return bareId(id).endsWith('_bed')
}

export function isChest(id) {
  const name = bareId(id)
  return name === 'chest' || name === 'trapped_chest' || name === 'ender_chest' || name.endsWith('_chest')
}

export function isTorch(id) {
  const name = bareId(id)
  return name === 'torch' || name === 'soul_torch' || name === 'redstone_torch' || name.endsWith('_torch')
}

export function isCarpet(id) {
  return bareId(id).endsWith('_carpet')
}

export function isPressurePlate(id) {
  return bareId(id).endsWith('_pressure_plate') || bareId(id) === 'heavy_weighted_pressure_plate' || bareId(id) === 'light_weighted_pressure_plate'
}

export function isButton(id) {
  return bareId(id).endsWith('_button')
}

export function isSign(id) {
  const name = bareId(id)
  return name.endsWith('_sign') || name.endsWith('_hanging_sign') || name.endsWith('_wall_sign') || name.endsWith('_wall_hanging_sign')
}

export function isHead(id) {
  const name = bareId(id)
  return name.endsWith('_head') || name.endsWith('_skull') || name === 'player_head' || name === 'player_wall_head'
}

export function isTallPlant(id) {
  const name = bareId(id)
  return name === 'sunflower' || name === 'lilac' || name === 'rose_bush' || name === 'peony' || name === 'tall_grass' || name === 'large_fern' || name === 'pitcher_plant' || name === 'tall_seagrass'
}

export function isPiston(id) {
  const name = bareId(id)
  return name === 'piston' || name === 'sticky_piston'
}

const NO_COLLISION = new Set([
  'air', 'cave_air', 'void_air', 'light', 'structure_void', 'fire', 'soul_fire',
  'nether_portal', 'end_portal', 'end_gateway', 'water', 'lava', 'bubble_column',
  'grass', 'fern', 'dead_bush', 'seagrass', 'kelp', 'kelp_plant', 'sugar_cane',
  'wheat', 'carrots', 'potatoes', 'beetroots', 'nether_wart', 'cocoa',
  'sweet_berry_bush', 'torchflower_crop', 'pitcher_crop', 'cave_vines',
  'cave_vines_plant', 'twisting_vines', 'twisting_vines_plant', 'weeping_vines',
  'weeping_vines_plant', 'vine', 'glow_lichen', 'sculk_vein', 'redstone_wire',
  'tripwire', 'rail', 'powered_rail', 'detector_rail', 'activator_rail',
  'lever', 'repeater', 'comparator', 'redstone_torch', 'soul_torch', 'torch',
  'wall_torch', 'redstone_wall_torch', 'soul_wall_torch', 'flower_pot',
  'cobweb', 'powder_snow',
])

const NO_COLLISION_SUFFIX = [
  '_sapling', '_fungus', '_roots', '_sprouts', '_orchid', '_tulip', '_bluet',
  '_daisy', '_poppy', '_dandelion', '_allium', '_lilac', '_rose_bush', '_peony',
  '_sunflower', '_banner', '_wall_banner',
  '_coral_fan', '_coral_wall_fan',
]

const FLOWER = new Set([
  'dandelion', 'poppy', 'blue_orchid', 'allium', 'azure_bluet', 'red_tulip',
  'orange_tulip', 'white_tulip', 'pink_tulip', 'oxeye_daisy', 'cornflower',
  'lily_of_the_valley', 'wither_rose', 'torchflower', 'pitcher_plant',
  'pink_petals', 'spore_blossom', 'lily_pad', 'brown_mushroom', 'red_mushroom',
  'crimson_fungus', 'warped_fungus', 'crimson_roots', 'warped_roots',
  'nether_sprouts', 'hanging_roots', 'moss_carpet', 'short_grass', 'tall_grass',
  'large_fern', 'sunflower', 'lilac', 'rose_bush', 'peony',
])

export function hasNoCollision(id) {
  const name = bareId(id)
  if (NO_COLLISION.has(name) || FLOWER.has(name) || isTorch(name)) {
    return true
  }
  return NO_COLLISION_SUFFIX.some((end) => name.endsWith(end))
}

export function isFullSolid(id, properties = {}) {
  const name = bareId(id)
  if (!name || hasNoCollision(name) || isFluid(name)) {
    return false
  }
  if (isFence(name) || isFenceGate(name) || isWall(name) || isPane(name) || isStairs(name) || isSlab(name) || isDoor(name) || isTrapdoor(name) || isBed(name) || isChest(name) || isCarpet(name) || isSign(name) || isHead(name) || isTorch(name) || isButton(name) || isPressurePlate(name)) {
    return false
  }
  if (name === 'snow' && Number(properties.layers ?? 1) < 8) {
    return false
  }
  if (name === 'soul_sand' || name === 'farmland' || name === 'dirt_path' || name === 'grass_path') {
    return false
  }
  return true
}

export function canConnectFence(id, properties) {
  const name = bareId(id)
  if (isFence(name) || isWall(name) || isPane(name)) {
    return true
  }
  if (isFenceGate(name)) {
    return true
  }
  return isFullSolid(name, properties)
}

export const FACING_OFFSET = {
  east: { x: 1, y: 0 },
  west: { x: -1, y: 0 },
  south: { x: 0, y: 0, z: 1 },
  north: { x: 0, y: 0, z: -1 },
  up: { x: 0, y: 1 },
  down: { x: 0, y: -1 },
}

export function opposite(facing) {
  return { east: 'west', west: 'east', south: 'north', north: 'south', up: 'down', down: 'up' }[facing] ?? facing
}

export function rotateY(facing, dir) {
  const order = ['north', 'east', 'south', 'west']
  const index = order.indexOf(facing)
  if (index < 0) {
    return facing
  }
  return order[(index + dir + 4) % 4]
}
