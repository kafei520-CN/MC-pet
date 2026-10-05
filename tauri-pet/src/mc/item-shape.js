export const LILY_PAD_ITEM_COLOR = 0x208030
export const DEFAULT_LEATHER_COLOR = 0xa06540

const ENTITY_PARENTS = new Set([
  'builtin/entity',
  'item/template_bed',
  'item/template_banner',
  'item/chest',
  'item/template_shulker_box',
])

const LEATHER_IDS = new Set([
  'leather_helmet',
  'leather_chestplate',
  'leather_leggings',
  'leather_boots',
  'leather_horse_armor',
])

export function isGeneratedItem(model) {
  const parent = String(model?.parent ?? '').replace(/^minecraft:/, '')
  return parent === 'item/generated'
    || parent === 'item/handheld'
    || parent === 'item/handheld_rod'
    || parent === 'item/template_shovel'
    || parent === 'item/template_spawn_egg'
    || parent === 'builtin/generated'
    || parent.startsWith('item/handheld')
}

export function isEntityItem(model) {
  const parent = String(model?.parent ?? '').replace(/^minecraft:/, '')
  return ENTITY_PARENTS.has(parent)
}

export function isLilyPad(id) {
  return String(id ?? '').replace(/^minecraft:/, '') === 'lily_pad'
}

export function isLeatherArmor(id) {
  return LEATHER_IDS.has(String(id ?? '').replace(/^minecraft:/, ''))
}

export function usesItemSprite(model, hasItemTexture) {
  if (isEntityItem(model)) {
    return false
  }
  if (hasItemTexture) {
    return true
  }
  if (isGeneratedItem(model)) {
    return true
  }
  const layer = String(model?.textures?.layer0 ?? '').replace(/^minecraft:/, '')
  return layer.startsWith('item/')
}

export function itemSpritePaths(id, model) {
  const name = String(id ?? '').replace(/^minecraft:/, '')
  if (!name) {
    return []
  }
  const paths = [
    `minecraft/textures/item/${name}.png`,
    `minecraft/textures/item/${name}_00.png`,
  ]
  if (isGeneratedItem(model)) {
    const layer = String(model?.textures?.layer0 ?? '').replace(/^minecraft:/, '')
    if (layer) {
      paths.push(`minecraft/textures/${layer}.png`)
    }
  }
  return paths
}
