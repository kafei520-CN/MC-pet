import { BedrockModel } from '@bedrock-viewer/model-viewer'
import { evalMolang } from '@bedrock-viewer/molang'

const MAGIC = [0x7d, 0x27, 0x25, 0xb1, 0xa0, 0x52, 0x70, 0x26]
const ROOT = 'vanilla/bedrock'
const ALLOW_KIND = new Set([
  'walk', 'move', 'legs', 'general', 'setup', 'idle', 'fly', 'swim', 'bob',
  'base_pose', 'arms_legs', 'default_leg_pose', 'scale', 'flop', 'flying',
  'standing', 'base',
])
const SKIP_ANIM = /look_at_target|baby_transform|baby_|riding|attack|swelling|sleep|sit|charging|brandish|holding|scary_face|carrying|hold_item|resting/
const SKIP_COND = /is_baby|is_riding|is_charging|is_sleeping|is_sitting|is_dancing|is_grazing|is_powered|is_brandishing/

const TEXTURES = {
  allay: 'entity/allay/allay.png',
  axolotl: 'entity/axolotl/axolotl_lucy.png',
  bat: 'entity/bat.png',
  bee: 'entity/bee/bee.png',
  blaze: 'entity/blaze.png',
  camel: 'entity/camel/camel.png',
  cat: 'entity/cat/tabby.png',
  cave_spider: 'entity/spider/cave_spider.png',
  chicken: 'entity/chicken.png',
  cod: 'entity/fish/cod.png',
  cow: 'entity/cow/cow.png',
  creeper: 'entity/creeper/creeper.png',
  dolphin: 'entity/dolphin.png',
  donkey: 'entity/horse/donkey.png',
  drowned: 'entity/zombie/drowned.png',
  elder_guardian: 'entity/guardian_elder.png',
  ender_dragon: 'entity/enderdragon/dragon.png',
  enderman: 'entity/enderman/enderman.png',
  endermite: 'entity/endermite.png',
  evoker: 'entity/illager/evoker.png',
  fox: 'entity/fox/fox.png',
  frog: 'entity/frog/temperate_frog.png',
  ghast: 'entity/ghast/ghast.png',
  glow_squid: 'entity/squid/glow_squid.png',
  goat: 'entity/goat/goat.png',
  guardian: 'entity/guardian.png',
  hoglin: 'entity/hoglin/hoglin.png',
  horse: 'entity/horse/horse_brown.png',
  husk: 'entity/zombie/husk.png',
  iron_golem: 'entity/iron_golem/iron_golem.png',
  llama: 'entity/llama/creamy.png',
  magma_cube: 'entity/slime/magmacube.png',
  mooshroom: 'entity/cow/red_mooshroom.png',
  mule: 'entity/horse/mule.png',
  ocelot: 'entity/cat/ocelot.png',
  panda: 'entity/panda/panda.png',
  parrot: 'entity/parrot/parrot_red_blue.png',
  phantom: 'entity/phantom.png',
  pig: 'entity/pig/pig.png',
  piglin: 'entity/piglin/piglin.png',
  piglin_brute: 'entity/piglin/piglin_brute.png',
  pillager: 'entity/illager/pillager.png',
  polar_bear: 'entity/bear/polarbear.png',
  pufferfish: 'entity/fish/pufferfish.png',
  rabbit: 'entity/rabbit/brown.png',
  ravager: 'entity/illager/ravager.png',
  salmon: 'entity/fish/salmon.png',
  sheep: 'entity/sheep/sheep.png',
  shulker: 'entity/shulker/shulker.png',
  silverfish: 'entity/silverfish.png',
  skeleton: 'entity/skeleton/skeleton.png',
  skeleton_horse: 'entity/horse/horse_skeleton.png',
  slime: 'entity/slime/slime.png',
  sniffer: 'entity/sniffer/sniffer.png',
  snow_golem: 'entity/snow_golem.png',
  spider: 'entity/spider/spider.png',
  squid: 'entity/squid/squid.png',
  stray: 'entity/skeleton/stray.png',
  strider: 'entity/strider/strider.png',
  tadpole: 'entity/tadpole/tadpole.png',
  trader_llama: 'entity/llama/creamy.png',
  tropical_fish: 'entity/fish/tropical_a.png',
  turtle: 'entity/turtle/big_sea_turtle.png',
  vex: 'entity/illager/vex.png',
  villager: 'entity/villager/villager.png',
  vindicator: 'entity/illager/vindicator.png',
  wandering_trader: 'entity/wandering_trader.png',
  warden: 'entity/warden/warden.png',
  witch: 'entity/witch.png',
  wither: 'entity/wither/wither.png',
  wither_skeleton: 'entity/skeleton/wither_skeleton.png',
  wolf: 'entity/wolf/wolf.png',
  zoglin: 'entity/hoglin/zoglin.png',
  zombie: 'entity/zombie/zombie.png',
  zombie_horse: 'entity/horse/horse_zombie.png',
  zombie_villager: 'entity/zombie_villager/zombie_villager.png',
  zombified_piglin: 'entity/piglin/zombified_piglin.png',
}

