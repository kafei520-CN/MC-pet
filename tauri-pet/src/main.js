import * as THREE from 'three'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { PlayerObject } from 'skinview3d'
import { bindPlayer } from './rig.js'
import { playClip } from './clips.js'
import { MateActionController } from './mate-engine.js'
import { choosePetAction } from './tree.js'
import { createDoll, grabNeck, releaseDoll, releaseNeck, stepDoll, syncDoll } from './ragdoll.js'
import { createChicken, flapChicken, holdChickenLeg } from './chicken.js'
import { createMc } from './mc/index.js'
import { BLOCK_PX, SCALE, worldToScreen } from './mc/scale.js'
import { lightLevels } from './mc/daylight.js'
import { approachScreenX, blockScreenX, parseSchematic, placeGap, standOnPlaced, standScreenX } from './mc/build.js'
import starterSchematic from './mc/schematic.json'

const ANDROID = typeof window.PetBridge !== 'undefined'

const TOP_LIMIT = 100
const FEET = 16.25
const SEAT = 4
const HEAD = 12

const status = document.querySelector('#status')
const view = document.querySelector('#view')
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false })
renderer.setClearColor(0x000000, 0)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.setPixelRatio(window.devicePixelRatio)
view.appendChild(renderer.domElement)

const scene = new THREE.Scene()
const camera = new THREE.OrthographicCamera(0, 1, 0, -1, 0.1, 800)
camera.position.z = 400
const ambient = new THREE.AmbientLight(0xffffff, 1.35)
scene.add(ambient)
const hemi = new THREE.HemisphereLight(0xe8f0ff, 0x3a2a1c, 0.35)
scene.add(hemi)
const sun = new THREE.DirectionalLight(0xffffff, 0.55)
sun.position.set(40, 80, 120)
scene.add(sun)

function applyDaylight() {
  const light = lightLevels()
  ambient.intensity = light.ambient
  sun.intensity = light.sun
  hemi.intensity = 0.25 + 0.55 * light.amount
}

applyDaylight()

const rig = new THREE.Group()
const player = new PlayerObject()
player.cape.visible = false
player.elytra.visible = false
player.ears.visible = false
player.scale.set(SCALE, SCALE, SCALE)
rig.add(player)
scene.add(rig)
const worldRoot = new THREE.Group()
worldRoot.name = 'mcWorld'
scene.add(worldRoot)
let mcWorld = null
createChicken().then((bird) => {
  chicken = bird
  rig.add(bird.group)
}).catch((error) => {
  status.textContent = error.message
})

const skinTexture = new THREE.TextureLoader().load('vanilla/steve.png')
skinTexture.magFilter = THREE.NearestFilter
skinTexture.minFilter = THREE.NearestFilter
skinTexture.generateMipmaps = false
skinTexture.colorSpace = THREE.SRGBColorSpace
player.skin.map = skinTexture
player.skin.modelType = 'default'
const bones = bindPlayer(player)
const actions = new MateActionController()
const footTip = new THREE.Vector3()
let standLift = 0

function recacheStandLift() {
  const prevY = player.position.y
  const prevRig = rig.position.clone()
  rig.position.set(0, 0, 0)
  player.position.y = FEET * SCALE
  playClip(bones, 'PET_IDLE', 0, { x: 0, z: 0 })
  rig.updateWorldMatrix(true, true)
  let lowest = Infinity
  for (const name of ['leftLeg', 'rightLeg']) {
    footTip.set(0, -12.25, 0)
    bones[name].localToWorld(footTip)
    if (footTip.y < lowest) {
      lowest = footTip.y
    }
  }
  standLift = Number.isFinite(lowest) ? -lowest : 0
  player.position.y = prevY
  rig.position.copy(prevRig)
}

recacheStandLift()

const pet = { x: 180, y: 0, mode: 'idle', seatId: null, seatOffset: 0, vx: 0, vy: 0, onGround: true, inWater: false, jumping: false }
const swing = { x: 0, y: 0, z: 0 }
const look = { yaw: 0, pitch: 0 }
const faceYaw = { current: 0 }
const pointer = { x: 180, y: 200 }
const headPoint = new THREE.Vector3()
let windows = []
let holding = false
let pressing = false
let hovering = false
let lastTap = 0
let pressX = 0
let pressY = 0
let lastPointer = { x: 0, y: 0 }
let lastFrame = performance.now()
let calm = 0
let idleWait = 22
let menuSleep = false
let wander = null
let avoidSeat = null
let falling = false
let fallYaw = 0
let phase = null
let phaseTime = 0
let sitCalm = 0
let sitWait = 16
let windowGone = false
let ignoreSeatId = null
let buildQueue = []
let buildJob = null
let buildBusy = false
let climb = null
let seatMotion = null
let shakeCount = 0
let shakeAt = 0
let fling = null
let doll = null
let dragSample = null
let dragVel = { x: 0, y: 0 }
let poseTime = 0
let poseName = ''
let chicken = null
let hidden = false
let chibi = false

function resize() {
  const width = window.innerWidth
  const height = window.innerHeight
  camera.left = 0
  camera.right = width
  camera.top = 0
  camera.bottom = -height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height, false)
  mcWorld?.layout()
  if (!holding && pet.mode !== 'sit') {
    pet.y = floorY()
  }
}

