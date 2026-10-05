import { readdirSync, readFileSync, writeFileSync } from 'node:fs'

const SRC = 'C:/Users/mckafei/AppData/Local/Temp/mc1201/src'
const MAP = 'C:/Users/mckafei/AppData/Local/Temp/mc1201/client.txt'
const OUT = new URL('../src/mc/data/entity-layers-1.20.1.json', import.meta.url)

const TYPE_MODEL = {
  allay: 'AllayModel',
  axolotl: 'AxolotlModel',
  bat: 'BatModel',
  bee: 'BeeModel',
  blaze: 'BlazeModel',
  camel: 'CamelModel',
  cat: 'OcelotModel',
  cave_spider: 'SpiderModel',
  chicken: 'ChickenModel',
  cod: 'CodModel',
  cow: 'CowModel',
  creeper: 'CreeperModel',
  dolphin: 'DolphinModel',
  donkey: 'ChestedHorseModel',
  drowned: 'DrownedModel',
  elder_guardian: 'GuardianModel',
  enderman: 'EndermanModel',
  endermite: 'EndermiteModel',
  evoker: 'IllagerModel',
  fox: 'FoxModel',
  frog: 'FrogModel',
  ghast: 'GhastModel',
  glow_squid: 'SquidModel',
  goat: 'GoatModel',
  guardian: 'GuardianModel',
  hoglin: 'HoglinModel',
  horse: 'HorseModel',
  husk: 'HumanoidModel',
  iron_golem: 'IronGolemModel',
  llama: 'LlamaModel',
  magma_cube: 'LavaSlimeModel',
  mooshroom: 'CowModel',
  mule: 'ChestedHorseModel',
  ocelot: 'OcelotModel',
  panda: 'PandaModel',
  parrot: 'ParrotModel',
  phantom: 'PhantomModel',
  pig: 'PigModel',
  piglin: 'HumanoidModel',
  piglin_brute: 'HumanoidModel',
  pillager: 'IllagerModel',
  polar_bear: 'PolarBearModel',
  pufferfish: 'PufferfishBigModel',
  rabbit: 'RabbitModel',
  ravager: 'RavagerModel',
  salmon: 'SalmonModel',
  sheep: 'SheepModel',
  shulker: 'ShulkerModel',
  silverfish: 'SilverfishModel',
  skeleton: 'SkeletonModel',
  skeleton_horse: 'HorseModel',
  slime: 'SlimeModel',
  sniffer: 'SnifferModel',
  snow_golem: 'SnowGolemModel',
  spider: 'SpiderModel',
  squid: 'SquidModel',
  stray: 'SkeletonModel',
  strider: 'StriderModel',
  tadpole: 'TadpoleModel',
  trader_llama: 'LlamaModel',
  tropical_fish: 'TropicalFishModelA',
  turtle: 'TurtleModel',
  vex: 'VexModel',
  villager: 'VillagerModel',
  vindicator: 'IllagerModel',
  wandering_trader: 'VillagerModel',
  warden: 'WardenModel',
  witch: 'WitchModel',
  wither: 'WitherBossModel',
  wither_skeleton: 'SkeletonModel',
  wolf: 'WolfModel',
  zoglin: 'HoglinModel',
  zombie: 'HumanoidModel',
  zombie_horse: 'HorseModel',
  zombie_villager: 'ZombieVillagerModel',
  zombified_piglin: 'HumanoidModel',
}

const TEXTURE = {
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
  wandering_trader: 'entity/villager/wandering_trader.png',
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

const classes = new Map()
for (const file of readdirSync(SRC)) {
  if (!file.endsWith('.java')) {
    continue
  }
  const text = readFileSync(`${SRC}/${file}`, 'utf8')
  if (!text.includes('new fem()') && !text.includes('fek') && !text.includes('fej.c()')) {
    continue
  }
  classes.set(file.slice(0, -5), strip(text))
}

const names = new Map()
const mapText = readFileSync(MAP, 'utf8')
for (const line of mapText.split(/\n/)) {
  const hit = line.match(/^net\.minecraft\.client\.model\.(\w+) -> (\w+):/)
  if (hit) {
    names.set(hit[2], hit[1])
  }
}

const methods = new Map()
for (const [id, text] of classes) {
  methods.set(id, parseMethods(id, text))
}

function strip(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*import .*$/gm, '')
}

