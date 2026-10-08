import { bareId, isBed, isSign } from './ids.js'

const STACK_16 = new Set([
  'snowball',
  'egg',
  'ender_pearl',
  'bucket',
  'honey_bottle',
])

const UNSTACKABLE = new Set([
  'bow',
  'crossbow',
  'trident',
  'shield',
  'elytra',
  'shears',
  'flint_and_steel',
  'fishing_rod',
  'carrot_on_a_stick',
  'warped_fungus_on_a_stick',
  'spyglass',
  'totem_of_undying',
  'saddle',
  'armor_stand',
  'cake',
  'enchanted_book',
  'writable_book',
  'written_book',
  'goat_horn',
  'knowledge_book',
  'debug_stick',
  'bundle',
  'brush',
  'mushroom_stew',
  'rabbit_stew',
  'beetroot_soup',
  'suspicious_stew',
  'filled_map',
  'minecart',
])

function stack16ByName(name) {
  if (STACK_16.has(name)) {
    return true
  }
  if (name.endsWith('_banner') && !name.includes('wall')) {
    return true
  }
  if (isSign(name) && !name.includes('wall')) {
    return true
  }
  return false
}

function unstackableByName(name) {
  if (UNSTACKABLE.has(name)) {
    return true
  }
  if (name.endsWith('_sword') || name.endsWith('_pickaxe') || name.endsWith('_axe') || name.endsWith('_shovel') || name.endsWith('_hoe')) {
    return true
  }
  if (name.endsWith('_helmet') || name.endsWith('_chestplate') || name.endsWith('_leggings') || name.endsWith('_boots')) {
    return true
  }
  if (name.endsWith('_horse_armor') || name === 'wolf_armor') {
    return true
  }
  if (name.endsWith('_boat')) {
    return true
  }
  if (isBed(name)) {
    return true
  }
  if (name === 'shulker_box' || name.endsWith('_shulker_box')) {
    return true
  }
  if (name.endsWith('_bucket') && name !== 'bucket') {
    return true
  }
  if (name.endsWith('_minecart')) {
    return true
  }
  if (name.startsWith('music_disc_')) {
    return true
  }
  if (name === 'potion' || name.endsWith('_potion')) {
    return true
  }
  return false
}

export function maxStackSize(id) {
  const name = bareId(typeof id === 'string' || !id ? id : id.id)
  if (!name) {
    return 0
  }
  if (unstackableByName(name)) {
    return 1
  }
  if (stack16ByName(name)) {
    return 16
  }
  return 64
}

export function itemStack(id, count = 1) {
  const name = bareId(id)
  if (!name) {
    return null
  }
  const max = maxStackSize(name)
  const n = Math.max(1, Math.min(max, Math.floor(Number(count) || 1)))
  return { id: name, count: n }
}

export function stackId(stack) {
  if (!stack) {
    return ''
  }
  if (typeof stack === 'string') {
    return bareId(stack)
  }
  return bareId(stack.id)
}

export function stackCount(stack) {
  if (!stack) {
    return 0
  }
  if (typeof stack === 'string') {
    return 1
  }
  const max = maxStackSize(stack)
  return Math.max(1, Math.min(max, Math.floor(Number(stack.count) || 1)))
}

export function sameStack(a, b) {
  const id = stackId(a)
  return Boolean(id) && id === stackId(b)
}

export function stackRoom(stack) {
  if (!stack) {
    return 0
  }
  return Math.max(0, maxStackSize(stack) - stackCount(stack))
}

export function asStack(value) {
  if (!value) {
    return null
  }
  if (typeof value === 'string') {
    return itemStack(value, 1)
  }
  return itemStack(value.id, value.count)
}

export function mergeInto(dest, src) {
  const incoming = asStack(src)
  if (!incoming) {
    return { dest: asStack(dest), leftover: null }
  }
  const current = asStack(dest)
  if (!current) {
    return { dest: incoming, leftover: null }
  }
  if (!sameStack(current, incoming)) {
    return { dest: current, leftover: incoming }
  }
  const max = maxStackSize(current)
  const total = current.count + incoming.count
  if (total <= max) {
    return { dest: { id: current.id, count: total }, leftover: null }
  }
  return {
    dest: { id: current.id, count: max },
    leftover: { id: incoming.id, count: total - max },
  }
}
