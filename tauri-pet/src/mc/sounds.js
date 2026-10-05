import { bareId } from './ids.js'

const WOODS = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry', 'bamboo', 'crimson', 'warped', 'pale_oak']
let catalogPromise = null

function isWood(name) {
  if (name === 'bookshelf' || name === 'crafting_table' || name === 'chest' || name === 'trapped_chest' || name === 'barrel' || name === 'pumpkin' || name === 'carved_pumpkin' || name === 'jack_o_lantern' || name === 'melon' || name === 'note_block' || name === 'ladder') {
    return true
  }
  return WOODS.some((wood) => name === wood || name.startsWith(`${wood}_`))
}

export function soundGroup(id) {
  const name = bareId(id)
  if (!name) {
    return 'stone'
  }
  if (name === 'grass_block' || name.endsWith('_leaves') || name === 'moss_block' || name.endsWith('_sapling') || name === 'poppy' || name === 'dandelion' || name === 'oxeye_daisy') {
    return 'grass'
  }
  if (name.includes('sand')) {
    return 'sand'
  }
  if (name === 'gravel' || name === 'dirt' || name === 'coarse_dirt' || name === 'rooted_dirt' || name === 'podzol' || name === 'mud' || name === 'clay' || name === 'farmland') {
    return 'gravel'
  }
  if (name.includes('wool') || name.endsWith('_carpet')) {
    return 'cloth'
  }
  if (name.includes('snow')) {
    return 'snow'
  }
  if (isWood(name)) {
    return 'wood'
  }
  return 'stone'
}

function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch('/resource-pack/minecraft/sounds/index.json')
      .then((response) => response.json())
      .catch(() => ({ step: {}, dig: {} }))
  }
  return catalogPromise
}

async function playFile(kind, group, volume) {
  const catalog = await loadCatalog()
  const folder = kind === 'place' ? 'dig' : 'step'
  const files = catalog[folder]?.[group] || catalog[folder]?.stone
  if (!files?.length) {
    return
  }
  const rel = files[Math.floor(Math.random() * files.length)]
  const audio = new Audio(`/resource-pack/minecraft/sounds/${rel}`)
  audio.volume = volume
  audio.preservesPitch = false
  audio.playbackRate = 0.94 + Math.random() * 0.12
  audio.play().catch(() => {})
}

export function playStep(id) {
  playFile('step', soundGroup(id), 0.42)
}

export function playPlace(id) {
  playFile('place', soundGroup(id), 0.7)
}
