import { getAssets } from './assets.js'
import { applySave, collisionAt, createStore, placeBlock, removeBlock, serialize, setBlockState } from './world.js'
import { rebuildWorld } from './render-world.js'
import { createHandHolders, setHeldItem } from './items.js'
import { blockScreenRects, hitTest } from './hit.js'
import { resolveScreenPosition, resolveSpawn, spawnBlocked, stepActor, supportScreenY } from './move.js'
import { BLOCK_PX, layoutWorldRoot, screenToWorld } from './scale.js'

export { BLOCK_PX, SCALE, screenToWorld, worldToScreen } from './scale.js'

export async function createMc({ parent, bones, onPersist, getWindows }) {
  await getAssets()
  const store = createStore()
  const root = parent
  layoutWorldRoot(root)
  const holders = bones ? createHandHolders(bones) : { right: null, left: null }
  const hands = { right: null, left: null }
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
      onPersist(serialize(store, hands))
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

  async function hold(side, id, components) {
    const holder = side === 'left' ? holders.left : holders.right
    if (!holder) {
      return { ok: false, error: 'no skeleton' }
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
    removeBlock(x, y) {
      const result = removeBlock(store, x, y)
      if (result.ok) {
        dirty()
      }
      return result
    },
    getBlock(x, y, z) {
      return store.get(x, y, z)
    },
    setBlockState(x, y, properties, nbt) {
      const result = setBlockState(store, x, y, properties, nbt)
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
      return stepActor(actor, dt, {
        getBlock: (x, y) => store.walkGet(x, y),
        windows: getWindows?.() ?? [],
        ...extra,
      })
    },
    isEmpty() {
      return store.cells.size === 0
    },
    getSave() {
      return serialize(store, hands)
    },
    async loadSave(data) {
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