function floorY() {
  if (ANDROID) {
    return window.innerHeight * 0.78
  }
  if (mcWorld) {
    return mcWorld.supportScreenY(pet.x, pet.y, ignoreSeatId)
  }
  return window.innerHeight
}

function nearBlockStand(x, y) {
  if (!mcWorld) {
    return false
  }
  const stand = mcWorld.supportScreenY(x, y)
  return Math.abs(stand - y) < 64
}

let liveSeat = null
let seatBusy = false

async function refreshWindows() {
  const map = await invoke('desktop_map')
  windows = map.windows ?? []
}

function pollSeat() {
  if (!pet.seatId || seatBusy) {
    return
  }
  const id = pet.seatId
  seatBusy = true
  invoke('seat_rect', { id })
    .then((rect) => {
      if (pet.seatId === id && rect) {
        liveSeat = rect
      }
    })
    .catch(() => {})
    .finally(() => {
      seatBusy = false
    })
}

function windowUnder(x, y, ignoreId) {
  const bodyY = y + 96
  for (const win of windows) {
    if (win.id === ignoreId || win.y < TOP_LIMIT) {
      continue
    }
    if (x < win.x || x > win.x + win.width) {
      continue
    }
    const onBar = (probe) => probe >= win.y - 36 && probe <= win.y + 120
    if (onBar(y) || onBar(bodyY)) {
      return win
    }
  }
  return null
}

function stillOver(id, x, y) {
  const win = windows.find((item) => item.id === id)
  if (!win) {
    return false
  }
  return x >= win.x && x <= win.x + win.width && y >= win.y - 180 && y <= win.y + win.height
}

function trySit(x, y, allowCurrent) {
  if (!allowCurrent && avoidSeat && stillOver(avoidSeat, x, y)) {
    return false
  }
  if (nearBlockStand(x, y)) {
    return false
  }
  avoidSeat = null
  const seat = windowUnder(x, y)
  if (!seat) {
    return false
  }
  pressing = false
  holding = false
  sitOn(seat, x)
  actions.handle('sit')
  return true
}

function sitOn(win, x) {
  const min = win.x + 36
  const max = Math.max(min, win.x + win.width - 36)
  pet.x = Math.min(max, Math.max(min, x))
  pet.seatOffset = pet.x - win.x
  pet.seatId = win.id
  ignoreSeatId = null
  pet.y = win.y
  pet.mode = 'sit'
  wander = null
  calm = 0
  sitCalm = 0
  sitWait = 12 + Math.random() * 10
  phase = null
  seatMotion = null
  shakeCount = 0
  if (doll) {
    releaseDoll(doll)
    doll = null
  }
  player.scale.set(SCALE, SCALE, SCALE)
}

const SHAKE_NEED = 6
const SHAKE_GAP = 420
const SHAKE_MIN_DX = 16
const SHAKE_MIN_SPEED = 380

function nextShake(motion, dx, dy, elapsed, now) {
  if (now - motion.at > SHAKE_GAP) {
    motion.count = 0
    motion.dir = 0
  }
  const speedX = dx / elapsed
  const horizontal = Math.abs(dx) >= SHAKE_MIN_DX && Math.abs(dx) >= Math.abs(dy) && Math.abs(speedX) >= SHAKE_MIN_SPEED
  if (!horizontal) {
    return null
  }
  const dir = Math.sign(dx)
  if (dir !== motion.dir) {
    motion.count += 1
    motion.dir = dir
  }
  motion.at = now
  if (motion.count >= SHAKE_NEED) {
    motion.count = 0
    motion.dir = 0
    return { vx: speedX, vy: dy / elapsed }
  }
  return null
}

function noteWindowShake(win) {
  const now = performance.now()
  if (!seatMotion || seatMotion.id !== win.id) {
    seatMotion = { id: win.id, x: win.x, y: win.y, t: now, dir: 0, count: 0, at: now }
    shakeCount = 0
    return
  }
  const dx = win.x - seatMotion.x
  const dy = win.y - seatMotion.y
  const elapsed = Math.max(0.05, (now - seatMotion.t) / 1000)
  if (dx === 0 && dy === 0) {
    if (now - seatMotion.at > SHAKE_GAP) {
      seatMotion.count = 0
      seatMotion.dir = 0
      shakeCount = 0
    }
    return
  }
  seatMotion.x = win.x
  seatMotion.y = win.y
  seatMotion.t = now
  const flung = nextShake(seatMotion, dx, dy, elapsed, now)
  shakeCount = seatMotion.count
  if (!flung) {
    return
  }
  const speed = Math.hypot(flung.vx, flung.vy)
  const hop = Math.min(speed * 0.15, 120)
  launchDoll(flung.vx, flung.vy - hop)
}

function beginDragDoll(x, y) {
  pointer.x = x
  pointer.y = y
  player.updateWorldMatrix(true, true)
  if (!doll) {
    doll = createDoll(bones, player, rig, 0, 0, -floorY())
  }
  phase = 'ragdoll'
  phaseTime = 0
  pet.mode = 'ragdoll'
  falling = false
  wander = null
  dragSample = { x, y }
  dragVel = { x: 0, y: 0 }
  grabNeck(doll, x, y)
}