const ALIAS = {
  evoker: 'evocation_illager',
  zombified_piglin: 'zombie_pigman',
  tropical_fish: 'tropicalfish',
  wither: 'wither_boss',
  snow_golem: 'snowgolem',
  iron_golem: 'irongolem',
  mooshroom: 'mushroomcow',
}

const decoder = new TextDecoder()
let packPromise = null

export function parseMinecraftJson(text) {
  return JSON.parse(String(text).replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''))
}

export function parseArchive(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  for (let i = 0; i < 8; i += 1) {
    if (bytes[i] !== MAGIC[i]) {
      throw new Error('not a brarchive')
    }
  }
  const count = view.getUint32(8, true)
  const contentBase = 16 + count * 256
  const files = []
  for (let i = 0; i < count; i += 1) {
    const off = 16 + i * 256
    const nameLen = bytes[off]
    const name = decoder.decode(bytes.subarray(off + 1, off + 1 + nameLen))
    const dataOff = view.getUint32(off + 248, true)
    const dataLen = view.getUint32(off + 252, true)
    files.push({
      name,
      text: decoder.decode(bytes.subarray(contentBase + dataOff, contentBase + dataOff + dataLen)),
    })
  }
  return files
}

function isLegacyName(name) {
  return /\.v1\.0\.|_v1\.0\./.test(name)
}

function fileRank(name) {
  if (isLegacyName(name)) {
    return -1
  }
  const version = name.match(/_v(\d+)/)
  return version ? Number(version[1]) : 100
}

function shortId(identifier) {
  return String(identifier ?? '').replace(/^minecraft:/, '')
}

function geometryName(key) {
  return String(key).split(':')[0]
}

export function indexPack({ entity, animations, models }) {
  const entities = new Map()
  const entityFiles = new Map()
  const geos = new Map()
  const clips = new Map()

  for (const file of entity) {
    let json
    try {
      json = parseMinecraftJson(file.text)
    } catch {
      continue
    }
    const desc = json?.['minecraft:client_entity']?.description
    if (!desc?.identifier) {
      continue
    }
    const id = shortId(desc.identifier)
    const previous = entityFiles.get(id)
    if (previous && fileRank(previous) >= fileRank(file.name)) {
      continue
    }
    entityFiles.set(id, file.name)
    entities.set(id, desc)
    entities.set(file.name.replace(/\.entity\.json$/, ''), desc)
  }

  for (const file of models) {
    let json
    try {
      json = parseMinecraftJson(file.text)
    } catch {
      continue
    }
    if (json['minecraft:geometry']) {
      const list = Array.isArray(json['minecraft:geometry']) ? json['minecraft:geometry'] : [json['minecraft:geometry']]
      for (const def of list) {
        const id = def?.description?.identifier
        if (id && !geos.has(id)) {
          geos.set(id, { kind: 'new', def })
        }
      }
    }
    for (const [key, value] of Object.entries(json)) {
      if (!key.startsWith('geometry.') || !value || typeof value !== 'object') {
        continue
      }
      const [id, parent] = key.split(':')
      if (!geos.has(id)) {
        geos.set(id, { kind: 'old', id, parent, value })
      }
    }
  }

  for (const file of animations) {
    let json
    try {
      json = parseMinecraftJson(file.text)
    } catch {
      continue
    }
    for (const name of Object.keys(json.animations ?? {})) {
      if (!clips.has(name)) {
        clips.set(name, json)
      }
    }
  }

  return { entities, geos, clips }
}

function resolveOld(geos, id, seen = new Set()) {
  const entry = geos.get(id)
  if (!entry) {
    return null
  }
  if (entry.kind === 'new') {
    return entry.def
  }
  if (seen.has(id)) {
    return null
  }
  seen.add(id)
  const bones = new Map()
  let parentDesc = null
  if (entry.parent) {
    const parent = resolveOld(geos, geometryName(entry.parent), seen)
    parentDesc = parent?.description
    for (const bone of parent?.bones ?? []) {
      bones.set(bone.name, bone)
    }
  }
  for (const bone of entry.value.bones ?? []) {
    bones.set(bone.name, bone)
  }
  return {
    description: {
      identifier: id,
      texture_width: entry.value.texturewidth ?? entry.value.texture_width ?? parentDesc?.texture_width ?? 64,
      texture_height: entry.value.textureheight ?? entry.value.texture_height ?? parentDesc?.texture_height ?? 32,
      visible_bounds_width: entry.value.visible_bounds_width ?? parentDesc?.visible_bounds_width,
      visible_bounds_height: entry.value.visible_bounds_height ?? parentDesc?.visible_bounds_height,
      visible_bounds_offset: entry.value.visible_bounds_offset ?? parentDesc?.visible_bounds_offset,
    },
    bones: [...bones.values()],
  }
}

export function geometryFile(pack, identifier) {
  const id = geometryName(identifier)
  const def = resolveOld(pack.geos, id)
  if (!def) {
    return null
  }
  return {
    format_version: '1.12.0',
    'minecraft:geometry': [def],
  }
}

