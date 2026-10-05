const SKIP = new Set([
  'air',
  'cave_air',
  'void_air',
  'moving_piston',
  'piston_head',
  'bubble_column',
  'nether_portal',
  'end_portal',
  'end_gateway',
  'fire',
  'soul_fire',
])

const COLORS = [
  'white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray',
  'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black',
]

const TABS = [
  { id: 'build', name: '建筑方块', icon: 'bricks' },
  { id: 'color', name: '染色方块', icon: 'cyan_concrete' },
  { id: 'nature', name: '自然方块', icon: 'grass_block' },
  { id: 'functional', name: '功能方块', icon: 'oak_sign' },
  { id: 'redstone', name: '红石', icon: 'redstone' },
  { id: 'all', name: '全部', icon: 'bookshelf' },
  { id: 'pack', name: '背包', icon: 'compass' },
]

function isColor(id) {
  return COLORS.some((color) => id === color || id.startsWith(`${color}_`))
}

function tabId(id) {
  if (isColor(id)) {
    return 'color'
  }
  if (/redstone|piston|observer|hopper|dropper|dispenser|repeater|comparator|lever|button|pressure_plate|rail|daylight|note_block|target|tripwire|sculk_sensor|sculk_shrieker|lightning_rod/.test(id)) {
    return 'redstone'
  }
  if (/chest|barrel|furnace|crafting_table|anvil|bed$|sign$|hanging_sign|lantern|torch|ladder|enchanting|brewing|beacon|shulker_box|campfire|lectern|loom|smoker|blast_furnace|grindstone|stonecutter|cartography|smithing|composter|beehive|bee_nest|jukebox|bell|respawn_anchor|lodestone/.test(id)) {
    return 'functional'
  }
  if (/grass|dirt|sand|gravel|leaves|sapling|moss|vine|flower|mushroom|coral|kelp|seagrass|azalea|podzol|mycelium|nylium|netherrack|soul_|ore$|clay|ice|snow|cactus|sugar_cane|pumpkin|melon|rooted_dirt|mud$|moss_block|dripstone|tuff|calcite/.test(id)) {
    return 'nature'
  }
  if (/planks|log|wood|stem|hyphae|stairs|slab|fence|door|trapdoor|brick|stone|deepslate|sandstone|quartz|copper|prismarine|obsidian|concrete|terracotta|wool|glass|purpur|end_stone|blackstone|basalt|mud_bricks|packed_mud|amethyst_block|bamboo_block|bamboo_planks/.test(id)) {
    return 'build'
  }
  return 'all'
}

export async function loadCreativeTabs() {
  const response = await fetch('/resource-pack/__list?dir=minecraft/blockstates')
  if (!response.ok) {
    return TABS.map((tab) => ({ ...tab, items: [] }))
  }
  const names = await response.json()
  const buckets = Object.fromEntries(TABS.map((tab) => [tab.id, []]))
  for (const name of names) {
    if (!name.endsWith('.json')) {
      continue
    }
    const id = name.slice(0, -'.json'.length)
    if (SKIP.has(id) || id.endsWith('_wall_fan') || id.startsWith('potted_')) {
      continue
    }
    buckets[tabId(id)].push(id)
  }
  for (const tab of TABS) {
    buckets[tab.id].sort()
  }
  return TABS.map((tab) => ({ ...tab, items: buckets[tab.id] ?? [] }))
}