function dragVelocity(delta) {
  if (!dragSample) {
    dragSample = { x: pointer.x, y: pointer.y }
    return dragVel
  }
  const dt = Math.max(delta, 0.016)
  dragVel = {
    x: (pointer.x - dragSample.x) / dt,
    y: (pointer.y - dragSample.y) / dt,
  }
  dragSample = { x: pointer.x, y: pointer.y }
  return dragVel
}

function launchDoll(vx, vy) {
  player.updateWorldMatrix(true, true)
  if (doll) {
    releaseDoll(doll)
  }
  doll = createDoll(bones, player, rig, vx, -vy, -floorY())
  phase = 'ragdoll'
  phaseTime = 0
  pet.seatId = null
  pet.mode = 'ragdoll'
  wander = null
  falling = false
  windowGone = false
  shakeCount = 0
  seatMotion = null
  if (chicken) {
    chicken.group.visible = false
  }
}

function followSeat() {
  if (holding || falling || phase === 'leap' || phase === 'ragdoll' || phase === 'glance' || !pet.seatId) {
    if (!pet.seatId) {
      windowGone = false
    }
    return
  }
  const listed = windows.find((item) => item.id === pet.seatId)
  const win = listed && liveSeat && liveSeat.id === listed.id
    ? { ...listed, x: liveSeat.x, y: liveSeat.y, width: liveSeat.width, height: liveSeat.height }
    : listed
  if (!win || win.y < TOP_LIMIT) {
    windowGone = true
    return
  }
  windowGone = false
  noteWindowShake(win)
  if (phase === 'fling') {
    return
  }
  const min = win.x + 36
  const max = Math.max(min, win.x + win.width - 36)
  pet.x = Math.min(max, Math.max(min, win.x + pet.seatOffset))
  pet.y = win.y
  pet.mode = 'sit'
}

function beginWander() {
  menuSleep = false
  pet.seatId = null
  pet.mode = 'idle'
  if (ANDROID && window.PetBridge) {
    const x = Number(window.PetBridge.screenX())
    const span = Number(window.PetBridge.screenWidth())
    const win = Number(window.PetBridge.windowWidth())
    const margin = 8
    const right = Math.max(margin + 1, span - win - margin)
    const dir = Math.random() < 0.5 ? -1 : 1
    let target = x + dir * (120 + Math.random() * 320)
    if (target < margin || target > right) {
      target = dir > 0 ? right : margin
    }
    if (Math.abs(target - x) < 48) {
      target = x < span / 2 ? right : margin
    }
    wander = { targetX: target, face: target >= x ? 1 : -1 }
    calm = 0
    return
  }
  const margin = 72
  const left = margin
  const right = Math.max(left + 1, window.innerWidth - margin)
  const dir = Math.random() < 0.5 ? -1 : 1
  let target = pet.x + dir * (260 + Math.random() * 420)
  if (target < left || target > right) {
    target = dir > 0 ? right : left
  }
  if (Math.abs(target - pet.x) < 140) {
    target = pet.x < window.innerWidth / 2 ? right : left
  }
  wander = { targetX: target, face: target >= pet.x ? 1 : -1 }
  calm = 0
}

function stepWander(delta) {
  if (!wander || holding) {
    return
  }
  if (ANDROID && window.PetBridge) {
    const x = Number(window.PetBridge.screenX())
    const dx = wander.targetX - x
    if (Math.abs(dx) <= 4) {
      wander = null
      calm = 0
      idleWait = 20 + Math.random() * 25
      return
    }
    wander.face = dx > 0 ? 1 : -1
    const step = Math.sign(dx) * Math.min(Math.abs(dx), 140 * delta)
    window.PetBridge.moveBy(Math.round(step), 0)
    pet.mode = 'idle'
    return
  }
  const dx = wander.targetX - pet.x
  if (Math.abs(dx) <= 3) {
    pet.x = wander.targetX
    wander = null
    calm = 0
    idleWait = 20 + Math.random() * 25
    player.scale.set(SCALE, SCALE, SCALE)
    return
  }
  wander.face = dx > 0 ? 1 : -1
  if (mcWorld) {
    pet.mode = 'idle'
    return
  }
  pet.x += Math.sign(dx) * Math.min(Math.abs(dx), 86 * delta)
  pet.y = floorY()
  pet.mode = 'idle'
}

function beginClimb(hint) {
  const land = worldToScreen(hint.landX, hint.landY)
  climb = {
    t: 0,
    crouch: 0.5,
    duration: 1.55,
    fromX: pet.x,
    fromY: pet.y,
    toX: land.x,
    toY: land.y,
  }
  poseTime = 0
  poseName = 'PET_JUMP'
  pet.vx = 0
  pet.vy = 0
  pet.jumping = false
}

function stepClimb(delta) {
  climb.t += delta
  if (climb.t < climb.crouch) {
    return
  }
  if (climb.t >= climb.duration) {
    pet.x = climb.toX
    pet.y = climb.toY
    pet.vy = 0
    pet.onGround = true
    climb = null
    return
  }
  const u = (climb.t - climb.crouch) / (climb.duration - climb.crouch)
  const ease = u * u * (3 - 2 * u)
  pet.x = climb.fromX + (climb.toX - climb.fromX) * ease
  const hop = Math.sin(Math.PI * u) * 28
  pet.y = climb.fromY + (climb.toY - climb.fromY) * ease - hop
}

