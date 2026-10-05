import tabItems from './data/creative-tabs-1.20.1.json'
import { itemStack } from './item-stack.js'

const TABS = [
  { id: 'building_blocks', name: '建筑方块', icon: 'bricks', row: 'top' },
  { id: 'colored_blocks', name: '染色方块', icon: 'cyan_terracotta', row: 'top' },
  { id: 'natural_blocks', name: '自然方块', icon: 'grass_block', row: 'top' },
  { id: 'functional_blocks', name: '功能方块', icon: 'oak_sign', row: 'top' },
  { id: 'redstone_blocks', name: '红石', icon: 'redstone', row: 'top' },
  { id: 'search', name: '搜索物品', icon: 'compass', row: 'top', align: 'right' },
  { id: 'tools_and_utilities', name: '工具与实用物品', icon: 'diamond_pickaxe', row: 'bottom' },
  { id: 'combat', name: '战斗', icon: 'netherite_sword', row: 'bottom' },
  { id: 'food_and_drinks', name: '食物与饮品', icon: 'golden_apple', row: 'bottom' },
  { id: 'ingredients', name: '原材料', icon: 'iron_ingot', row: 'bottom' },
  { id: 'spawn_eggs', name: '刷怪蛋', icon: 'pig_spawn_egg', row: 'bottom' },
]

async function listJson(dir) {
  try {
    const response = await fetch(`/resource-pack/__list?dir=${encodeURIComponent(dir)}`)
    if (!response.ok) {
      return []
    }
    const names = await response.json()
    return Array.isArray(names) ? names : []
  } catch {
    return []
  }
}

function fileId(name) {
  return name.endsWith('.json') ? name.slice(0, -'.json'.length) : ''
}

export async function loadCreativeTabs() {
  const [blocks, items] = await Promise.all([
    listJson('minecraft/blockstates'),
    listJson('minecraft/models/item'),
  ])
  const have = new Set()
  for (const name of blocks) {
    const id = fileId(name)
    if (id) {
      have.add(id)
    }
  }
  for (const name of items) {
    const id = fileId(name)
    if (id) {
      have.add(id)
    }
  }
  return TABS.map((meta) => ({
    ...meta,
    items: (tabItems[meta.id] ?? [])
      .filter((id) => have.has(id))
      .map((id) => itemStack(id, 1)),
  }))
}
