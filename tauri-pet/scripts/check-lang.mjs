import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

function assert(cond, message) {
  if (!cond) {
    throw new Error(message)
  }
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'minecraft', 'lang')
const zh = JSON.parse(readFileSync(join(root, 'zh_cn.json'), 'utf8'))
const keys = Object.keys(zh)
assert(keys.every((key) => key.startsWith('block.minecraft.') || key.startsWith('item.minecraft.')), 'zh keys are vanilla lang ids')
assert(new Set(keys).size === keys.length, 'no duplicate keys')
assert(zh['block.minecraft.cobblestone_stairs'] === '圆石楼梯', zh['block.minecraft.cobblestone_stairs'])
assert(zh['block.minecraft.stone'] === '石头', zh['block.minecraft.stone'])
assert(zh['item.minecraft.creeper_spawn_egg'] === '苦力怕生成蛋', zh['item.minecraft.creeper_spawn_egg'])
assert(zh['block.minecraft.acacia_slab'] === '金合欢木台阶', zh['block.minecraft.acacia_slab'])
assert(zh['block.minecraft.acacia_fence'] === '金合欢木栅栏', zh['block.minecraft.acacia_fence'])
console.log('lang checks ok', keys.length)