function startFall() {
  wander = null
  phase = null
  phaseTime = 0
  if (pet.seatId) {
    ignoreSeatId = pet.seatId
  }
  pet.seatId = null
  pet.mode = 'fall'
  falling = true
  windowGone = false
  menuSleep = false
  actions.lockedUntil = 0
  if (chicken) {
    chicken.group.visible = true
  }
}

function startBuild(json) {
  buildQueue = parseSchematic(json || starterSchematic)
  buildJob = null
  buildBusy = false
  phase = 'build'
  phaseTime = 0
  wander = null
  pet.mode = 'idle'
}

async function stepBuild(delta) {
  if (holding || !mcWorld || buildBusy) {
    return
  }
  if (!buildJob) {
    if (!buildQueue.length) {
      phase = null
      pet.mode = 'idle'
      await mcWorld.holdItem(null)
      return
    }
    const block = buildQueue.shift()
    buildJob = {
      block,
      stage: 'walk',
      t: 0,
      placed: false,
      settled: false,
    }
    wander = null
    return
  }
  const job = buildJob
  if (job.stage !== 'swing' && placeGap(job.block, pet.x) >= 0.2) {
    job.stage = 'walk'
    job.settled = false
    job.t = 0
    job.targetX = approachScreenX(job.block, pet.x)
    const dx = job.targetX - pet.x
    wander = { targetX: job.targetX, face: dx > 0 ? 1 : -1 }
    return
  }
  if (job.stage === 'walk') {
    wander = null
    job.face = blockScreenX(job.block) >= pet.x ? 1 : -1
    if (!job.settled) {
      job.settled = true
      return
    }
    job.stage = 'hold'
    job.t = 0
    buildBusy = true
    await mcWorld.holdItem(job.block.id)
    buildBusy = false
    return
  }
  job.t += delta
  if (job.stage === 'hold' && job.t > 0.12) {
    job.stage = 'swing'
    job.t = 0
    poseTime = 0
    poseName = 'PET_PLACE'
    return
  }
  if (job.stage === 'swing') {
    if (!job.placed && job.t > 0.38) {
      job.placed = true
      buildBusy = true
      await mcWorld.placeBlock(job.block.x, job.block.y, job.block.id, job.block.properties, undefined, job.block.z ?? 0)
      pet.y = standOnPlaced(job.block)
      pet.vy = 0
      pet.onGround = true
      buildBusy = false
    }
    if (job.t > 0.85) {
      buildJob = null
      wander = null
    }
  }
}

function think(delta) {
  actions.elapsed += delta
  if (holding) {
    climb = null
  }
  if (phase) {
    phaseTime += delta
  }
  const sitting = Boolean(pet.seatId) && !holding && phase !== 'leap' && !falling
  if (sitting && !phase) {
    sitCalm += delta
  } else if (!sitting) {
    sitCalm = 0
  }
  if (!holding && !falling && !phase && !wander && (actions.is('idle') || !pet.seatId)) {
    calm += delta
  } else if (holding || falling || phase) {
    calm = 0
  }
  const locked = actions.lockedUntil > 0 && actions.elapsed < actions.lockedUntil
  const choice = choosePetAction({
    holding,
    falling,
    phase,
    sitting,
    windowGone,
    sitCalm,
    sitWait,
    climb: Boolean(climb),
    wander: Boolean(wander),
    menuSleep,
    locked,
    calm,
    idleWait,
  })
  if (choice !== 'walk' && choice !== 'wander' && choice !== 'build' && choice !== 'climb') {
    wander = null
  }
  if (choice === 'window-gone' || (choice === 'fall' && windowGone)) {
    startFall()
  } else if (choice === 'sit-bored' && phase !== 'look') {
    phase = 'look'
    phaseTime = 0
    wander = null
  } else if (choice === 'look' && phaseTime > 1.15) {
    phase = 'leap'
    phaseTime = 0
    ignoreSeatId = pet.seatId
    pet.seatId = null
    pet.mode = 'leap'
    windowGone = false
  } else if (choice === 'leap' && phaseTime > 0.48) {
    startFall()
  } else if (choice === 'wander') {
    beginWander()
  } else if (choice === 'dragging' || choice === 'sit' || choice === 'idle' || choice === 'menu' || choice === 'sleep') {
    if (phase !== 'ragdoll' && choice !== 'look') {
      phase = phase === 'look' || phase === 'leap' ? phase : null
    }
  }
  const resolved = climb
    ? 'climb'
    : phase === 'ragdoll' || phase === 'glance' || phase === 'leap' || phase === 'look'
      ? phase
      : falling
        ? 'fall'
        : choice
  if (resolved !== 'walk' && resolved !== 'wander' && resolved !== 'build' && resolved !== 'climb') {
    wander = null
  }
  return resolved
}