function parseMethods(id, text) {
  const found = []
  const re = /(?:public|protected|private)?(?:\s+static)?\s+[\w.<>, ?]+\s+(\w+)\s*\(([^)]*)\)\s*\{/g
  let match
  while ((match = re.exec(text))) {
    const body = sliceBlock(text, match.index + match[0].length - 1)
    if (body.length > 20000) {
      continue
    }
    found.push({
      name: match[1],
      params: match[2].split(',').map((part) => part.trim()).filter(Boolean).map((part) => part.split(/\s+/).pop()),
      body,
    })
  }
  return found
}

function sliceBlock(text, open) {
  let depth = 0
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') {
      depth += 1
    } else if (text[i] === '}') {
      depth -= 1
      if (depth === 0) {
        return text.slice(open + 1, i)
      }
    }
  }
  return ''
}

const ZERO = { x: 0, y: 0, z: 0, xr: 0, yr: 0, zr: 0 }
const GROW0 = [0, 0, 0]

function javaRandom(seed) {
  let state = (BigInt(seed) ^ 0x5DEECE66Dn) & ((1n << 48n) - 1n)
  return {
    nextInt(bound) {
      state = (state * 0x5DEECE66Dn + 0xBn) & ((1n << 48n) - 1n)
      const value = Number(state >> 17n)
      return value % bound
    },
  }
}

function runMethod(classId, method, args) {
  const list = methods.get(classId) ?? []
  const target = list.find((item) => item.name === method && item.params.length === args.length) ?? list.find((item) => item.name === method)
  if (!target) {
    throw new Error(`missing ${classId}.${method}/${args.length}`)
  }
  const env = new Map()
  const text = classes.get(classId) ?? ''
  for (const hit of text.matchAll(/String\s+([A-Za-z_$][\w$]*)\s*=\s*"([^"]*)"/g)) {
    env.set(hit[1], hit[2])
  }
  target.params.forEach((name, index) => env.set(name, args[index]))
  return exec(target.body, env, classId)
}

function exec(body, env, classId) {
  const lines = splitStatements(body)
  let value
  for (const line of lines) {
    try {
      value = execLine(line.trim(), env, classId)
    } catch (error) {
      if (classId === 'fal' || classId === 'fdg' || classId === 'faq') {
        throw new Error(`${classId}: ${line.trim().slice(0, 220)} :: ${error.message}`)
      }
      throw error
    }
  }
  return value
}

function splitStatements(body) {
  const out = []
  let buf = ''
  let depth = 0
  let str = false
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i]
    if (ch === '"') {
      str = !str
    }
    if (!str && depth === 0 && body.slice(i).match(/^for\s*\(/)) {
      if (buf.trim()) {
        out.push(buf)
        buf = ''
      }
      const start = i
      const open = body.indexOf('{', i)
      const block = sliceBlock(body, open)
      i = open + 1 + block.length
      out.push(body.slice(start, i + 1))
      continue
    }
    if (!str && (ch === '(' || ch === '{' || ch === '[')) {
      depth += 1
    }
    if (!str && (ch === ')' || ch === '}' || ch === ']')) {
      depth -= 1
    }
    if (!str && depth === 0 && ch === ';') {
      out.push(buf)
      buf = ''
      continue
    }
    buf += ch
  }
  if (buf.trim()) {
    out.push(buf)
  }
  return out
}

function execLine(line, env, classId) {
  if (!line || line.startsWith('//')) {
    return undefined
  }
  const loop = line.match(/^for\s*\(([^;]*);([^;]*);([^)]*)\)\s*\{([\s\S]*)\}$/)
  if (loop) {
    execLine(loop[1].replace(/^(?:int|float)\s+/, ''), env, classId)
    let guard = 0
    while (truthy(evalExpr(loop[2], env, classId)) && guard < 64) {
      exec(loop[4], env, classId)
      execLine(loop[3], env, classId)
      guard += 1
    }
    return undefined
  }
  const decl = line.match(/^(?:fem|fen|fej|fei|fek|float|int|String|boolean)\s+(.+)$/)
  if (decl) {
    return execLine(decl[1], env, classId)
  }
  if (line.startsWith('return ')) {
    return evalExpr(line.slice(7), env, classId)
  }
  const assign = line.match(/^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*(\+=|\+\+|--|=)\s*([\s\S]*)$/)
  if (assign && assign[2] === '=') {
    const value = evalExpr(assign[3], env, classId)
    env.set(assign[1], value)
    return value
  }
  if (assign && assign[2] === '+=') {
    const value = num(env.get(assign[1])) + num(evalExpr(assign[3], env, classId))
    env.set(assign[1], value)
    return value
  }
  if (assign && (assign[2] === '++' || assign[2] === '--')) {
    const value = num(env.get(assign[1])) + (assign[2] === '++' ? 1 : -1)
    env.set(assign[1], value)
    return value
  }
  if (line.startsWith('++') || line.startsWith('--')) {
    const name = line.slice(2)
    const value = num(env.get(name)) + (line.startsWith('++') ? 1 : -1)
    env.set(name, value)
    return value
  }
  return evalExpr(line, env, classId)
}

