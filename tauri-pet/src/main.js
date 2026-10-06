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
import { BLOCK_PX, SCALE, screenToWorld, worldToScreen } from './mc/scale.js'
import { atScreenTop, frontCovers, seatAt, seatXOn } from './mc/window-order.js'
import { resolveEdgeX, rimClimbFace, stepScreenRim } from './mc/screen-edge.js'
import { lightLevels } from './mc/daylight.js'
import { parseSchematic } from './mc/build.js'
import { choosePlaceStand, feetInside } from './mc/place-tree.js'
import { playBreak, playPlace, playStep } from './mc/sounds.js'
import { swapDuration } from './mc/hotbar.js'
import { createHotbarView } from './mc/hotbar-view.js'
import { createCreativeView } from './mc/creative-view.js'
import { createStationView } from './mc/station-view.js'
import { stationKind } from './mc/stations.js'
import { applySwapArm } from './mc/swap-arm.js'
import starterSchematic from './mc/schematic.json'

const ANDROID = typeof window.PetBridge !== 'undefined'

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
const gaze = { yaw: 0, pitch: 0, wait: 0.8 }
const faceYaw = { current: 0 }
const HEAD_FOLLOW = 0.62
const pointer = { x: 180, y: 200 }
const headPoint = new THREE.Vector3()
const headTop = new THREE.Vector3()
const hotbarView = createHotbarView()
const stationView = createStationView({
  getHotbar: () => mcWorld?.hotbarState(),
  onClose: ({ where, parts }) => {
    if (!mcWorld) {
      return
    }
    if (parts) {
      for (const part of parts) {
        mcWorld.setContainerOpen(part.x, part.y, part.z, false)
      }
    } else if (where) {
      mcWorld.setContainerOpen(where.x, where.y, where.z, false)
    }
  },
  onSave: ({ where, nbt, player, parts }) => {
    if (!mcWorld) {
      return
    }
    if (player) {
      mcWorld.writePlayer(player)
    }
    if (parts) {
      for (const part of parts) {
        mcWorld.writeContainer(part.x, part.y, part.z, { items: part.items })
      }
      return
    }
    if (where) {
      mcWorld.writeContainer(where.x, where.y, where.z, nbt)
    }
  },
  onHotbar: (index, id) => {
    if (!mcWorld) {
      return
    }
    mcWorld.setHotbarSlot(index, id)
    hotbarView.sync(mcWorld.hotbarState())
  },
})
const creativeView = createCreativeView({
  getHotbar: () => mcWorld?.hotbarState(),
  onPick: (stack) => {
    const id = stack?.id ?? stack
    if (!mcWorld || !id) {
      return
    }
    mcWorld.commitHotbar(id)
    hotbarView.sync(mcWorld.hotbarState())
    creativeView.syncHotbar(mcWorld.hotbarState())
  },
  onSelect: (index) => {
    if (!mcWorld) {
      return
    }
    mcWorld.selectHotbar(index)
    hotbarView.sync(mcWorld.hotbarState())
    creativeView.syncHotbar(mcWorld.hotbarState())
  },
  onClear: (index) => {
    if (!mcWorld) {
      return
    }
    mcWorld.setHotbarSlot(index, null)
    hotbarView.sync(mcWorld.hotbarState())
    creativeView.syncHotbar(mcWorld.hotbarState())
  },
  onSetSlot: (index, id) => {
    if (!mcWorld) {
      return
    }
    mcWorld.setHotbarSlot(index, id)
    hotbarView.sync(mcWorld.hotbarState())
    creativeView.syncHotbar(mcWorld.hotbarState())
  },
  getPlayer: () => mcWorld?.playerItems() ?? [],
  setPlayer: (slots) => {
    mcWorld?.writePlayer(slots)
  },
  getSkin: () => ({
    map: player.skin.map,
    slim: player.skin.modelType === 'slim',
  }),
})
let swapAnim = null
let hotbarSeen = null
let hotbarReveal = 0
let windows = []
let taskbar = null
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
let shortFall = false
let dropFrom = 0
let dropTo = 0
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
let buildPlaced = 0
let stepMark = null
let stepDistance = 0
let climb = null
let edgeLeave = 0
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

function groundGap() {
  return Math.max(0, floorY() - pet.y)
}

function lowDrop() {
  return groundGap() < BLOCK_PX * 3.5
}

function hideChicken() {
  if (chicken) {
    chicken.group.visible = false
  }
}

function beginLand() {
  hideChicken()
  falling = false
  shortFall = false
  wander = null
  pet.vy = 0
  pet.onGround = true
  pet.mode = 'idle'
  pet.y = floorY()
  phase = 'land'
  phaseTime = 0
  poseName = 'PET_LAND'
  poseTime = 0
}

const FALL_DOWN_SPEED = 14.9

function standUp() {
  hideChicken()
  falling = false
  shortFall = false
  pet.vy = 0
  pet.onGround = true
  pet.mode = 'idle'
  if (phase === 'drop' || phase === 'land' || phase === 'fall') {
    phase = null
  }
  pet.y = floorY()
}

function settleLanding(worldVy) {
  const impact = Math.max(0, -(worldVy || 0))
  if (impact >= FALL_DOWN_SPEED && phase !== 'build' && phase !== 'ragdoll') {
    launchDoll((pet.vx || 0) * BLOCK_PX, impact * BLOCK_PX)
    return
  }
  standUp()
}