function clipFor(choice) {
  if (buildJob?.stage === 'swing') {
    return 'PET_PLACE'
  }
  if (pet.inWater && (choice === 'idle' || choice === 'walk' || choice === 'wander' || choice === 'fall')) {
    return 'PET_SWIM'
  }
  if (climb || choice === 'climb') {
    return 'PET_JUMP'
  }
  switch (choice) {
    case 'dragging':
      return 'PET_DRAGGING'
    case 'fall':
    case 'window-gone':
      return 'PET_FALL'
    case 'leap':
      return 'PET_LEAP'
    case 'ragdoll':
    case 'glance':
      return 'PET_IDLE'
    case 'look':
    case 'sit-bored':
      return 'PET_LOOK_DOWN'
    case 'sit':
      return 'PET_SITTING'
    case 'build':
      if (buildJob?.stage === 'walk') {
        return 'PET_WALK_BUILD'
      }
      return 'PET_IDLE'
    case 'walk':
    case 'wander':
      return 'PET_WALK_RIGHT'
    case 'sleep':
      return 'PET_SLEEPING'
    case 'menu':
      return actions.definition.animation
    default:
      return 'PET_IDLE'
  }
}

let frameChoice = 'idle'

function applyPose(delta) {
  if (holding) {
    menuSleep = false
    falling = false
    windowGone = false
    if (chicken) {
      chicken.group.visible = false
    }
  }
  const clip = clipFor(frameChoice)
  if (clip !== poseName) {
    poseName = clip
    poseTime = 0
  } else {
    poseTime += delta
  }
  if (phase !== 'ragdoll') {
    faceWalk(delta)
  }
  const seated = Boolean(pet.seatId) && phase !== 'leap' && !falling && !holding
  if (holding && phase !== 'ragdoll') {
    player.position.y = -HEAD * SCALE
  } else if (seated) {
    player.position.y = SEAT * SCALE
  } else {
    player.position.y = FEET * SCALE + standLift
  }
  playClip(bones, clip, poseTime, swing)
  if (phase === 'build') {
    bones.head.rotation.x = 0
  }
  if (phase === 'ragdoll' && doll) {
    syncDoll(doll)
  } else if (phase === 'glance') {
    bones.head.rotation.x = -0.35
    bones.head.rotation.y = Math.sin(phaseTime * 3.2) * 0.55
    bones.spine.rotation.x = -0.08
  }
  lookAtPointer(delta)
  if (falling) {
    fallYaw += delta * 0.55
  } else {
    fallYaw += (0 - fallYaw) * Math.min(1, delta * 3)
  }
  rig.rotation.y = fallYaw
  flapChicken(chicken, delta, performance.now() / 1000)
  if (mcWorld?.holdingRight()) {
    if (chicken) {
      chicken.group.visible = false
    }
  } else {
    holdChickenLeg(chicken, bones.rightArm, rig)
  }
}

function faceWalk(delta) {
  player.rotation.z += (0 - player.rotation.z) * Math.min(1, delta * 6)
  const face = wander && !holding
    ? wander.face
    : (phase === 'build' && buildJob?.face)
      ? buildJob.face
      : 0
  const target = face ? (face > 0 ? Math.PI / 2 : -Math.PI / 2) : 0
  let diff = target - faceYaw.current
  while (diff > Math.PI) {
    diff -= Math.PI * 2
  }
  while (diff < -Math.PI) {
    diff += Math.PI * 2
  }
  faceYaw.current += diff * Math.min(1, delta * 8)
  player.rotation.y = faceYaw.current
}

function lookAtPointer(delta) {
  if (phase === 'look' || phase === 'leap' || phase === 'ragdoll' || phase === 'glance' || phase === 'build' || climb || falling || (wander && !holding)) {
    return
  }
  rig.updateWorldMatrix(true, true)
  bones.head.getWorldPosition(headPoint)
  const dx = pointer.x - headPoint.x
  const dy = pointer.y - (-headPoint.y)
  const yaw = Math.max(-0.75, Math.min(0.75, Math.atan2(dx, 260)))
  const pitch = Math.max(-0.55, Math.min(0.6, Math.atan2(dy, 260)))
  const blend = Math.min(1, delta * 10)
  look.yaw += (yaw - look.yaw) * blend
  look.pitch += (pitch - look.pitch) * blend
  bones.head.rotation.y = look.yaw
  bones.head.rotation.x = look.pitch
}

