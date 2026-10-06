import { bareId } from './ids.js'
import { listPack } from './pack-list.js'

const WOODS = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry', 'bamboo', 'crimson', 'warped', 'pale_oak']
const BLOCK_SOUND_DIR = 'minecraft/sounds/block'
let catalogPromise = null
let blockSoundDirsPromise = null
const blockSoundDirCache = new Map()
let blockEventsPromise = null
const blockEventCache = new Map()

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
  if (name === 'ladder') {
    return 'ladder'
  }
  if (name === 'scaffolding') {
    return 'scaffold'
  }
  if (name.includes('coral') || name === 'sea_pickle') {
    return 'coral'
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

function blockSoundCandidates(id) {
  const name = bareId(id)
  if (!name) {
    return []
  }
  const candidates = [name]
  if (name.startsWith('waxed_')) {
    candidates.push(name.slice('waxed_'.length))
  }
  for (const prefix of ['exposed_', 'weathered_', 'oxidized_']) {
    if (name.startsWith(prefix)) {
      candidates.push(name.slice(prefix.length))
    }
  }
  if (name.endsWith('_block')) {
    candidates.push(name.slice(0, -'_block'.length))
  }
  if (name.endsWith('_ore')) {
    candidates.push(name.slice(0, -'_ore'.length))
  }
  if (name.startsWith('bamboo_')) {
    candidates.push('bamboo')
    candidates.push('bamboo_wood')
  }
  const aliases = {
    flowering_azalea: 'azalea',
    flowering_azalea_leaves: 'azalea_leaves',
    copper_golem_statue: 'copper_statue',
    polished_basalt: 'basalt',
    polished_tuff: 'tuff',
    wet_sponge: 'sponge',
    weeping_vines: 'roots',
    twisting_vines: 'roots',
    cave_vines: 'vine',
    nether_wart_block: 'netherwart',
    wart_block: 'netherwart',
    cherry_sapling: 'azalea',
  }
  if (aliases[name]) {
    candidates.push(aliases[name])
  }
  if (name.endsWith('_shelf')) {
    candidates.push('shelf')
    candidates.push('chiseled_bookshelf')
  }
  if (name.startsWith('nether_')) {
    candidates.push('nether_wood')
  }
  if (name.includes('hanging_sign')) {
    candidates.push('hanging_sign')
  }
  return [...new Set(candidates)]
}

function loadBlockEvents() {
  if (!blockEventsPromise) {
    blockEventsPromise = fetch('/resource-pack/minecraft/sounds.json')
      .then((response) => response.json())
      .catch(() => ({}))
  }
  return blockEventsPromise
}

async function blockEventFiles(id, event) {
  const key = `${bareId(id)}:${event}`
  if (blockEventCache.has(key)) {
    return blockEventCache.get(key)
  }
  const sounds = await loadBlockEvents()
  let files = []
  for (const candidate of blockSoundCandidates(id)) {
    const entry = sounds[`block.${candidate}.${event}`]
    if (!entry?.sounds?.length) {
      continue
    }
    files = entry.sounds
      .map((sound) => typeof sound === 'string' ? sound : sound?.name)
      .filter(Boolean)
      .map((name) => `${name}.ogg`)
    if (files.length) {
      break
    }
  }
  blockEventCache.set(key, files)
  return files
}

async function listSoundFiles(dir, prefix = '') {
  const names = await listPack(dir)
  const files = []
  for (const name of names) {
    const child = prefix ? `${prefix}/${name}` : name
    if (/\.(ogg|wav|mp3)$/i.test(name)) {
      files.push(child)
      continue
    }
    files.push(...await listSoundFiles(`${dir}/${name}`, child))
  }
  return files
}

async function blockSoundFiles(id) {
  const key = bareId(id)
  if (!key) {
    return []
  }
  if (blockSoundDirCache.has(key)) {
    return blockSoundDirCache.get(key)
  }
  if (!blockSoundDirsPromise) {
    blockSoundDirsPromise = listPack(BLOCK_SOUND_DIR).catch(() => [])
  }
  const dirs = new Set(await blockSoundDirsPromise)
  let files = []
  for (const candidate of blockSoundCandidates(key)) {
    if (!dirs.has(candidate)) {
      continue
    }
    const names = await listSoundFiles(`${BLOCK_SOUND_DIR}/${candidate}`)
    files = names.map((name) => `block/${candidate}/${name}`)
    if (files.length) {
      break
    }
  }
  blockSoundDirCache.set(key, files)
  return files
}

function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch('/resource-pack/minecraft/sounds/index.json')
      .then((response) => response.json())
      .catch(() => ({ step: {}, dig: {} }))
  }
  return catalogPromise
}

async function playFile(kind, id, volume) {
  const catalog = await loadCatalog()
  const group = soundGroup(id)
  let files = []
  if (kind === 'break' || kind === 'place') {
    files = await blockEventFiles(id, kind)
    if (!files.length) {
      const event = kind === 'break' ? 'break' : 'place'
      files = (await blockSoundFiles(id)).filter((file) => file.includes(`/${event}`))
    }
  }
  if (!files.length) {
    const folder = kind === 'step' ? 'step' : 'dig'
    files = catalog[folder]?.[group] || catalog[folder]?.stone
  }
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
  playFile('step', id, 0.42)
}

export function playBreak(id) {
  playFile('break', id, 0.72)
}

export function playPlace(id) {
  playFile('place', id, 0.7)
}