function beginShortDrop() {
  if (doll) {
    releaseDoll(doll)
    doll = null
  }
  wander = null
  windowGone = false
  standUp()
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
  if (!mcWorld?.blockSupportScreenY) {
    return false
  }
  const stand = mcWorld.blockSupportScreenY(x, y)
  return Math.abs(stand - y) < 64
}

let liveSeat = null
let seatBusy = false

async function refreshWindows() {
  const map = await invoke('desktop_map')
  windows = map.windows ?? []
  taskbar = map.taskbar ?? null
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
  return seatAt(windows, x, y, ignoreId)
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
  if (!seat || !sitOn(seat, x)) {
    return false
  }
  pressing = false
  holding = false
  actions.handle('sit')
  return true
}

function sitOn(win, x) {
  const at = seatXOn(win, windows, x)
  if (at == null) {
    return false
  }
  pet.x = at
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
  return true
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
  if (!win || atScreenTop(win)) {
    windowGone = true
    return
  }
  const seatX = seatXOn(win, windows, win.x + pet.seatOffset)
  if (seatX == null || frontCovers(windows, seatX, win.y, win.id)) {
    windowGone = true
    return
  }
  windowGone = false
  noteWindowShake(win)
  if (phase === 'fling') {
    return
  }
  pet.x = seatX
  pet.y = win.y
  pet.mode = 'sit'
}

function catchSeat() {
  if (pet.seatId || holding || falling || climb || phase) {
    return
  }
  if (avoidSeat && stillOver(avoidSeat, pet.x, pet.y)) {
    return
  }
  if (nearBlockStand(pet.x, pet.y)) {
    return
  }
  const seat = windowUnder(pet.x, pet.y, ignoreSeatId)
  if (!seat || Math.abs(pet.y - seat.y) > 28) {
    return
  }
  if (!sitOn(seat, pet.x)) {
    return
  }
  actions.handle('sit')
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
  if (!mcWorld?.findPath) {
    wander = { targetX: target, face: target >= pet.x ? 1 : -1 }
    calm = 0
    return
  }
  const options = [target, target < pet.x ? right : left, pet.x + (Math.random() < 0.5 ? -1 : 1) * (160 + Math.random() * 280)]
  for (const item of options) {
    const plan = planWalk(item)
    if (plan?.path) {
      wander = plan
      calm = 0
      return
    }
  }
  wander = null
  calm = 0
}