function place(delta) {
  frameChoice = think(delta)
  if (phase === 'build') {
    stepBuild(delta)
  }
  if (frameChoice === 'walk' || frameChoice === 'wander' || (frameChoice === 'build' && buildJob?.stage === 'walk')) {
    stepWander(delta)
  }
  if (holding && phase === 'ragdoll' && doll) {
    const vel = dragVelocity(delta)
    if (Math.hypot(vel.x, vel.y) > 2800) {
      releaseNeck(doll, vel.x, vel.y)
      holding = false
      pressing = false
    } else if (doll.pin) {
      grabNeck(doll, pet.x, pet.y)
    }
  }
  if (phase === 'ragdoll' && doll) {
    const state = stepDoll(doll, delta, -floorY(), window.innerWidth)
    const body = doll.parts[0].body
    body.updateMesh()
    const pos = body.getPosition()
    if (!holding) {
      pet.x = pos.x
      pet.y = -pos.y
    }
    const onBar = state.y < -floorY() + 80
    const lying = !doll.pin && onBar && (state.speed < 160 || (doll.rest > 0.25 && state.speed < 280))
    if (lying) {
      doll.rest += delta
      if (doll.rest >= 6) {
        releaseDoll(doll)
        doll = null
        phase = 'glance'
        phaseTime = 0
        pet.mode = 'idle'
        pet.y = floorY()
      }
    } else {
      doll.rest = 0
    }
  } else if (phase === 'glance') {
    pet.y = floorY()
    if (phaseTime > 1.05) {
      phase = null
      pet.mode = 'idle'
    }
  } else if (phase === 'leap') {
    pet.y += (phaseTime < 0.18 ? -120 : 40) * delta
  } else if (climb) {
    stepClimb(delta)
  } else if (mcWorld && !holding && phase !== 'ragdoll' && phase !== 'glance' && phase !== 'leap' && !pet.seatId) {
    mcWorld.stepActor(pet, delta, { wander, ignoreWindowId: ignoreSeatId })
    if (pet.climbHint && phase !== 'build') {
      beginClimb(pet.climbHint)
      pet.climbHint = null
    }
    falling = !pet.onGround && !pet.inWater
    if (pet.onGround && chicken && !mcWorld.holdingRight()) {
      chicken.group.visible = false
    }
    if (falling && chicken && !mcWorld.holdingRight()) {
      chicken.group.visible = true
    }
  } else if (falling) {
    pet.y = Math.min(floorY(), pet.y + 46 * delta)
    if (pet.y >= floorY() - 1) {
      pet.y = floorY()
      falling = false
      pet.mode = 'idle'
      if (chicken) {
        chicken.group.visible = false
      }
      actions.handle('drag-end')
    }
  } else if (!holding && pet.mode === 'idle') {
    pet.y += (floorY() - pet.y) * Math.min(1, delta * 8)
  }
  swing.x += (0 - swing.x) * Math.min(1, delta * 4)
  swing.z += (0 - swing.z) * Math.min(1, delta * 4)
  if (ANDROID && !holding && phase !== 'ragdoll' && phase !== 'glance' && phase !== 'leap' && !falling) {
    pet.x = window.innerWidth / 2
    pet.y = floorY()
  }
  if (ignoreSeatId) {
    const win = windows.find((item) => item.id === ignoreSeatId)
    if (!win || pet.y > win.y + 80) {
      ignoreSeatId = null
    }
  }
  applyDaylight()
  rig.position.set(pet.x, -pet.y, BLOCK_PX)
  applyPose(delta)
  rig.position.z = BLOCK_PX
}

function bodyHeight() {
  return (22 - -16.25) * SCALE
}

function hitRect() {
  const height = bodyHeight()
  if (holding) {
    return { x: pet.x - 28, y: pet.y - 36, width: 56, height: height }
  }
  if (pet.mode === 'sit') {
    return { x: pet.x - 40, y: pet.y - height * 0.85, width: 80, height: height }
  }
  return { x: pet.x - 28, y: pet.y - height, width: 56, height }
}

