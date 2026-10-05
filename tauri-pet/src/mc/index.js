import { getAssets } from './assets.js'
import { applySave, BACK_Z, collisionAt, createStore, FRONT_Z, placeBlock, removeBlock, serialize, setBlockState } from './world.js'
import { rebuildWorld } from './render-world.js'
import { createHandHolders, setHeldItem } from './items.js'
import { createHotbar } from './hotbar.js'
import { blockScreenRects, hitTest } from './hit.js'
import { resolveScreenPosition, resolveSpawn, spawnBlocked, stepActor, supportScreenY } from './move.js'
import { BLOCK_PX, layoutWorldRoot, screenToWorld } from './scale.js'
import { createMobs } from './mobs.js'
import { eggType, isSpawnEgg } from './spawn-egg.js'

export { BLOCK_PX, SCALE, screenToWorld, worldToScreen } from './scale.js'

export async function createMc({ parent, bones, onPersist, getWindows }) {
  await getAssets()
  const store = createStore()
  const root = parent
  layoutWorldRoot(root)
  const holders = bones ? createHandHolders(bones) : { right: null, left: null }
  const hands = { right: null, left: null }
  const hotbar = createHotbar()
  const mobs = createMobs(root)
  let playerSlots = Array.from({ length: 27 }, () => null)
  let handle = null
  let rebuildTimer = 0
  let persistTimer = 0
  let pointerEvents = false
  let generation = 0
  let mute = false

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
    breakAt(screenX, screenY, layer = 'front') {
      const z = layer === 'back' ? BACK_Z : FRONT_Z
      const read = (x, y) => (z === FRONT_Z ? store.walkGet(x, y) : store.get(x, y, BACK_Z))
      const hit = hitTest(read, screenX, screenY)
      const world = screenToWorld(screenX, screenY)
      const front = hitTest((x, y) => store.walkGet(x, y), screenX, screenY)
      const cell = hit || (layer === 'back' && front) || {
        x: Math.floor(world.x),
        y: Math.floor(world.y),
      }
      if (!read(cell.x, cell.y)) {
        return null
      }
      const result = removeBlock(store, cell.x, cell.y, z)
      if (result.ok) {
        dirty()
      }
      return result
    },
    placeAt(screenX, screenY, fromX, fromY, layer = 'front') {
      const id = hotbar.selectedItem()
      if (!id) {
        return null
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
        if (!stack?.id || stack.count < 1) {
          return null
        }
        return { id: String(stack.id).replace(/^minecraft:/, ''), count: Math.min(64, Math.floor(stack.count)) }
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
      return supportScreenY((x, y) => store.walkGet(x, y), getWindows?.() ?? [], screenX, screenY, ignoreWindowId)
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
      const result = stepActor(actor, dt, {
        getBlock: (x, y) => store.walkGet(x, y),
        windows: getWindows?.() ?? [],
        ...extra,
      })
      mobs.step(dt, (x, y) => store.walkGet(x, y))
      return result
    },
    isEmpty() {
      return store.cells.size === 0
    },
    getSave() {
      return snapshot()
    },
    async loadSave(data) {
      hotbar.read(data?.hotbar, data?.hand?.id)
      playerSlots = Array.from({ length: 27 }, (_, index) => {
        const stack = data?.inv?.[index]
        if (!stack?.id || stack.count < 1) {
          return null
        }
        return { id: String(stack.id).replace(/^minecraft:/, ''), count: Math.min(64, Math.floor(stack.count)) }
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
    tick(camera) {
      handle?.sortTranslucent?.(camera)
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
        await hold('right', 'iron_sword')
      })
      return { ok: true }
    },
  }

  return api
}
