import { bareId, hasNoCollision, isTorch } from './ids.js'

const TIER_SPEED = {
  wooden: 2,
  stone: 4,
  iron: 6,
  golden: 12,
  diamond: 8,
  netherite: 9,
}

function toolInfo(id) {
  const name = bareId(id)
  if (!name) {
    return null
  }
  if (name === 'shears') {
    return { kind: 'shears', speed: 5 }
  }
  const match = /^(wooden|stone|iron|golden|diamond|netherite)_(pickaxe|axe|shovel|hoe|sword)$/.exec(name)
  if (!match) {
    return null
  }
  return { kind: match[2], speed: TIER_SPEED[match[1]] }
}

function harvestKind(id) {
  const name = bareId(id)
  if (!name) {
    return 'hand'
  }
  if (name === 'obsidian' || name === 'crying_obsidian' || name === 'respawn_anchor') {
    return 'pickaxe'
  }
  if (name.includes('_ore') || name.endsWith('_block') && (name.includes('iron') || name.includes('gold') || name.includes('diamond') || name.includes('emerald') || name.includes('netherite') || name.includes('copper') || name.includes('coal') || name.includes('lapis') || name.includes('redstone'))) {
    return 'pickaxe'
  }
  if (name === 'stone' || name === 'cobblestone' || name === 'mossy_cobblestone' || name === 'andesite' || name === 'diorite' || name === 'granite' || name === 'deepslate' || name === 'tuff' || name === 'calcite' || name === 'dripstone_block' || name === 'netherrack' || name === 'basalt' || name === 'blackstone' || name === 'end_stone' || name.includes('bricks') || name.includes('stone_brick') || name.includes('sandstone') || name.includes('terracotta') || name.includes('concrete') && !name.includes('powder') || name.includes('prismarine') || name === 'obsidian' || name.includes('anvil') || name === 'furnace' || name === 'blast_furnace' || name === 'smoker' || name === 'dispenser' || name === 'dropper' || name === 'observer' || name === 'hopper' || name === 'iron_bars' || name === 'iron_door' || name === 'iron_trapdoor' || name.endsWith('_wall') || name === 'spawner') {
    return 'pickaxe'
  }
  if (name === 'dirt' || name === 'grass_block' || name === 'coarse_dirt' || name === 'podzol' || name === 'mycelium' || name === 'dirt_path' || name === 'farmland' || name === 'sand' || name === 'red_sand' || name === 'gravel' || name === 'clay' || name === 'soul_sand' || name === 'soul_soil' || name === 'mud' || name.includes('snow') || name === 'powder_snow') {
    return 'shovel'
  }
  if (name.includes('_log') || name.includes('_wood') || name.includes('_stem') || name.includes('_hyphae') || name.endsWith('_planks') || name.includes('_fence') || name === 'chest' || name === 'trapped_chest' || name === 'barrel' || name === 'crafting_table' || name === 'note_block' || name === 'bookshelf' || name === 'lectern' || name === 'loom' || name === 'cartography_table' || name === 'fletching_table' || name === 'smithing_table' || name === 'composter' || name === 'ladder' || name === 'melon' || name === 'pumpkin' || name === 'carved_pumpkin' || name === 'jack_o_lantern' || name.includes('_sign') || name.endsWith('_door') && !name.startsWith('iron_') || name.endsWith('_trapdoor') && !name.startsWith('iron_')) {
    return 'axe'
  }
  if (name.endsWith('_leaves') || name === 'hay_block' || name === 'target' || name === 'nether_wart_block' || name === 'warped_wart_block' || name === 'shroomlight' || name === 'sculk' || name === 'moss_block') {
    return 'hoe'
  }
  if (name.endsWith('_wool') || name === 'cobweb') {
    return 'shears'
  }
  return 'hand'
}

