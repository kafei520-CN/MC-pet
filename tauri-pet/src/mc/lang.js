import { bareId } from './ids.js'

let en = {}
let zh = {}
let loading = null

async function readJson(url) {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }
    return await response.json()
  } catch {
    return null
  }
}

function keysFor(id) {
  const name = bareId(id)
  if (!name) {
    return []
  }
  return [`item.minecraft.${name}`, `block.minecraft.${name}`]
}

export async function loadItemLang() {
  if (Object.keys(zh).length) {
    return zh
  }
  if (loading) {
    return loading
  }
  loading = Promise.all([
    readJson('/resource-pack/minecraft/lang/en_us.json'),
    readJson('/resource-pack/minecraft/lang/zh_cn.json'),
  ]).then(([enRaw, zhRaw]) => {
    en = enRaw && typeof enRaw === 'object' ? enRaw : {}
    zh = zhRaw && typeof zhRaw === 'object' ? zhRaw : {}
    loading = null
    return zh
  })
  return loading
}

export function itemDisplayName(id) {
  const keys = keysFor(id)
  for (const key of keys) {
    if (zh[key]) {
      return zh[key]
    }
  }
  for (const key of keys) {
    if (en[key]) {
      return en[key]
    }
  }
  return bareId(id)
}