function evalExpr(input, env, classId) {
  const tokens = tokenize(input)
  let index = 0
  function peek() {
    return tokens[index]
  }
  function take() {
    return tokens[index++]
  }
  function parseAdd() {
    let left = parseMul()
    while (peek() === '+' || peek() === '-') {
      const op = take()
      const right = parseMul()
      if (op === '+' && (typeof left === 'string' || typeof right === 'string')) {
        left = String(left) + String(right)
      } else {
        left = op === '+' ? num(left) + num(right) : num(left) - num(right)
      }
    }
    return left
  }
  function parseMul() {
    let left = parseUnary()
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = take()
      const right = parseUnary()
      if (op === '*') {
        left = num(left) * num(right)
      } else if (op === '/') {
        left = num(left) / num(right)
      } else {
        left = num(left) % num(right)
      }
    }
    return left
  }
  function parseUnary() {
    if (peek() === '-') {
      take()
      return -num(parseUnary())
    }
    if (peek() === '+') {
      take()
      return num(parseUnary())
    }
    if (peek() === '(') {
      const cast = tokens.slice(index).join('')
      if (/^\(\s*(?:float|int|double)\s*\)/.test(cast)) {
        take()
        take()
        take()
        return parseUnary()
      }
    }
    return parsePost()
  }
  function parsePost() {
    let value = parsePrimary()
    while (peek() === '.' || peek() === '(') {
      if (peek() === '(') {
        value = applyCall(value, null, readArgs())
        continue
      }
      take()
      const name = take()
      if (peek() === '(') {
        value = applyCall(value, name, readArgs())
      } else {
        value = member(value, name)
      }
    }
    if (value?.type === 'ref' && value.name === 'feg.a') {
      return { x: 0, y: 0, z: 0, xr: 0, yr: 0, zr: 0 }
    }
    if (value?.type === 'ref' && value.name === 'fei.a') {
      return { kind: 'grow', value: [0, 0, 0] }
    }
    return value
  }
  function parsePrimary() {
    const token = take()
    if (token === '(') {
      const value = parseAdd()
      take()
      return value
    }
    if (token === 'new') {
      return { type: 'new', typeName: take() }
    }
    if (token[0] === '"') {
      return token.slice(1, -1)
    }
    if (/^-?\d/.test(token)) {
      return num(token)
    }
    if (token === 'true') {
      return true
    }
    if (token === 'false') {
      return false
    }
    if (env.has(token)) {
      return env.get(token)
    }
    return { type: 'ref', name: token }
  }
  function readArgs() {
    take()
    const args = []
    if (peek() !== ')') {
      args.push(parseAdd())
      while (peek() === ',') {
        take()
        args.push(parseAdd())
      }
    }
    take()
    return args
  }
  function applyCall(target, name, args) {
    if (target?.type === 'new') {
      return invoke(target.typeName, args, env, classId)
    }
    if (target?.type === 'ref' && !name) {
      return invoke(target.name, args, env, classId)
    }
    if (target?.type === 'ref' && name) {
      return invoke(`${target.name}.${name}`, args, env, classId)
    }
    if (target?.kind === 'builder') {
      return builderCall(target, name, args)
    }
    if (target?.kind === 'part') {
      return partCall(target, name, args)
    }
    if (target?.kind === 'mesh' && name === 'a' && args.length === 0) {
      return target.root
    }
    if (target?.kind === 'grow' && name === 'a' && args.length === 1) {
      const add = num(args[0])
      return { kind: 'grow', value: target.value.map((part) => part + add) }
    }
    if (target?.kind === 'grow' && name === 'a' && args.length === 3) {
      return { kind: 'grow', value: target.value.map((part, index) => part + num(args[index])) }
    }
    if (target?.kind === 'random' && name === 'a' && args.length === 1) {
      return target.random.nextInt(num(args[0]))
    }
    throw new Error(`cannot call ${name} on ${JSON.stringify(target)?.slice(0, 120)}`)
  }
  const value = parseAdd()
  return value
}