export function resolveEntity(pack, type) {
  return pack.entities.get(type)
    || pack.entities.get(ALIAS[type])
    || pack.entities.get(type.replaceAll('_', ''))
    || null
}

export function geometryId(desc) {
  const geo = desc?.geometry
  if (typeof geo === 'string') {
    return geo
  }
  if (!geo || typeof geo !== 'object') {
    return ''
  }
  return geo.default || geo.typeA || Object.values(geo).find((value) => typeof value === 'string') || ''
}

function allowClip(ref) {
  if (typeof ref !== 'string' || !ref.startsWith('animation.') || SKIP_ANIM.test(ref)) {
    return false
  }
  const trimmed = ref.replace(/\.v\d+(?:\.\d+)?$/, '')
  const kind = trimmed.split('.').at(-1)
  return ALLOW_KIND.has(kind)
}

export function pickClips(desc) {
  const map = desc?.animations ?? {}
  const names = []
  const seen = new Set()
  function take(ref) {
    if (!allowClip(ref) || seen.has(ref)) {
      return
    }
    seen.add(ref)
    names.push(ref)
  }
  for (const item of desc?.scripts?.animate ?? []) {
    const key = typeof item === 'string' ? item : Object.keys(item ?? {})[0]
    const cond = typeof item === 'string' ? '' : String(item?.[key] ?? '')
    if (!key || SKIP_COND.test(cond)) {
      continue
    }
    take(map[key])
  }
  if (!names.length) {
    for (const ref of Object.values(map)) {
      take(ref)
    }
  }
  return names
}

export function textureUrls(type, desc) {
  const urls = []
  if (TEXTURES[type]) {
    urls.push(`/resource-pack/minecraft/textures/${TEXTURES[type]}`)
  }
  for (const value of Object.values(desc?.textures ?? {})) {
    if (typeof value === 'string') {
      urls.push(`/resource-pack/minecraft/${value}.png`)
    }
  }
  urls.push(`/resource-pack/minecraft/textures/entity/${type}.png`)
  urls.push(`/resource-pack/minecraft/textures/entity/${type}/${type}.png`)
  return [...new Set(urls)]
}

export function hitbox(def) {
  const width = Number(def?.description?.visible_bounds_width) || 1
  const height = Number(def?.description?.visible_bounds_height) || 2
  return {
    hw: Math.min(0.7, Math.max(0.2, width * 0.35)),
    hh: Math.min(3.5, Math.max(0.4, height * 0.9)),
  }
}

function normalizeMolang(source) {
  return String(source)
    .replace(/;$/, '')
    .replace(/\bMath\./g, 'math.')
    .replace(/\bQuery\./g, 'query.')
    .replace(/\bVariable\./g, 'variable.')
    .replace(/\bmath\.([A-Za-z_]+)/g, (_, name) => `math.${name.toLowerCase()}`)
}

export function applyEntityMolang(model, preAnimation, queries, variables) {
  for (const playback of model.animations.animations ?? []) {
    Object.assign(playback.env.query, queries)
    Object.assign(playback.env.variable, variables)
    for (const stmt of preAnimation ?? []) {
      try {
        evalMolang(normalizeMolang(stmt), playback.env)
      } catch {}
    }
  }
}

export function indexFromArchives(buffers) {
  return indexPack({
    entity: parseArchive(buffers.entity),
    animations: parseArchive(buffers.animations),
    models: parseArchive(buffers.models),
  })
}

async function fetchArchive(name) {
  const response = await fetch(`${ROOT}/${name}.brarchive`)
  if (!response.ok) {
    throw new Error(`${name}.brarchive ${response.status}`)
  }
  return new Uint8Array(await response.arrayBuffer())
}

export function loadBedrockPack() {
  if (!packPromise) {
    packPromise = Promise.all([
      fetchArchive('entity'),
      fetchArchive('animations'),
      fetchArchive('models'),
    ]).then(([entity, animations, models]) => indexFromArchives({ entity, animations, models }))
  }
  return packPromise
}

export async function createEntityModel(type) {
  const pack = await loadBedrockPack()
  const desc = resolveEntity(pack, type)
  if (!desc) {
    return null
  }
  const geometry = geometryFile(pack, geometryId(desc))
  if (!geometry) {
    return null
  }
  const geometryName = geometry['minecraft:geometry'][0].description.identifier
  const texture = textureUrls(type, desc)[0]
  let model
  try {
    model = await BedrockModel.load(texture ? { geometry, geometryName, texture } : { geometry, geometryName })
  } catch {
    model = await BedrockModel.load({ geometry, geometryName })
  }
  for (const name of pickClips(desc)) {
    const file = pack.clips.get(name)
    if (!file) {
      continue
    }
    try {
      model.playAnimation(BedrockModel.loadAnimationClip(file, name))
    } catch {
      // missing bone channels are fine
    }
  }
  return {
    model,
    preAnimation: desc.scripts?.pre_animation ?? [],
    ...hitbox(geometry['minecraft:geometry'][0]),
  }
}