export function hardness(id) {
  const name = bareId(id)
  if (!name || name === 'air' || name === 'cave_air' || name === 'void_air') {
    return 0
  }
  if (name === 'bedrock' || name === 'barrier' || name === 'command_block' || name.endsWith('_command_block') || name === 'end_portal' || name === 'end_gateway' || name === 'end_portal_frame' || name === 'structure_void' || name === 'jigsaw' || name === 'light') {
    return Infinity
  }
  if (hasNoCollision(name) || isTorch(name)) {
    return 0
  }
  if (name === 'obsidian' || name === 'crying_obsidian' || name === 'netherite_block') {
    return 50
  }
  if (name === 'ancient_debris') {
    return 30
  }
  if (name === 'ender_chest') {
    return 22.5
  }
  if (name.includes('anvil')) {
    return 5
  }
  if (name === 'iron_block' || name === 'diamond_block' || name === 'emerald_block' || name === 'redstone_block' || name === 'coal_block' || name === 'lapis_block') {
    return 5
  }
  if (name === 'gold_block' || name === 'copper_block' || name.endsWith('_copper')) {
    return 3
  }
  if (name === 'furnace' || name === 'blast_furnace' || name === 'smoker' || name === 'dispenser' || name === 'dropper') {
    return 3.5
  }
  if (name.includes('_ore')) {
    return name.includes('ancient') ? 30 : 3
  }
  if (name === 'chest' || name === 'trapped_chest' || name === 'barrel' || name === 'crafting_table' || name === 'cartography_table' || name === 'fletching_table' || name === 'smithing_table' || name === 'loom' || name === 'lectern') {
    return 2.5
  }
  if (name.includes('_log') || name.includes('_wood') || name.includes('_stem') || name.includes('_hyphae') || name.endsWith('_planks') || name.includes('_fence') || name.endsWith('_door') || name.endsWith('_trapdoor') || name.endsWith('_stairs') || name.endsWith('_slab') && !name.includes('stone') && !name.includes('brick') && !name.includes('quartz') && !name.includes('sandstone') && !name.includes('deepslate') && !name.includes('blackstone') && !name.includes('prismarine') && !name.includes('nether') && !name.includes('end_stone') && !name.includes('purpur') && !name.includes('cut_copper')) {
    return 2
  }
  if (name.endsWith('_leaves') || name.includes('vine') || name === 'glow_lichen') {
    return 0.2
  }
  if (name.includes('glass') || name === 'ice' || name === 'frosted_ice' || name === 'glowstone') {
    return 0.3
  }
  if (name === 'netherrack' || name === 'nylium' || name.endsWith('_nylium')) {
    return 0.4
  }
  if (name === 'dirt' || name === 'grass_block' || name === 'coarse_dirt' || name === 'podzol' || name === 'mycelium' || name === 'dirt_path' || name === 'farmland' || name === 'sand' || name === 'red_sand' || name === 'gravel' || name === 'clay' || name === 'soul_sand' || name === 'soul_soil' || name === 'mud' || name === 'packed_mud') {
    return 0.5
  }
  if (name.endsWith('_wool') || name.endsWith('_carpet') || name === 'cactus' || name === 'pumpkin' || name === 'melon' || name.includes('sandstone')) {
    return 0.8
  }
  if (name === 'snow' || name === 'snow_block' || name === 'powder_snow') {
    return 0.2
  }
  if (name === 'cobweb') {
    return 4
  }
  return 1.5
}

export function mineRate(blockId, toolId) {
  const hard = hardness(blockId)
  if (hard <= 0) {
    return Infinity
  }
  if (!Number.isFinite(hard)) {
    return 0
  }
  const tool = toolInfo(toolId)
  const need = harvestKind(blockId)
  let speed = 1
  let canHarvest = need !== 'pickaxe'
  if (tool?.kind === need) {
    speed = tool.speed
    canHarvest = true
  } else if (tool?.kind === 'shears' && (need === 'shears' || bareId(blockId).endsWith('_leaves'))) {
    speed = bareId(blockId) === 'cobweb' ? 15 : 5
    canHarvest = true
  } else if (tool?.kind === 'sword') {
    speed = 1.5
  }
  const factor = canHarvest ? 1.5 : 5
  return speed / (hard * factor)
}

export function mineStage(progress) {
  if (progress <= 0) {
    return -1
  }
  return Math.max(0, Math.min(9, Math.floor(progress * 10)))
}

export function isCombatWeapon(id) {
  const name = bareId(id)
  return name.endsWith('_sword') || name === 'trident' || name === 'bow' || name === 'crossbow'
}

export function pickMineLayer(get, x, y, frontZ = 1, backZ = 0) {
  const front = get(x, y, frontZ)
  if (front?.id) {
    return { x, y, z: frontZ, id: front.id }
  }
  const back = get(x, y, backZ)
  if (back?.id) {
    return { x, y, z: backZ, id: back.id }
  }
  return null
}
