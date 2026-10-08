import { getAssets } from './assets.js'
import { applySave, BACK_Z, collisionAt, createStore, FRONT_Z, placeBlock, removeBlock, serialize, setBlockState } from './world.js'
import { rebuildWorld } from './render-world.js'
import { createHandHolders, setHeldItem } from './items.js'
import { createHotbar } from './hotbar.js'
import { blockScreenRects, hitTest } from './hit.js'
import {
  blockSolids,
  desktopSolids,
  resolveScreenPosition,
  resolveSpawn,
  spawnBlocked,
  stepActor,
  supportAt,
  supportScreenY,
} from './move.js'
import { findPath } from './pathfind.js'
import { BLOCK_PX, layoutWorldRoot, PLAYER_HEIGHT, PLAYER_WIDTH, screenToWorld } from './scale.js'
import { createMobs } from './mobs.js'
import { eggType, isSpawnEgg } from './spawn-egg.js'
import { createParticles } from './particles.js'
import { createSurvival, isFood, isWeapon, weaponDamage } from './survival.js'
import { asStack } from './item-stack.js'
import { createMineOverlay } from './mine-overlay.js'
import { mineRate, mineStage, pickMineLayer } from './hardness.js'

export { BLOCK_PX, SCALE, screenToWorld, worldToScreen } from './scale.js'