function refName(value) {
  return value?.type === 'ref' ? value.name : value
}

function member(value, name) {
  if (value?.type === 'ref') {
    return { type: 'ref', name: `${value.name}.${name}` }
  }
  if (value?.kind === 'part' && name === 'a') {
    return value
  }
  return { type: 'ref', name: `${refName(value)}.${name}` }
}

function invoke(name, args, env, classId) {
  if (name === 'fem' || name === 'new.fem') {
    const root = { kind: 'part', name: 'root', pose: { ...ZERO }, cubes: [], children: [] }
    return { kind: 'mesh', root }
  }
  if (name === 'fei' || name === 'new.fei') {
    const grow = args.length === 1 ? [num(args[0]), num(args[0]), num(args[0])] : args.slice(0, 3).map(num)
    return { kind: 'grow', value: grow }
  }
  if (name === 'fei.a' || name === 'fei.a.a' && args.length === 0) {
    return { kind: 'grow', value: [0, 0, 0] }
  }
  if (name === 'fei.a.a' && args.length === 1) {
    const add = num(args[0])
    return { kind: 'grow', value: [add, add, add] }
  }
  if (name === 'fei.a.a' && args.length === 3) {
    return { kind: 'grow', value: args.slice(0, 3).map(num) }
  }
  if (name === 'feg.a' && args.length === 0) {
    return { ...ZERO }
  }
  if (name === 'feg.a' && args.length === 3) {
    return { x: num(args[0]), y: num(args[1]), z: num(args[2]), xr: 0, yr: 0, zr: 0 }
  }
  if (name === 'feg.a' && args.length === 6) {
    return { x: num(args[0]), y: num(args[1]), z: num(args[2]), xr: num(args[3]), yr: num(args[4]), zr: num(args[5]) }
  }
  if (name === 'feg.b') {
    return { x: 0, y: 0, z: 0, xr: num(args[0]), yr: num(args[1]), zr: num(args[2]) }
  }
  if (name === 'fej' || name === 'fej.c') {
    return { kind: 'builder', mirror: false, u: 0, v: 0, cubes: [] }
  }
  if (name === 'fek.a') {
    return { texWidth: num(args[1]), texHeight: num(args[2]), root: args[0].root }
  }
  if (name === 'apa.a' && args.length === 1) {
    return Math.sin(num(args[0]))
  }
  if (name === 'apa.b' && args.length === 1) {
    return Math.cos(num(args[0]))
  }
  if (name === 'apf.a' && args.length === 1) {
    return { kind: 'random', random: javaRandom(num(args[0])) }
  }
  const call = name.match(/^(\w+)\.(\w+)$/)
  if (call && methods.has(call[1])) {
    return runMethod(call[1], call[2], args)
  }
  if (methods.get(classId)?.some((item) => item.name === name)) {
    return runMethod(classId, name, args)
  }
  throw new Error(`unknown call ${name}`)
}

function builderCall(builder, name, args) {
  if (name !== 'a') {
    throw new Error(`builder.${name}`)
  }
  if (args.length === 0) {
    builder.mirror = true
    return builder
  }
  if (args.length === 1 && typeof args[0] === 'boolean') {
    builder.mirror = args[0]
    return builder
  }
  if (args.length === 2) {
    builder.u = num(args[0])
    builder.v = num(args[1])
    return builder
  }
  if (args.length === 9 && args[6]?.kind === 'grow') {
    builder.cubes.push({
      u: builder.u,
      v: builder.v,
      x: num(args[0]),
      y: num(args[1]),
      z: num(args[2]),
      width: num(args[3]),
      height: num(args[4]),
      depth: num(args[5]),
      grow: args[6].value,
      texScale: [num(args[7]) || 1, num(args[8]) || 1],
      mirror: builder.mirror,
    })
    return builder
  }
  if (args.length === 9 && (typeof args[0] === 'string' || args[0]?.type === 'ref')) {
    builder.u = num(args[7])
    builder.v = num(args[8])
    builder.cubes.push({
      u: builder.u,
      v: builder.v,
      x: num(args[1]),
      y: num(args[2]),
      z: num(args[3]),
      width: num(args[4]),
      height: num(args[5]),
      depth: num(args[6]),
      grow: [0, 0, 0],
      mirror: builder.mirror,
    })
    return builder
  }
  const grow = args.length >= 7 && args[6]?.kind === 'grow' ? args[6].value : GROW0
  builder.cubes.push({
    u: builder.u,
    v: builder.v,
    x: num(args[0]),
    y: num(args[1]),
    z: num(args[2]),
    width: num(args[3]),
    height: num(args[4]),
    depth: num(args[5]),
    grow,
    mirror: builder.mirror,
  })
  return builder
}