const CHIBI_LIMBS = ['body', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg']
let chibiRest = null

function rememberChibiRest() {
  if (chibiRest) {
    return
  }
  chibiRest = {}
  for (const name of ['head', ...CHIBI_LIMBS]) {
    chibiRest[name] = bones[name].position.clone()
  }
}

const petSettings = { build: 'wide', chibi: false, skin: '', skinName: '', hidden: false }
let settingsToken = 0
let pendingWorld = null

function savePetSettings() {
  settingsToken += 1
  const { world, ...rest } = petSettings
  const payload = JSON.stringify(rest)
  if (ANDROID) {
    window.PetBridge.saveSettings(JSON.stringify(petSettings))
    return
  }
  invoke('save_pet_settings', { settings: payload }).catch(() => {
    status.textContent = '模型设置没能保存'
  })
}

function saveWorldFile(world) {
  if (ANDROID) {
    petSettings.world = world
    savePetSettings()
    return
  }
  invoke('save_world', { world: JSON.stringify(world) }).catch((error) => {
    status.textContent = `世界存档没能保存：${error}`
  })
}

function loadWorldFile() {
  if (ANDROID) {
    return Promise.resolve(petSettings.world || null)
  }
  return invoke('load_world').then((text) => {
    if (!text) {
      return null
    }
    try {
      return JSON.parse(text)
    } catch {
      return null
    }
  }).catch(() => null)
}

function applyChibi(on, remember = true) {
  rememberChibiRest()
  chibi = on
  const s = on ? 0.8 : 1
  bones.head.scale.setScalar(on ? 1.4 : 1)
  bones.head.position.copy(chibiRest.head)
  bones.body.scale.setScalar(s)
  bones.body.position.copy(chibiRest.body)
  bones.body.position.y = chibiRest.body.y + 6 * (1 - s)
  for (const name of ['leftArm', 'rightArm']) {
    const rest = chibiRest[name]
    bones[name].scale.setScalar(s)
    bones[name].position.copy(rest)
    bones[name].position.x = rest.x * s
    bones[name].position.y = rest.y + 2 * (1 - s)
  }
  for (const name of ['leftLeg', 'rightLeg']) {
    const rest = chibiRest[name]
    bones[name].scale.setScalar(s)
    bones[name].position.copy(rest)
    bones[name].position.x = rest.x * s
    bones[name].position.y = rest.y + 12 * (1 - s)
    bones[name].position.z = rest.z * s
  }
  recacheStandLift()
  petSettings.chibi = on
  if (remember) {
    savePetSettings()
  }
}

function applyBuild(slim, remember = true) {
  player.skin.modelType = slim ? 'slim' : 'default'
  if (chibiRest) {
    applyChibi(chibi, false)
  }
  petSettings.build = slim ? 'slim' : 'wide'
  if (remember) {
    savePetSettings()
  }
}

function applySkin(url, name, remember = true) {
  const loader = new THREE.TextureLoader()
  loader.load(url, (texture) => {
    texture.magFilter = THREE.NearestFilter
    texture.minFilter = THREE.NearestFilter
    texture.generateMipmaps = false
    texture.colorSpace = THREE.SRGBColorSpace
    const previous = player.skin.map
    player.skin.map = texture
    if (previous && previous !== texture) {
      previous.dispose()
    }
    petSettings.skin = url
    petSettings.skinName = name || petSettings.skinName
    if (remember) {
      savePetSettings()
    }
  }, undefined, () => {
    status.textContent = '皮肤读取失败'
  })
}

function legacyPetSettings() {
  try {
    const build = localStorage.getItem('mc-pet-build')
    const chibiFlag = localStorage.getItem('mc-pet-chibi')
    const skin = localStorage.getItem('mc-pet-skin')
    const skinName = localStorage.getItem('mc-pet-skin-name')
    if (!build && chibiFlag === null && !skin) {
      return null
    }
    return {
      build: build === 'slim' ? 'slim' : 'wide',
      chibi: chibiFlag === '1',
      skin: skin || '',
      skinName: skinName || '',
    }
  } catch {
    return null
  }
}

function usePetSettings(data, remember) {
  applyChibi(Boolean(data.chibi), false)
  applyBuild(data.build === 'slim', false)
  if (typeof data.hidden === 'boolean') {
    hidden = data.hidden
    petSettings.hidden = hidden
    rig.visible = !hidden
  }
  if (data.world) {
    pendingWorld = data.world
    saveWorldFile(data.world)
    mcWorld?.loadSave(data.world)
    savePetSettings()
  }
  if (typeof data.skin === 'string' && data.skin) {
    applySkin(data.skin, data.skinName || '', false)
  }
  if (remember) {
    savePetSettings()
  }
}

function restorePetSettings() {
  if (ANDROID) {
    try {
      const text = window.PetBridge.loadSettings()
      if (text) {
        usePetSettings(JSON.parse(text), false)
      }
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : String(error)
    }
    return
  }
  const token = settingsToken
  invoke('load_pet_settings')
    .then((text) => {
      if (token !== settingsToken) {
        return
      }
      if (text) {
        usePetSettings(JSON.parse(text), false)
        return
      }
      const legacy = legacyPetSettings()
      if (legacy) {
        usePetSettings(legacy, true)
      }
    })
    .catch(() => {})
}

restorePetSettings()

function publishPointer() {
  if (ANDROID) {
    return
  }
  const rects = hidden ? [] : [hitRect(), ...(mcWorld?.blockHitRects() ?? [])]
  invoke('set_pointer_targets', { rects, held: holding && !hidden })
    .then((cursor) => {
      if (cursor && Number.isFinite(cursor.x) && Number.isFinite(cursor.y)) {
        pointer.x = cursor.x
        pointer.y = cursor.y
      }
    })
    .catch(() => {})
}

function bindPointer() {
  window.addEventListener('pointerdown', (event) => {
    const rect = hitRect()
    const over = event.clientX >= rect.x && event.clientX <= rect.x + rect.width
      && event.clientY >= rect.y && event.clientY <= rect.y + rect.height
    if (!over) {
      return
    }
    pressing = true
    hovering = false
    pressX = event.clientX
    pressY = event.clientY
    lastPointer = { x: event.clientX, y: event.clientY }
  })
  window.addEventListener('pointermove', (event) => {
    const rect = hitRect()
    const over = event.clientX >= rect.x && event.clientX <= rect.x + rect.width
      && event.clientY >= rect.y && event.clientY <= rect.y + rect.height
    if (!holding && over && !hovering && pet.mode !== 'sit') {
      hovering = true
      actions.handle('hover')
    }
    if (!over) {
      hovering = false
    }
    if (pressing && !holding) {
      const moved = Math.hypot(event.clientX - pressX, event.clientY - pressY)
      if (moved > 8) {
        holding = true
        falling = false
        if (chicken) {
          chicken.group.visible = false
        }
        avoidSeat = pet.seatId
        pet.seatId = null
        beginDragDoll(event.clientX, event.clientY)
        actions.handle('drag-start')
        publishPointer()
      }
    }
    if (!holding) {
      return
    }
    const dx = event.clientX - lastPointer.x
    const dy = event.clientY - lastPointer.y
    lastPointer = { x: event.clientX, y: event.clientY }
    pointer.x = event.clientX
    pointer.y = event.clientY
    if (mcWorld) {
      const at = mcWorld.resolvePosition(event.clientX, event.clientY)
      pet.x = at.x
      pet.y = at.y
    } else {
      pet.x = event.clientX
      pet.y = event.clientY
    }
    swing.z = Math.max(-0.7, Math.min(0.7, dx * 0.02))
    swing.x = Math.max(-0.45, Math.min(0.45, dy * 0.015))
  })
  window.addEventListener('pointerup', (event) => {
    if (!pressing && !holding) {
      return
    }
    const wasHolding = holding
    pressing = false
    holding = false
    const moved = Math.hypot(event.clientX - pressX, event.clientY - pressY)
    if (!wasHolding || moved < 10) {
      const now = performance.now()
      if (now - lastTap < 320) {
        actions.handle('dance')
      } else {
        actions.handle('touch')
      }
      lastTap = now
      return
    }
    if (trySit(event.clientX, event.clientY, true)) {
      return
    }
    pet.seatId = null
    if (doll) {
      releaseNeck(doll, dragVel.x, dragVel.y)
      phase = 'ragdoll'
      pet.mode = 'ragdoll'
      return
    }
    if (event.clientY < floorY() - 36) {
      falling = true
      pet.mode = 'fall'
      pet.y = event.clientY
      if (chicken) {
        chicken.group.visible = true
      }
      actions.handle('idle')
      return
    }
    falling = false
    pet.mode = 'idle'
    pet.y = floorY()
    actions.handle('drag-end')
  })
}

function frame(now) {
  const delta = Math.min(0.05, (now - lastFrame) / 1000)
  lastFrame = now
  try {
    if (pet.seatId && !holding && !falling && phase !== 'leap' && phase !== 'ragdoll' && phase !== 'glance') {
      pollSeat()
    }
    followSeat()
    place(delta)
    publishPointer()
    mcWorld?.tick(camera)
    renderer.render(scene, camera)
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : String(error)
  }
  requestAnimationFrame(frame)
}

function onPetMenu(payload) {
  const action = payload?.action
  if (action === 'chibi') {
    applyChibi(Boolean(payload.on))
    return
  }
  if (action === 'build') {
    applyBuild(Boolean(payload.slim))
    return
  }
  if (action === 'reload-settings') {
    restorePetSettings()
    return
  }
  if (action === 'hidden') {
    hidden = Boolean(payload.on)
    petSettings.hidden = hidden
    rig.visible = !hidden
    if (hidden) {
      holding = false
      pressing = false
    }
    savePetSettings()
    return
  }
  if (action === 'skin' && typeof payload.url === 'string') {
    applySkin(payload.url, payload.name)
    return
  }
  if (action === 'floor') {
    menuSleep = false
    pet.seatId = null
    pet.mode = 'idle'
    pet.y = floorY()
    actions.handle('idle')
    return
  }
  if (action === 'sleep') {
    menuSleep = true
    actions.play('sleep', { duration: 0 })
    return
  }
  if (action === 'happy') {
    menuSleep = false
    actions.play('happy')
    return
  }
  menuSleep = false
  actions.handle(action)
}

window.petMenu = onPetMenu
if (ANDROID) {
  window.petReload = () => restorePetSettings()
  window.petGrab = () => {
    holding = true
    pressing = true
    wander = null
    falling = false
    const neckY = Math.max(36, floorY() - 108)
    beginDragDoll(window.innerWidth / 2, neckY)
  }
  window.petDrop = (vx, vy) => {
    holding = false
    pressing = false
    if (doll && doll.pin) {
      releaseNeck(doll, Number(vx) || 0, Number(vy) || 0)
      phase = 'ragdoll'
      pet.mode = 'ragdoll'
    }
  }
} else {
  listen('pet-menu', (event) => onPetMenu(event.payload))
}

resize()
bindPointer()
createMc({
  parent: worldRoot,
  bones,
  getWindows: () => windows,
  onPersist: (world) => {
    saveWorldFile(world)
  },
}).then(async (api) => {
  mcWorld = api
  window.mc = api
  window.mc.build = (json) => startBuild(json || starterSchematic)
  const world = pendingWorld || await loadWorldFile()
  pendingWorld = null
  if (world?.blocks?.length || world?.hand || world?.offhand) {
    await api.loadSave(world)
  } else if (!ANDROID) {
    startBuild(starterSchematic)
  }
  if (!holding && pet.mode !== 'sit') {
    pet.y = window.innerHeight
    if (mcWorld) {
      const at = mcWorld.resolveSpawn(pet.x, pet.y)
      pet.x = at.x
      pet.y = at.y
    } else {
      pet.y = floorY()
    }
    pet.onGround = true
    pet.vy = 0
  }
}).catch((error) => {
  status.textContent = error instanceof Error ? error.message : String(error)
})
if (!ANDROID) {
  refreshWindows().catch((error) => {
    status.textContent = error.message
  })
  window.setInterval(() => {
    refreshWindows().catch((error) => {
      status.textContent = error.message
    })
  }, 100)
}
window.addEventListener('resize', resize)
requestAnimationFrame(frame)