export async function createMc({ parent, bones, onPersist, getWindows, getTaskbar }) {
  await getAssets()
  const store = createStore()
  const root = parent
  layoutWorldRoot(root)
  const holders = bones ? createHandHolders(bones) : { right: null, left: null }
  const hands = { right: null, left: null }
  const hotbar = createHotbar()
  const mobs = createMobs(root)
  const particles = createParticles(root)
  const mineOverlay = createMineOverlay()
  let mine = null
  let playerSlots = Array.from({ length: 27 }, () => null)
  let handle = null
  let rebuildTimer = 0
  let persistTimer = 0
  let pointerEvents = false
  let generation = 0
  let mute = false
  let gameMode = 'survival'
  let gameDifficulty = 'normal'

  const survival = createSurvival(() => schedulePersist())

  function scheduleRebuild() {
    window.clearTimeout(rebuildTimer)
    const token = ++generation
    rebuildTimer = window.setTimeout(() => {
      const previous = handle
      handle = null
      rebuildWorld(root, store.list(), previous).then((next) => {
        if (token !== generation) {
          next?.dispose?.()
          return
        }
        handle = next
      }).catch((error) => {
        console.error(error)
      })
    }, 50)
  }

  function schedulePersist() {
    if (!onPersist) {
      return
    }
    window.clearTimeout(persistTimer)
    persistTimer = window.setTimeout(() => {
      onPersist(snapshot())
    }, 50)
  }

  function dirty() {
    if (mute) {
      return
    }
    scheduleRebuild()
    schedulePersist()
  }

  function mineTarget(screenX, screenY, layer = 'front') {
    const z = layer === 'back' ? BACK_Z : FRONT_Z
    const hit = hitTest((x, y) => store.get(x, y, z), screenX, screenY)
    if (!hit) {
      return null
    }
    const block = store.get(hit.x, hit.y, z)
    if (!block) {
      return null
    }
    return { x: hit.x, y: hit.y, z, id: block.id }
  }

  function survivalMineTarget(screenX, screenY) {
    const world = screenToWorld(screenX, screenY)
    const under = pickMineLayer(
      (x, y, z) => store.get(x, y, z),
      Math.floor(world.x),
      Math.floor(world.y),
      FRONT_Z,
      BACK_Z,
    )
    if (under) {
      return under
    }
    const front = mineTarget(screenX, screenY, 'front')
    if (front) {
      return front
    }
    const back = mineTarget(screenX, screenY, 'back')
    if (!back) {
      return null
    }
    const above = store.get(back.x, back.y, FRONT_Z)
    if (above) {
      return { x: back.x, y: back.y, z: FRONT_Z, id: above.id }
    }
    return back
  }

  function finishBreak(cell) {
    const result = removeBlock(store, cell.x, cell.y, cell.z)
    if (result.ok) {
      particles.burst(result.removed[0]?.id, result.removed)
      dirty()
    }
    return result
  }

  function stopMining() {
    mine = null
    mineOverlay.clear()
  }

  async function batch(work) {
    mute = true
    try {
      await work()
    } finally {
      mute = false
      dirty()
    }
  }

  function snapshot() {
    return {
      ...serialize(store, hands),
      hotbar: hotbar.save(),
      inv: playerSlots.map((stack) => (stack ? { ...stack } : null)),
      mobs: mobs.save(),
      survival: survival.save(),
      created: true,
      game: { mode: gameMode, difficulty: gameDifficulty },
    }
  }

  async function hold(side, id, components) {
    const holder = side === 'left' ? holders.left : holders.right
    if (!holder) {
      return { ok: false, error: 'no skeleton' }
    }
    const current = hands[side]
    const name = id || null
    const sameId = (name && current?.id === name) || (!name && !current)
    const sameData = components === undefined
      || JSON.stringify(current?.components ?? {}) === JSON.stringify(components ?? {})
    if (sameId && sameData) {
      return { ok: true, id: name, unchanged: true }
    }
    const result = await setHeldItem(holder, id, components, side)
    if (result.ok) {
      hands[side] = result.id ? { id: result.id, components: result.components } : null
      schedulePersist()
    }
    return result
  }

  const api = {
    root,
    async placeBlock(x, y, id, properties, nbt, z) {
      const result = await placeBlock(store, x, y, id, properties, nbt, z)
      if (result.ok) {
        dirty()
      }
      return result
    },
    removeBlock(x, y, z = 0) {
      const result = removeBlock(store, x, y, z)
      if (result.ok) {
        particles.burst(result.removed[0]?.id, result.removed)
        dirty()
      }
      return result
    },
    cycleHotbar(step) {
      const change = hotbar.cycle(step)
      schedulePersist()
      void hold('right', change.id)
      return change
    },
    selectedBlock() {
      return hotbar.selectedItem()
    },
    survivalState() {
      return survival.state()
    },
    gameState() {
      return { mode: gameMode, difficulty: gameDifficulty }
    },
    setGameMode(next) {
      gameMode = next === 'creative' ? 'creative' : 'survival'
      survival.configure({ mode: gameMode, difficulty: gameDifficulty })
      schedulePersist()
      return { mode: gameMode, difficulty: gameDifficulty }
    },
    cycleGameMode() {
      return this.setGameMode(gameMode === 'survival' ? 'creative' : 'survival')
    },
    setDifficulty(next) {
      gameDifficulty = ['peaceful', 'easy', 'normal', 'hard'].includes(next) ? next : 'normal'
      survival.configure({ mode: gameMode, difficulty: gameDifficulty })
      schedulePersist()
      return { mode: gameMode, difficulty: gameDifficulty }
    },
    cycleDifficulty() {
      const values = ['peaceful', 'easy', 'normal', 'hard']
      const index = values.indexOf(gameDifficulty)
      return this.setDifficulty(values[(index + 1) % values.length])
    },
    async createWorld(options = {}) {
      gameMode = options.mode === 'survival' ? 'survival' : 'creative'
      gameDifficulty = ['peaceful', 'easy', 'normal', 'hard'].includes(options.difficulty)
        ? options.difficulty
        : 'peaceful'
      store.clear()
      mobs.load([])
      hotbar.read(null)
      survival.configure({ mode: gameMode, difficulty: gameDifficulty })
      survival.reset()
      await this.demo()
      schedulePersist()
      return this.gameState()
    },
    damagePlayer(amount) {
      return survival.damage(amount)
    },
    healPlayer(amount) {
      return survival.heal(amount)
    },
    eatSelected() {
      const id = hotbar.selectedItem()
      if (!id || !isFood(id)) {
        return { ok: false, error: 'selected item is not food' }
      }
      const result = survival.eat(id)
      if (!result.ok) {
        return result
      }
      hotbar.consumeSelected()
      schedulePersist()
      void hold('right', hotbar.selectedItem())
      return result
    },
    attackAt(screenX, screenY) {
      const id = hotbar.selectedItem()
      const damage = weaponDamage(id)
      if (!damage) {
        return { ok: false, error: 'selected item is not a weapon' }
      }
      const world = screenToWorld(screenX, screenY)
      const result = mobs.attackAt(world.x, world.y, damage)
      if (result.ok) {
        schedulePersist()
      }
      return result
    },
    breakAt(screenX, screenY, layer = 'front') {
      const cell = mineTarget(screenX, screenY, layer)
      if (!cell) {
        return null
      }
      return finishBreak(cell)
    },
    tickMine(screenX, screenY, dt) {
      if (gameMode === 'creative') {
        mineOverlay.clear()
        mine = null
        return { instant: true }
      }
      const cell = survivalMineTarget(screenX, screenY)
      if (!cell) {
        stopMining()
        return null
      }
      const tool = hotbar.selectedItem()
      const rate = mineRate(cell.id, tool)
      if (rate <= 0) {
        stopMining()
        return { unbreakable: true, id: cell.id }
      }
      if (!Number.isFinite(rate) || rate === Infinity) {
        const result = finishBreak(cell)
        stopMining()
        return { broken: result, id: cell.id }
      }
      if (!mine || mine.x !== cell.x || mine.y !== cell.y || mine.z !== cell.z || mine.id !== cell.id) {
        mine = { x: cell.x, y: cell.y, z: cell.z, id: cell.id, progress: 0, sound: 0.28 }
      }
      mine.progress += rate * Math.max(0, dt)
      mine.sound += Math.max(0, dt)
      const stage = Math.max(0, mineStage(Math.max(mine.progress, 0.001)))
      mineOverlay.set(cell, stage)
      const hitSound = mine.sound >= 0.28
      if (hitSound) {
        mine.sound = 0
      }
      if (mine.progress >= 1) {
        const result = finishBreak(cell)
        stopMining()
        return { broken: result, id: cell.id, hitSound: true }
      }
      return { mining: true, stage, hitSound, id: cell.id, progress: mine.progress }
    },
    stopMine() {
      stopMining()
    },
    placeAt(screenX, screenY, fromX, fromY, layer = 'front') {
      const id = hotbar.selectedItem()
      if (!id) {
        return null
      }
      if (isFood(id) || isWeapon(id)) {
        return { ok: false, error: isFood(id) ? 'eat food with right click' : 'weapons cannot place blocks' }
      }
      const z = layer === 'back' ? BACK_Z : FRONT_Z
      const world = screenToWorld(screenX, screenY)
      const read = (x, y) => (z === FRONT_Z ? store.walkGet(x, y) : store.get(x, y, BACK_Z))
      const hit = hitTest(read, screenX, screenY)
      const front = hitTest((x, y) => store.walkGet(x, y), screenX, screenY)
      let x = Math.floor(world.x)
      let y = Math.floor(world.y)
      if (layer === 'back') {
        const behind = front || hit
        if (behind) {
          x = behind.x
          y = behind.y
        }
      } else if (hit) {
        const fx = world.x - hit.x
        const fy = world.y - hit.y
        const faces = [
          { gap: fx, x: hit.x - 1, y: hit.y },
          { gap: 1 - fx, x: hit.x + 1, y: hit.y },
          { gap: fy, x: hit.x, y: hit.y - 1 },
          { gap: 1 - fy, x: hit.x, y: hit.y + 1 },
        ]
        faces.sort((a, b) => a.gap - b.gap)
        x = faces[0].x
        y = faces[0].y
      }
      if (Number.isFinite(fromX) && Number.isFinite(fromY)) {
        const origin = screenToWorld(fromX, fromY)
        const dx = x + 0.5 - origin.x
        const dy = y + 0.5 - origin.y
        if (Math.hypot(dx, dy) > 5) {
          return null
        }
      }
      if (isSpawnEgg(id)) {
        const type = eggType(id)
        if (!type) {
          return null
        }
        mobs.spawn(type, x, y)
        schedulePersist()
        return Promise.resolve({ ok: true, spawned: type, x, y })
      }
      if (read(x, y)) {
        return null
      }
      return placeBlock(store, x, y, id, {}, undefined, z).then((result) => {
        if (result.ok) {
          dirty()
        }
        return result
      })
    },
    getBlock(x, y, z) {
      return store.get(x, y, z)
    },
    playerItems() {
      return playerSlots.map((stack) => (stack ? { ...stack } : null))
    },
    writePlayer(slots) {
      playerSlots = Array.from({ length: 27 }, (_, index) => {
        const stack = slots?.[index]
        return asStack(stack)
      })
      schedulePersist()
    },
    writeContainer(x, y, z, nbt) {
      const block = store.get(x, y, z)
      if (!block) {
        return { ok: false }
      }
      const result = setBlockState(store, x, y, {}, { ...(block.nbt ?? {}), ...nbt }, z)
      if (result.ok) {
        dirty()
      }
      return result
    },
    setContainerOpen(x, y, z, open) {
      const block = store.get(x, y, z)
      if (!block) {
        return { ok: false }
      }
      const result = setBlockState(store, x, y, {}, { ...(block.nbt ?? {}), open: Boolean(open) }, z)
      if (result.ok) {
        dirty()
      }
      return result
    },
    setBlockState(x, y, properties, nbt, z = 0) {
      const result = setBlockState(store, x, y, properties, nbt, z)
      if (result.ok) {
        dirty()
      }
      return result
    },
    async fill(x1, y1, x2, y2, id, properties) {
      const minX = Math.min(x1, x2)
      const maxX = Math.max(x1, x2)
      const minY = Math.min(y1, y2)
      const maxY = Math.max(y1, y2)
      const placed = []
      let error = null
      await batch(async () => {
        for (let y = minY; y <= maxY; y += 1) {
          for (let x = minX; x <= maxX; x += 1) {
            const result = await placeBlock(store, x, y, id, properties, undefined, 1)
            if (!result.ok) {
              error = result.error
              return
            }
            placed.push(...result.placed)
          }
        }
      })
      if (error) {
        return { ok: false, error, placed }
      }
      return { ok: true, placed }
    },
    holdItem(id, components) {
      return hold('right', id, components)
    },
    hotbarState() {
      return hotbar.state()
    },
    commitHotbar(id) {
      const change = hotbar.commit(id)
      schedulePersist()
      void hold('right', change.id)
      return change
    },
    setHotbarSlot(index, id) {
      hotbar.setSlot(index, id)
      schedulePersist()
      if (hotbar.state().selected === index) {
        void hold('right', hotbar.selectedItem())
      }
    },
    selectHotbar(index) {
      const change = hotbar.selectIndex(index)
      schedulePersist()
      void hold('right', change.id)
      return change
    },
    offhandItem(id, components) {
      return hold('left', id, components)
    },
    hitTest(screenX, screenY) {
      return hitTest((x, y) => store.walkGet(x, y), screenX, screenY)
    },
    setBlockPointerEvents(on) {
      pointerEvents = Boolean(on)
    },
    blockPointerEvents() {
      return pointerEvents
    },
    blockHitRects() {
      return pointerEvents ? blockScreenRects(store.list()) : []
    },
    getCollision(x, y) {
      return collisionAt(store, x, y)
    },
    supportScreenY(screenX, screenY, ignoreWindowId) {
      const windows = getWindows?.() ?? []
      const extra = desktopSolids(windows, getTaskbar?.() ?? null)
      return supportScreenY((x, y) => store.walkGet(x, y), windows, screenX, screenY, ignoreWindowId, extra)
    },
    blockSupportScreenY(screenX, screenY) {
      return supportScreenY((x, y) => store.walkGet(x, y), [], screenX, screenY)
    },
    resolvePosition(screenX, screenY) {
      return resolveScreenPosition((x, y) => store.walkGet(x, y), screenX, screenY)
    },
    resolveSpawn(screenX, screenY) {
      return resolveSpawn((x, y) => store.walkGet(x, y), screenX, screenY)
    },
    spawnBlocked(screenX, screenY) {
      const feet = screenToWorld(screenX, screenY)
      return spawnBlocked((x, y) => store.walkGet(x, y), feet.x, feet.y)
    },
    stepActor(actor, dt, extra) {
      const windows = getWindows?.() ?? []
      const taskbar = getTaskbar?.() ?? null
      const extraSolids = desktopSolids(windows, taskbar)
      const result = stepActor(actor, dt, {
        getBlock: (x, y) => store.walkGet(x, y),
        windows,
        taskbar,
        extraSolids,
        ...extra,
      })
      mobs.step(dt, (x, y) => store.walkGet(x, y), extraSolids, {
        supportAt: (wx, fromY, hw) => supportAt((x, y) => store.walkGet(x, y), windows, extraSolids, wx, fromY, hw),
      })
      return result
    },
    findPath(startX, startY, goalX, goalY, size) {
      const windows = getWindows?.() ?? []
      const extraSolids = desktopSolids(windows, getTaskbar?.() ?? null)
      const hw = size?.hw ?? PLAYER_WIDTH / 2
      const hh = size?.hh ?? PLAYER_HEIGHT
      const solids = [
        ...blockSolids((x, y) => store.walkGet(x, y), startX - 40, 0, startX + 40, startY + 12),
        ...extraSolids,
      ]
      return findPath({
        startX,
        startY,
        goalX,
        goalY,
        hw,
        hh,
        solids,
        supportAt: (wx, fromY) => supportAt((x, y) => store.walkGet(x, y), windows, extraSolids, wx, fromY, hw),
      })
    },
    isEmpty() {
      return store.cells.size === 0
    },
    getSave() {
      return snapshot()
    },
    async loadSave(data) {
      hotbar.read(data?.hotbar, data?.hand?.id)
      survival.load(data?.survival)
      gameMode = data?.game?.mode === 'creative' || data?.survival?.mode === 'creative' ? 'creative' : 'survival'
      gameDifficulty = ['peaceful', 'easy', 'normal', 'hard'].includes(data?.game?.difficulty)
        ? data.game.difficulty
        : (['peaceful', 'easy', 'normal', 'hard'].includes(data?.survival?.difficulty) ? data.survival.difficulty : 'normal')
      survival.configure({ mode: gameMode, difficulty: gameDifficulty })
      playerSlots = Array.from({ length: 27 }, (_, index) => {
        const stack = data?.inv?.[index]
        return asStack(stack)
      })
      mobs.load(data?.mobs)
      await batch(async () => {
        applySave(store, data)
        if (data?.hand?.id) {
          await hold('right', data.hand.id, data.hand.components)
        } else {
          await hold('right', null)
        }
        if (data?.offhand?.id) {
          await hold('left', data.offhand.id, data.offhand.components)
        } else {
          await hold('left', null)
        }
      })
    },
    holdingRight() {
      return Boolean(hands.right)
    },
    layout() {
      layoutWorldRoot(root)
    },
    tick(camera, delta) {
      handle?.sortTranslucent?.(camera)
      particles.tick(delta)
      survival.tick(delta)
    },
    async demo() {
      await batch(async () => {
        const cols = Math.max(8, Math.floor(window.innerWidth / BLOCK_PX))
        const start = Math.floor(cols / 2) - 5
        for (let i = 0; i < 10; i += 1) {
          await placeBlock(store, start + i, 0, 'grass_block')
        }
        await placeBlock(store, start + 3, 1, 'oak_log')
        await placeBlock(store, start + 4, 1, 'oak_log')
        await placeBlock(store, start + 5, 1, 'oak_stairs', { facing: 'east' })
        await placeBlock(store, start + 1, 1, 'oak_fence')
        await placeBlock(store, start + 2, 1, 'oak_fence')
        await placeBlock(store, start + 7, 1, 'torch')
        await hold('right', hotbar.selectedItem())
      })
      return { ok: true }
    },
  }

  return api
}