function partCall(part, name, args) {
  if (name !== 'a') {
    throw new Error(`part.${name}`)
  }
  if (args.length === 2 && typeof args[0] === 'string' && args[1]?.kind === 'builder') {
    return partCall(part, name, [args[0], args[1], { x: 0, y: 0, z: 0, xr: 0, yr: 0, zr: 0 }])
  }
  if (args.length === 1 && typeof args[0] === 'string') {
    const child = part.children.find((item) => item.name === args[0])
    if (!child) {
      throw new Error(`missing part ${args[0]}`)
    }
    return child
  }
  if (args.length === 3 && typeof args[0] === 'string') {
    const pose = args[2] ?? { ...ZERO }
    const cubes = args[1]?.kind === 'builder' ? args[1].cubes : []
    const existing = part.children.find((item) => item.name === args[0])
    if (existing) {
      existing.pose = { ...pose }
      existing.cubes = cubes.map((cube) => ({ ...cube, grow: [...cube.grow] }))
      return existing
    }
    const child = {
      kind: 'part',
      name: args[0],
      pose: { ...pose },
      cubes: cubes.map((cube) => ({ ...cube, grow: [...cube.grow] })),
      children: [],
    }
    part.children.push(child)
    return child
  }
  throw new Error(`part.a arity ${args.length} ${typeof args[0]} ${JSON.stringify(args[0])?.slice(0, 80)}`)
}

function tokenize(input) {
  const tokens = []
  const re = /\s+|"(?:[^"\\]|\\.)*"|[A-Za-z_$][\w$]*|-?\d[\d.]*(?:[fFL])?|==|!=|<=|>=|\+\+|--|&&|\|\||[{}()[\],.;+\-*/%<>=]/g
  let match
  while ((match = re.exec(input))) {
    if (!/^\s+$/.test(match[0])) {
      tokens.push(match[0])
    }
  }
  return tokens
}

function num(value) {
  if (typeof value === 'number') {
    return value
  }
  if (typeof value === 'string') {
    return Number(value.replace(/[fFL]$/, ''))
  }
  return Number.NaN
}

function truthy(value) {
  return Boolean(value)
}

function plain(part) {
  return {
    name: part.name,
    pose: part.pose,
    cubes: part.cubes,
    children: part.children.map(plain),
  }
}

const built = {}
const errors = {}
for (const [id, list] of methods) {
  const meshMethod = list.find((item) => item.body.includes('fek.a'))
    ?? list.find((item) => item.body.includes('fej.c()') || item.body.includes('new fem()'))
  if (!meshMethod) {
    continue
  }
  try {
    const args = meshMethod.params.map((name, index) => {
      if (index === 0 && /fei/.test(meshMethod.params[0]) || index === 0) {
        return { kind: 'grow', value: [0, 0, 0] }
      }
      return 0
    })
    const layer = runMethod(id, meshMethod.name, args)
    const root = layer?.root ?? (layer?.kind === 'mesh' ? layer.root : null) ?? (layer?.kind === 'part' ? layer : null)
    const texWidth = layer?.texWidth ?? (names.get(id) === 'HumanoidModel' ? 64 : 64)
    const texHeight = layer?.texHeight ?? (names.get(id) === 'HumanoidModel' ? 64 : 32)
    if (!root) {
      throw new Error('no root')
    }
    built[names.get(id) ?? id] = {
      texWidth,
      texHeight,
      root: plain(root),
    }
  } catch (error) {
    errors[names.get(id) ?? id] = error.message
  }
}

const entities = {}
for (const [type, model] of Object.entries(TYPE_MODEL)) {
  if (!built[model]) {
    errors[type] = errors[model] ?? `no mesh for ${model}`
    continue
  }
  entities[type] = {
    model,
    texture: TEXTURE[type],
    texWidth: built[model].texWidth,
    texHeight: built[model].texHeight,
    root: built[model].root,
  }
}

writeFileSync(OUT, JSON.stringify({ entities }))
console.log(`entities ${Object.keys(entities).length} errors ${Object.keys(errors).length}`)
for (const [name, message] of Object.entries(errors)) {
  console.log(`  ${name}: ${message}`)
}