function planWalk(targetX) {
  const face = targetX >= pet.x ? 1 : -1
  if (!mcWorld?.findPath) {
    return { targetX, face, path: null, pi: 0, needPath: true }
  }
  const start = screenToWorld(pet.x, pet.y)
  const goal = screenToWorld(targetX, pet.y)
  const path = mcWorld.findPath(start.x, start.y, goal.x, goal.y)
  if (!path || path.length < 2) {
    return null
  }
  return { targetX, face, path, pi: 1, needPath: true }
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
  if (wander.path && wander.pi >= wander.path.length) {
    wander = null
    calm = 0
    idleWait = 20 + Math.random() * 25
    player.scale.set(SCALE, SCALE, SCALE)
    return
  }
  const dx = wander.targetX - pet.x
  if (!wander.path && Math.abs(dx) <= 3) {
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


function edgeCling(win, face) {
  const screenW = window.innerWidth
  const atLeft = win.x <= 40
  const atRight = win.x + win.width >= screenW - 40
  let useFace = face || 1
  if (atLeft && !atRight) {
    useFace = 1
  } else if (atRight && !atLeft) {
    useFace = -1
  } else if (atLeft && atRight) {
    useFace = pet.x < win.x + win.width / 2 ? 1 : -1
  } else if (!face) {
    const leftGap = Math.abs(pet.x - win.x)
    const rightGap = Math.abs(pet.x - (win.x + win.width))
    useFace = leftGap <= rightGap ? 1 : -1
  }
  const edge = useFace > 0 ? win.x : win.x + win.width
  const margin = atLeft || atRight ? 28 : 16
  let x = useFace > 0 ? edge - margin : edge + margin
  if (atLeft && useFace > 0) {
    x = Math.min(edge - 12, x)
  }
  if (atRight && useFace < 0) {
    x = Math.max(edge + 12, x)
  }
  return { face: useFace, edge, x, outside: atLeft || atRight, top: win.y, win }
}

function windowEdgeAhead() {
  if (!windows.length) {
    return null
  }
  const face = wander?.face || 0
  let best = null
  let bestGap = BLOCK_PX * 1.1
  for (const win of windows) {
    if (!win || win.height < 48 || win.width < 80) {
      continue
    }
    const cling = edgeCling(win, face)
    if (cling.outside) {
      continue
    }
    const gap = cling.face > 0 ? cling.edge - pet.x : pet.x - cling.edge
    if (gap < -36 || gap > bestGap) {
      continue
    }
    if (frontCovers(windows, cling.edge, pet.y, win.id)) {
      continue
    }
    if (pet.y < win.y - 8) {
      continue
    }
    if (pet.y > win.y + win.height + 48) {
      continue
    }
    bestGap = gap
    best = cling
  }
  return best
}

function screenBezelWindow(side) {
  const screenW = window.innerWidth
  const onLeft = side === 'left'
  let best = null
  let bestScore = Infinity
  for (const win of windows) {
    if (!win || win.height < 40 || win.width < 80) {
      continue
    }
    const edge = onLeft ? win.x : win.x + win.width
    const screenEdge = onLeft ? 0 : screenW
    if (Math.abs(edge - screenEdge) > 96) {
      continue
    }
    if (frontCovers(windows, edge, pet.y, win.id)) {
      continue
    }
    const score = Math.abs(win.y + win.height / 2 - pet.y)
    if (score < bestScore) {
      bestScore = score
      best = win
    }
  }
  return best
}

function carryClimbAcross(x) {
  return resolveEdgeX(x, window.innerWidth)
}

function beginRimClimb(side) {
  const screenW = window.innerWidth
  const onLeft = side === 'left'
  const win = screenBezelWindow(side)
  const face = rimClimbFace(side)
  const edge = onLeft ? 0 : screenW
  beginEdgeClimb({
    face,
    edge,
    x: onLeft ? 16 : Math.max(16, screenW - 16),
    outside: false,
    top: win ? win.y : Math.max(8, pet.y - 80),
    win,
    mountX: onLeft ? 36 : Math.max(36, screenW - 36),
  })
}

function tryBezelClimb() {
  if (!controlling || climb || holding || falling || edgeLeave > 0) {
    return
  }
  const next = stepScreenRim({
    x: pet.x,
    screenW: window.innerWidth,
    keys: controlKeys,
  })
  pet.x = next.x
  if (next.climb) {
    beginRimClimb(next.climb)
  }
}

function beginEdgeClimb(hit) {
  climb = {
    kind: 'edge',
    stage: controlKeys.w ? 'up' : 'hang',
    t: 0,
    face: hit.face,
    edge: hit.edge,
    outside: hit.outside,
    top: hit.top,
    bottom: hit.win ? hit.win.y + hit.win.height : window.innerHeight - 4,
    mountX: hit.mountX ?? (hit.face > 0 ? hit.edge + 36 : hit.edge - 36),
  }
  poseTime = 0
  poseName = controlKeys.w ? 'PET_EDGE_CLIMB' : 'PET_EDGE_HANG'
  pet.x = carryClimbAcross(hit.x)
  pet.vx = 0
  pet.vy = 0
  pet.onGround = false
  const held = mcWorld?.selectedBlock?.()
  if (held) {
    mcWorld.holdItem(held)
  }
}
function beginClimb(hint) {
  const land = worldToScreen(hint.landX, hint.landY)
  climb = {
    t: 0,
    crouch: 0.62,
    duration: 1.28,
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
  if (climb.kind === 'edge') {
    if (creativeView.isOpen() || stationView.isOpen()) {
      pet.vy = 0
      pet.onGround = false
      return
    }
    const margin = climb.outside ? 28 : 16
    let x = climb.face > 0 ? climb.edge - margin : climb.edge + margin
    if (climb.outside) {
      x = climb.face > 0 ? Math.min(climb.edge - 12, x) : Math.max(climb.edge + 12, x)
    }
    pet.x = carryClimbAcross(x)
    pet.vy = 0
    pet.onGround = false
    const away = climb.face > 0 ? controlKeys.a && !controlKeys.d : controlKeys.d && !controlKeys.a
    if (away) {
      climb = null
      pet.onGround = false
      edgeLeave = 0.45
      return
    }
    const ground = floorY()
    if (pet.y < ground - 12) {
      climb.aboveGround = true
    }
    if (controlKeys.w) {
      if (climb.stage !== 'up') {
        climb.stage = 'up'
        poseTime = 0
        poseName = 'PET_EDGE_CLIMB'
      }
      pet.y = Math.max(climb.top + 4, pet.y - 92 * delta)
      if (pet.y <= climb.top + 6) {
        pet.x = climb.mountX
        pet.y = climb.top
        pet.onGround = true
        pet.vy = 0
        climb = null
      }
      return
    }
    if (controlKeys.s) {
      if (climb.stage !== 'up') {
        climb.stage = 'up'
        poseTime = 0
        poseName = 'PET_EDGE_CLIMB'
      }
      pet.y = Math.min(ground, pet.y + 92 * delta)
    }
    if (climb.aboveGround && pet.y >= ground - 4) {
      pet.y = ground
      pet.onGround = true
      pet.vy = 0
      pet.mode = 'idle'
      climb = null
      edgeLeave = 0.45
      return
    }
    if (controlKeys.s) {
      return
    }
    if (climb.stage !== 'hang') {
      climb.stage = 'hang'
      poseTime = 0
      poseName = 'PET_EDGE_HANG'
    }
    return
  }
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
  const ease = u * u
  const peak = 0.36
  let hop = 0
  if (u <= peak) {
    const rise = u / peak
    hop = rise * rise * 32
  } else {
    const fall = (u - peak) / (1 - peak)
    hop = (1 - fall * fall) * 32
  }
  pet.x = climb.fromX + (climb.toX - climb.fromX) * ease
  pet.y = climb.fromY + (climb.toY - climb.fromY) * ease - hop
}

function startFall() {
  wander = null
  if (pet.seatId) {
    ignoreSeatId = pet.seatId
  }
  pet.seatId = null
  windowGone = false
  menuSleep = false
  actions.lockedUntil = 0
  if (lowDrop()) {
    shortFall = true
    falling = false
    hideChicken()
    pet.onGround = false
    pet.mode = 'idle'
    return
  }
  phase = null
  phaseTime = 0
  pet.mode = 'fall'
  falling = true
  shortFall = false
  if (chicken && !mcWorld?.holdingRight()) {
    chicken.group.visible = true
  }
}

function startBuild(json) {
  buildQueue = parseSchematic(json || starterSchematic)
  buildJob = null
  buildBusy = false
  buildPlaced = 0
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
      swapAnim = null
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
  if (job.stage === 'walk' || !job.stage) {
    if (climb) {
      return
    }
    const feet = screenToWorld(pet.x, pet.y)
    const plan = choosePlaceStand({
      feet,
      block: job.block,
      getBlock: (x, y) => mcWorld.getBlock(x, y, job.block.z ?? 0),
      getSupport: (x, y) => mcWorld.getBlock(x, y, 1),
    })
    if (!plan) {
      if (job.block.retried && job.block.seenPlaced === buildPlaced) {
        buildJob = null
        wander = null
        return
      }
      buildQueue.push({ ...job.block, retried: true, seenPlaced: buildPlaced })
      buildJob = null
      wander = null
      return
    }
    const buried = feetInside(feet, (x, y) => mcWorld.getBlock(x, y, 1))
    if (plan.move || buried) {
      const stand = worldToScreen(plan.stand.x, plan.stand.y)
      job.stage = 'walk'
      job.face = plan.face
      job.standY = plan.stand.y
      job.settled = false
      if (buried) {
        pet.x = stand.x
        pet.y = stand.y
        pet.vy = 0
        pet.onGround = true
        wander = null
        return
      }
      wander = { targetX: stand.x, face: stand.x >= pet.x ? 1 : -1 }
      return
    }
    wander = null
    job.standY = null
    job.face = plan.face
    if (!job.settled) {
      job.settled = true
      job.stage = 'walk'
      return
    }
    job.stage = 'hold'
    job.t = 0
    if (!job.committed) {
      job.committed = true
      const change = mcWorld.commitHotbar(job.block.id)
      job.swapHold = change.direction ? swapDuration(change.distance) : 0.12
      job.holdReady = false
      if (change.direction) {
        swapAnim = { t: 0, duration: job.swapHold, direction: change.direction }
      }
      mcWorld.holdItem(change.id).finally(() => {
        job.holdReady = true
      })
    }
    return
  }
  job.t += delta
  if (job.stage === 'hold' && job.t > (job.swapHold ?? 0.12) && job.holdReady) {
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
      const placed = await mcWorld.placeBlock(job.block.x, job.block.y, job.block.id, job.block.properties, undefined, job.block.z ?? 0)
      if (placed?.ok) {
        buildPlaced += 1
        playPlace(job.block.id)
      }
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
    if (phase !== 'ragdoll' && phase !== 'drop' && phase !== 'land' && choice !== 'look') {
      phase = phase === 'look' || phase === 'leap' ? phase : null
    }
  }
  const resolved = climb
    ? 'climb'
    : phase === 'ragdoll' || phase === 'glance' || phase === 'leap' || phase === 'look' || phase === 'drop' || phase === 'land'
      ? phase
      : shortFall
        ? 'idle'
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
  if (climb?.kind === 'edge') {
    return climb.stage === 'hang' ? 'PET_EDGE_HANG' : 'PET_EDGE_CLIMB'
  }
  if (!pet.onGround && !pet.inWater && !falling && (choice === 'idle' || choice === 'walk' || choice === 'wander')) {
    return 'PET_HOP'
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
    case 'drop':
      return 'PET_IDLE'
    case 'land':
      return 'PET_LAND'
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
    swapAnim = null
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
  if (swapAnim) {
    const u = Math.min(1, swapAnim.t / swapAnim.duration)
    applySwapArm(bones.leftArm, player.rotation.y + rig.rotation.y, swapAnim.direction, u)
    swapAnim.t += delta
    if (swapAnim.t >= swapAnim.duration) {
      swapAnim = null
    }
  }
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
  lookAround(delta)
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

function wrapAngle(value) {
  let angle = value
  while (angle > Math.PI) {
    angle -= Math.PI * 2
  }
  while (angle < -Math.PI) {
    angle += Math.PI * 2
  }
  return angle
}

function walkFace() {
  if (climb?.face) {
    return climb.face
  }
  if (wander && !holding) {
    return wander.face
  }
  if (phase === 'build' && buildJob?.face) {
    return buildJob.face
  }
  return 0
}

function faceWalk(delta) {
  const lean = climb?.kind === 'edge' ? (climb.face > 0 ? 0.42 : -0.42) : 0
  player.rotation.z += (lean - player.rotation.z) * Math.min(1, delta * 6)
  const face = walkFace()
  if (face) {
    const target = face > 0 ? Math.PI / 2 : -Math.PI / 2
    const diff = wrapAngle(target - faceYaw.current)
    faceYaw.current = wrapAngle(faceYaw.current + diff * Math.min(1, delta * 8))
  }
  player.rotation.y = faceYaw.current
}

function lookBusy() {
  return phase === 'look' || phase === 'leap' || phase === 'ragdoll' || phase === 'glance' || phase === 'build' || climb || falling
}

function lookAround(delta) {
  if (lookBusy()) {
    return
  }
  const walking = Boolean(walkFace())
  const blend = Math.min(1, delta * (walking || holding ? 8 : 3.2))
  if (walking || holding) {
    look.yaw += (0 - look.yaw) * blend
    look.pitch += (0 - look.pitch) * blend
    gaze.wait = 0.5 + Math.random() * 0.6
    bones.head.rotation.y = look.yaw
    bones.head.rotation.x = look.pitch
    return
  }
  gaze.wait -= delta
  if (gaze.wait <= 0) {
    const wide = Math.random() < 0.38
    gaze.yaw = (Math.random() * 2 - 1) * (wide ? 1.5 : 0.72)
    gaze.pitch = Math.random() * 0.7 - 0.28
    gaze.wait = 0.85 + Math.random() * 2.4
  }
  look.yaw += (gaze.yaw - look.yaw) * blend
  look.pitch += (gaze.pitch - look.pitch) * blend
  if (look.yaw > HEAD_FOLLOW) {
    faceYaw.current += look.yaw - HEAD_FOLLOW
    look.yaw = HEAD_FOLLOW
  } else if (look.yaw < -HEAD_FOLLOW) {
    faceYaw.current += look.yaw + HEAD_FOLLOW
    look.yaw = -HEAD_FOLLOW
  }
  if (Math.abs(gaze.yaw) < 0.3) {
    faceYaw.current += (0 - faceYaw.current) * Math.min(1, delta * 1.5)
  }
  faceYaw.current = wrapAngle(faceYaw.current)
  player.rotation.y = faceYaw.current
  bones.head.rotation.y = look.yaw
  bones.head.rotation.x = look.pitch
}

function place(delta) {
  tickBlockHold()
  stationView.tick(delta)
  frameChoice = think(delta)
  if (controlling) {
    steerControl()
  } else if (phase === 'build') {
    stepBuild(delta)
  }
  const moving = controlling
    ? Boolean(wander)
    : ((frameChoice === 'walk' || frameChoice === 'wander' || (frameChoice === 'build' && buildJob?.stage === 'walk')))
  if (edgeLeave > 0) {
    edgeLeave = Math.max(0, edgeLeave - delta)
  }
  tryBezelClimb()
  const screenW = window.innerWidth
  const atBezel = pet.x <= 40 || pet.x >= screenW - 40
  if (controlling && !climb && !holding && !falling && edgeLeave <= 0 && !atBezel && (moving || controlKeys.w)) {
    const edge = windowEdgeAhead()
    if (edge) {
      beginEdgeClimb(edge)
    }
  }
  const buildFeet = screenToWorld(pet.x, pet.y)
  const buildLedge = phase === 'build' && buildJob?.stage === 'walk' && buildJob.standY > buildFeet.y + 0.6
  if (!climb && moving && !buildLedge) {
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
  } else if (phase === 'drop') {
    const u = Math.min(1, phaseTime / 0.12)
    pet.y = dropFrom + (dropTo - dropFrom) * u * u
    if (u >= 1) {
      pet.y = dropTo
      const dropSpeed = Math.sqrt(Math.max(0, (dropTo - dropFrom) / BLOCK_PX) * 64)
      settleLanding(-dropSpeed)
    }
  } else if (phase === 'land') {
    pet.y = floorY()
    if (phaseTime > 0.36) {
      phase = null
      pet.mode = 'idle'
    }
  } else if (climb) {
    stepClimb(delta)
  } else if (mcWorld && !holding && phase !== 'ragdoll' && phase !== 'glance' && phase !== 'leap' && phase !== 'drop' && phase !== 'land' && !pet.seatId) {
    const incomingVy = pet.vy || 0
    const wasGround = !!pet.onGround
    mcWorld.stepActor(pet, delta, {
      wander,
      ignoreWindowId: ignoreSeatId,
      parachute: falling && !mcWorld.holdingRight(),
      wantJump: controlling && controlKeys.w && !creativeView.isOpen() && !stationView.isOpen(),
    })
    if (pet.blocked && wander?.needPath) {
      wander = null
      calm = 0
    }
    const airborne = !pet.onGround && !pet.inWater
    if (!wasGround && pet.onGround && !pet.inWater && !climb && phase !== 'build' && phase !== 'ragdoll') {
      settleLanding(incomingVy)
    } else if (airborne && !falling && !shortFall && !lowDrop()) {
      falling = true
      pet.mode = 'fall'
      if (chicken && !mcWorld.holdingRight()) {
        chicken.group.visible = true
      }
    } else if (!airborne) {
      shortFall = false
      if (!falling) {
        hideChicken()
      }
      catchSeat()
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
      catchSeat()
    }
  } else if (!holding && pet.mode === 'idle') {
    pet.y += (floorY() - pet.y) * Math.min(1, delta * 8)
    if (Math.abs(floorY() - pet.y) < 2) {
      catchSeat()
    }
  }
  tryBezelClimb()
  if (phase !== 'ragdoll' && !ANDROID) {
    pet.x = resolveEdgeX(pet.x, window.innerWidth)
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
  updateFootsteps()
  applyDaylight()
  rig.position.set(pet.x, -pet.y, BLOCK_PX)
  applyPose(delta)
  updateHotbar(delta)
  rig.position.z = BLOCK_PX
}

function updateFootsteps() {
  if (hidden || !pet.onGround || holding || pet.seatId || pet.mode === 'sit') {
    stepDistance = 0
    stepMark = pet.x
    return
  }
  if (stepMark == null) {
    stepMark = pet.x
    return
  }
  const moved = Math.abs(pet.x - stepMark)
  stepMark = pet.x
  if (moved < 0.4 || moved > BLOCK_PX * 1.5) {
    return
  }
  stepDistance += moved
  if (stepDistance < BLOCK_PX * 0.62) {
    return
  }
  stepDistance = 0
  const feet = screenToWorld(pet.x, pet.y)
  const under = mcWorld?.getBlock(Math.floor(feet.x), Math.floor(feet.y - 0.05), 1)
  playStep(under?.id)
}

function updateHotbar(delta) {
  let switching = Boolean(swapAnim)
  if (mcWorld) {
    const state = mcWorld.hotbarState()
    const key = state.slots.join('|')
    if (hotbarSeen && !controlling && (hotbarSeen.selected !== state.selected || hotbarSeen.key !== key)) {
      hotbarReveal = 1.2
    }
    hotbarSeen = { selected: state.selected, key }
    hotbarView.sync(state)
    if (creativeView.isOpen()) {
      creativeView.syncHotbar(state)
    }
  }
  if (hotbarReveal > 0) {
    hotbarReveal -= delta
    switching = true
  }
  hotbarView.tick(delta)
  const show = !hidden && rig.visible && !stationView.isOpen() && (controlling || switching)
  hotbarView.setVisible(show)
  if (!show) {
    return
  }
  headTop.set(0, 9, 0)
  bones.head.localToWorld(headTop)
  hotbarView.place(headTop.x, -headTop.y)
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
let saveMuted = false

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
  if (saveMuted) {
    return
  }
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


const crosshair = document.getElementById('crosshair')
const petMenu = document.getElementById('pet-menu')
const controlKeys = { w: false, a: false, s: false, d: false }
let controlling = false

function overPet(x, y) {
  const rect = hitRect()
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height
}

function moveCross(x, y) {
  if (!crosshair || crosshair.hidden) {
    return
  }
  crosshair.style.transform = `translate(${Math.round(x - 7)}px, ${Math.round(y - 7)}px)`
}

function menuRect() {
  if (!petMenu || petMenu.hidden) {
    return null
  }
  const box = petMenu.getBoundingClientRect()
  return { x: box.x, y: box.y, width: box.width, height: box.height }
}

function hidePetMenu() {
  if (petMenu) {
    petMenu.hidden = true
  }
}

function showPetMenu(x, y) {
  if (!petMenu) {
    return
  }
  const button = petMenu.querySelector('[data-act="control"]')
  if (button) {
    button.textContent = controlling ? '结束控制' : '控制'
  }
  petMenu.hidden = false
  const width = 160
  const height = 72
  const left = Math.max(4, Math.min(window.innerWidth - width - 4, x))
  const top = Math.max(4, Math.min(window.innerHeight - height - 4, y))
  petMenu.style.left = `${left}px`
  petMenu.style.top = `${top}px`
  publishPointer()
}


function releaseEdgeChute() {
  if (!climb || climb.kind !== 'edge') {
    return
  }
  climb = null
  pet.onGround = false
  pet.vy = -1.5
  falling = true
  shortFall = false
  pet.mode = 'fall'
  if (chicken && !mcWorld?.holdingRight()) {
    chicken.group.visible = true
  }
}
function hopOffWindow() {
  if (pet.seatId) {
    ignoreSeatId = pet.seatId
    pet.seatId = null
  } else {
    const under = windowUnder(pet.x, pet.y)
    if (under && Math.abs(pet.y - under.y) < 48) {
      ignoreSeatId = under.id
    }
  }
  pet.onGround = false
  pet.vy = -4
}

function steerControl() {
  if (creativeView.isOpen() || stationView.isOpen()) {
    wander = null
    if (pet.mode === 'walk') {
      pet.mode = 'idle'
    }
    return
  }
  if (controlKeys.a !== controlKeys.d) {
    const face = controlKeys.d ? 1 : -1
    wander = { targetX: pet.x + face * 480, face }
    pet.mode = 'walk'
    return
  }
  wander = null
  if (pet.mode === 'walk') {
    pet.mode = 'idle'
  }
}


async function toggleCreative() {
  if (!controlling || !mcWorld) {
    return
  }
  if (creativeView.isOpen()) {
    creativeView.close()
    return
  }
  creativeView.syncHotbar(mcWorld.hotbarState())
  await creativeView.open()
}
async function setControl(on) {
  controlling = on
  document.body.classList.toggle('controlling', on)
  if (crosshair) {
    crosshair.hidden = !on
  }
  hidePetMenu()
  if (!on) {
    creativeView.close()
    stationView.close()
    wander = null
    controlKeys.w = false
    controlKeys.a = false
    controlKeys.s = false
    controlKeys.d = false
  } else if (mcWorld?.selectedBlock()) {
    await mcWorld.holdItem(mcWorld.selectedBlock())
  }
  invoke('set_overlay_focus', { capture: on }).catch(() => {})
  publishPointer()
}

function bindControl() {
  window.addEventListener('contextmenu', (event) => {
    event.preventDefault()
    if (overPet(event.clientX, event.clientY)) {
      showPetMenu(event.clientX, event.clientY)
      return
    }
    hidePetMenu()
  })
  window.addEventListener('wheel', (event) => {
    if (!controlling || !mcWorld || creativeView.isOpen() || stationView.isOpen()) {
      return
    }
    event.preventDefault()
    mcWorld.cycleHotbar(event.deltaY > 0 ? 1 : -1)
    hotbarView.sync(mcWorld.hotbarState())
  }, { passive: false })
  window.addEventListener('keydown', (event) => {
    if (!controlling) {
      return
    }
    if (event.code === 'Escape') {
      if (stationView.isOpen()) {
        stationView.close()
        return
      }
      if (creativeView.isOpen()) {
        creativeView.close()
        return
      }
      setControl(false)
      return
    }
    if (event.code === 'KeyE') {
      event.preventDefault()
      if (event.repeat) {
        return
      }
      if (stationView.isOpen()) {
        stationView.close()
        return
      }
      toggleCreative()
      return
    }
    if (event.code === 'Space') {
      event.preventDefault()
      releaseEdgeChute()
      return
    }
    const key = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd' }[event.code]
    if (!key) {
      return
    }
    event.preventDefault()
    if (event.repeat) {
      return
    }
    controlKeys[key] = true
    if (key === 's' && !(climb && climb.kind === 'edge')) {
      hopOffWindow()
    }
  })
  window.addEventListener('keyup', (event) => {
    const key = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd' }[event.code]
    if (key) {
      controlKeys[key] = false
    }
  })
  petMenu?.addEventListener('pointerdown', (event) => {
    event.stopPropagation()
  })
  petMenu?.addEventListener('click', (event) => {
    const act = event.target.closest('button')?.dataset.act
    hidePetMenu()
    if (act === 'refresh') {
      window.location.reload()
    } else if (act === 'control') {
      setControl(!controlling)
    }
  })
}
function publishPointer() {
  if (ANDROID) {
    return
  }
  const rects = hidden ? [] : controlling
    ? [{ x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }]
    : [hitRect(), ...(mcWorld?.blockHitRects() ?? [])]
  const menuBox = menuRect()
  if (menuBox) {
    rects.push(menuBox)
  }
  invoke('set_pointer_targets', { rects, held: holding && !hidden })
    .then((cursor) => {
      if (cursor && Number.isFinite(cursor.x) && Number.isFinite(cursor.y)) {
        pointer.x = cursor.x
        pointer.y = cursor.y
        moveCross(cursor.x, cursor.y)
      }
    })
    .catch(() => {})
}


const BLOCK_HOLD_MS = 450
let blockHold = null


function sameChest(block, id) {
  if (!block) {
    return false
  }
  if (id === 'barrel') {
    return block.id === 'barrel'
  }
  return block.id === id && (id === 'chest' || id === 'trapped_chest')
}

function openBackpack() {
  if (!mcWorld) {
    return
  }
  if (creativeView.isOpen()) {
    creativeView.close()
  }
  stationView.open({
    kind: 'inventory',
    player: mcWorld.playerItems(),
    hotbar: mcWorld.hotbarState().slots,
  })
}

function openStation(hit, z) {
  if (!mcWorld || !hit) {
    return false
  }
  const kind = stationKind(hit.id)
  if (!kind) {
    return false
  }
  if (creativeView.isOpen()) {
    creativeView.close()
  }
  const block = mcWorld.getBlock(hit.x, hit.y, z)
  if (kind === 'chest' || kind === 'barrel') {
    const left = mcWorld.getBlock(hit.x - 1, hit.y, z)
    const right = mcWorld.getBlock(hit.x + 1, hit.y, z)
    const partnerX = sameChest(left, hit.id) ? hit.x - 1 : sameChest(right, hit.id) ? hit.x + 1 : null
    if (partnerX != null) {
      const ax = Math.min(hit.x, partnerX)
      const bx = ax + 1
      const a = mcWorld.getBlock(ax, hit.y, z)
      const b = mcWorld.getBlock(bx, hit.y, z)
      mcWorld.setContainerOpen(ax, hit.y, z, true)
      mcWorld.setContainerOpen(bx, hit.y, z, true)
      stationView.open({
        kind: 'double_chest',
        parts: [
          { x: ax, y: hit.y, z, items: a?.nbt?.items },
          { x: bx, y: hit.y, z, items: b?.nbt?.items },
        ],
        player: mcWorld.playerItems(),
        hotbar: mcWorld.hotbarState().slots,
      })
      return true
    }
  }
  if (kind === 'chest' || kind === 'barrel') {
    mcWorld.setContainerOpen(hit.x, hit.y, z, true)
  }
  stationView.open({
    kind,
    x: hit.x,
    y: hit.y,
    z,
    nbt: block?.nbt,
    player: mcWorld.playerItems(),
    hotbar: mcWorld.hotbarState().slots,
  })
  return true
}
function actBlock(hold, layer) {
  if (!mcWorld || !hold) {
    return
  }
  if (hold.button === 0) {
    const broken = mcWorld.breakAt(hold.x, hold.y, layer)
    if (broken?.ok) {
      playBreak(broken.removed?.[0]?.id)
    }
    return
  }
  if (hold.button !== 2) {
    return
  }
  const placed = mcWorld.placeAt(hold.x, hold.y, pet.x, pet.y, layer)
  if (placed?.then) {
    placed.then((result) => {
      if (result?.ok) {
        playPlace(mcWorld.selectedBlock())
      }
    })
  }
}

function tickBlockHold() {
  if (!blockHold || !controlling || blockHold.fired) {
    return
  }
  if (performance.now() - blockHold.at < BLOCK_HOLD_MS) {
    return
  }
  blockHold.fired = true
  actBlock(blockHold, 'back')
}
function bindPointer() {
  window.addEventListener('auxclick', (event) => {
    if (event.button === 1) {
      event.preventDefault()
    }
  })
  window.addEventListener('pointerdown', (event) => {
    pointer.x = event.clientX
    pointer.y = event.clientY
    moveCross(event.clientX, event.clientY)
    if (petMenu && !petMenu.hidden && !event.target.closest('#pet-menu')) {
      hidePetMenu()
    }
    if (controlling) {
      if (stationView.isOpen()) {
        if (!event.target.closest('#station')) {
          stationView.close()
        }
        return
      }
      if (creativeView.isOpen()) {
        if (!event.target.closest('#creative')) {
          creativeView.close()
        }
        return
      }
      if (event.button === 1) {
        event.preventDefault()
        if (overPet(event.clientX, event.clientY)) {
          openBackpack()
          return
        }
        const hit = mcWorld?.hitTest(event.clientX, event.clientY)
        if (!hit || !openStation(hit, 1)) {
          if (!hit) {
            openBackpack()
          }
        }
        return
      }
      if (event.button === 0 || (event.button === 2 && !overPet(event.clientX, event.clientY))) {
        blockHold = {
          button: event.button,
          x: event.clientX,
          y: event.clientY,
          at: performance.now(),
          fired: false,
        }
      }
      return
    }
    if (event.button !== 0) {
      return
    }
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
    if (controlling) {
      pointer.x = event.clientX
      pointer.y = event.clientY
      moveCross(event.clientX, event.clientY)
    }
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
    if (blockHold) {
      const hold = blockHold
      blockHold = null
      if (controlling && !hold.fired) {
        actBlock(hold, 'front')
      }
    }
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
    const dropSpeed = Math.hypot(dragVel.x, dragVel.y)
    const downward = Math.max(0, dragVel.y)
    if (doll) {
      releaseDoll(doll)
      doll = null
    }
    phase = null
    pet.vx = dragVel.x / BLOCK_PX
    pet.vy = -dragVel.y / BLOCK_PX
    if (groundGap() < 18) {
      if (downward >= 900 || dropSpeed >= 1400) {
        launchDoll(dragVel.x, dragVel.y)
      } else {
        standUp()
        actions.handle('drag-end')
      }
      return
    }
    pet.onGround = false
    if (lowDrop()) {
      falling = false
      shortFall = true
      hideChicken()
      pet.onGround = false
      pet.mode = 'idle'
      actions.handle('drag-end')
      return
    }
    falling = true
    pet.mode = 'fall'
    if (chicken && !mcWorld?.holdingRight()) {
      chicken.group.visible = true
    }
    actions.handle('idle')
  })
}

bindControl()

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
    mcWorld?.tick(camera, delta)
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
    if (lowDrop()) {
      shortFall = true
      falling = false
      hideChicken()
      pet.onGround = false
      pet.vy = 0
      pet.mode = 'idle'
      return
    }
    if (doll && doll.pin) {
      releaseNeck(doll, Number(vx) || 0, Number(vy) || 0)
      phase = 'ragdoll'
      pet.mode = 'ragdoll'
    }
  }
} else {
  listen('pet-menu', (event) => onPetMenu(event.payload))
  listen('clear-world', () => {
    saveMuted = true
    invoke('clear_world').finally(() => {
      window.location.reload()
    })
  })
}

resize()
bindPointer()
view.style.visibility = 'hidden'
status.textContent = '正在加载物品栏…'
Promise.all([
  creativeView.ready(),
  createMc({
    parent: worldRoot,
    bones,
    getWindows: () => windows,
    getTaskbar: () => taskbar,
    onPersist: (world) => {
      saveWorldFile(world)
    },
  }).then(async (api) => {
    mcWorld = api
    window.mc = api
    window.mc.build = (json) => startBuild(json || starterSchematic)
    const world = pendingWorld || await loadWorldFile()
    pendingWorld = null
    if (world?.blocks?.length || world?.hand || world?.offhand || world?.hotbar || world?.inv) {
      await api.loadSave(world)
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
  }),
]).then(() => {
  view.style.visibility = ''
  status.textContent = ''
  requestAnimationFrame(frame)
}).catch((error) => {
  view.style.visibility = ''
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

window.__resetAndReload = () => {
  saveMuted = true
  buildQueue = []
  buildJob = null
  phase = null
  invoke('reset_world').finally(() => {
    window.location.reload()
  })
}
