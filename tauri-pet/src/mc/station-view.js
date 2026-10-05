import { DISPLAYS, renderBlock, renderItem } from 'block-model-renderer'
import { blockExists, getAssets, MC_VERSION, PLAINS } from './assets.js'
import { fuelTime, loadRecipes, matchCook, matchCraft, matchSmithing } from './recipes.js'
import {
  containerSize,
  emptySlots,
  normalizeStack,
  readItems,
  stationLayout,
} from './stations.js'

const SCALE = 2
const BLOCK_ICON = { ...DISPLAYS.block, rotateFlat: true }

async function renderIcon(id) {
  const assets = await getAssets()
  const size = 16 * SCALE
  if (await blockExists(id)) {
    return renderBlock({
      id,
      assets,
      width: size,
      height: size,
      version: MC_VERSION,
      biome: PLAINS,
      defaults: 'game',
      lighting: 'item',
      display: BLOCK_ICON,
    })
  }
  return renderItem({
    id,
    assets,
    width: size,
    height: size,
    version: MC_VERSION,
    lighting: 'item',
    display: { type: 'fallback', display: 'gui', generated: false },
  })
}

export function createStationView({ onSave, onHotbar, getHotbar } = {}) {
  const root = document.createElement('div')
  root.id = 'station'
  root.hidden = true
  const canvas = document.createElement('canvas')
  const cursor = document.createElement('img')
  cursor.className = 'cursor-item'
  cursor.hidden = true
  root.appendChild(canvas)
  document.body.append(root, cursor)
  const ctx = canvas.getContext('2d')
  const texture = new Image()
  let textureReady = false
  texture.onload = () => {
    textureReady = true
    paint()
  }

  const icons = new Map()
  const jobs = new Map()
  let chain = Promise.resolve()
  let open = false
  let kind = null
  let layout = null
  let where = null
  let parts = null
  let items = []
  let player = emptySlots(27)
  let hotbar = emptySlots(9)
  let cursorStack = null
  let craft = null
  let cookLeft = 0
  let cookProgress = 0

  function wantIcon(id) {
    if (!id || icons.has(id) || jobs.has(id)) {
      return
    }
    jobs.set(id, true)
    chain = chain.then(async () => {
      try {
        icons.set(id, await renderIcon(id))
        paint()
      } catch (error) {
        console.error(error)
      } finally {
        jobs.delete(id)
      }
    })
  }

  function resize() {
    if (!layout) {
      return
    }
    const width = layout.width * SCALE
    const height = layout.height * SCALE
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    root.style.left = `${Math.round((window.innerWidth - width) / 2)}px`
    root.style.top = `${Math.round((window.innerHeight - height) / 2)}px`
  }

  function stackAt(slot) {
    if (slot.role === 'player') {
      return player[slot.index]
    }
    if (slot.role === 'hotbar') {
      const live = getHotbar?.()
      const id = live?.slots?.[slot.index] ?? hotbar[slot.index]
      return id ? { id, count: 1 } : null
    }
    if (slot.role === 'craft') {
      return items[slot.index]
    }
    if (slot.role === 'block' || slot.role === 'output') {
      return items[slot.index]
    }
    return null
  }

  function refreshResult() {
    if (kind === 'inventory') {
      const grid = [
        items[0]?.id ?? null, items[1]?.id ?? null, null,
        items[2]?.id ?? null, items[3]?.id ?? null, null,
        null, null, null,
      ]
      const matched = matchCraft(grid)
      const map = [0, 1, -1, 2, 3, -1, -1, -1, -1]
      craft = matched
        ? { result: matched.result, used: matched.used.map((index) => map[index]).filter((index) => index >= 0) }
        : null
      return
    }
    if (kind === 'crafting') {
      const grid = emptySlots(9).map((_, index) => items[index]?.id ?? null)
      craft = matchCraft(grid)
      return
    }
    if (kind === 'smithing') {
      const result = matchSmithing(items[0]?.id, items[1]?.id, items[2]?.id)
      items[3] = result ? { ...result } : null
      return
    }
    if (kind === 'anvil') {
      items[2] = items[0] ? { ...items[0] } : null
    }
  }

  function persist() {
    const savedPlayer = player.map((stack) => (stack ? { ...stack } : null))
    if (parts) {
      onSave?.({
        parts: [
          { ...parts[0], items: items.slice(0, 27).map((stack) => (stack ? { ...stack } : null)) },
          { ...parts[1], items: items.slice(27, 54).map((stack) => (stack ? { ...stack } : null)) },
        ],
        player: savedPlayer,
      })
      return
    }
    onSave?.({
      where: kind === 'inventory' ? null : where,
      nbt: {
        items: items.map((stack) => (stack ? { ...stack } : null)),
        burn: cookLeft,
      },
      player: savedPlayer,
    })
  }

  function paint() {
    if (!layout) {
      return
    }
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, layout.width * SCALE, layout.height * SCALE)
    if (textureReady) {
      if (layout.split) {
        const top = layout.split.top
        ctx.drawImage(texture, 0, 0, layout.width, top, 0, 0, layout.width * SCALE, top * SCALE)
        ctx.drawImage(
          texture,
          0,
          layout.split.bottomV,
          layout.width,
          layout.split.bottomH,
          0,
          top * SCALE,
          layout.width * SCALE,
          layout.split.bottomH * SCALE,
        )
      } else {
        ctx.drawImage(texture, 0, 0, layout.width, layout.height, 0, 0, layout.width * SCALE, layout.height * SCALE)
      }
    }
    for (const slot of layout.slots) {
      const shown = slot.role === 'result' ? craft?.result : stackAt(slot)
      if (!shown) {
        continue
      }
      wantIcon(shown.id)
      const icon = icons.get(shown.id)
      if (!icon) {
        continue
      }
      ctx.drawImage(icon, (slot.x + 1) * SCALE, (slot.y + 1) * SCALE, 16 * SCALE, 16 * SCALE)
      if (shown.count > 1) {
        ctx.font = `${8 * SCALE}px "Segoe UI", sans-serif`
        ctx.fillStyle = '#3f3f3f'
        ctx.fillText(String(shown.count), (slot.x + 11) * SCALE, (slot.y + 16) * SCALE)
        ctx.fillStyle = '#ffffff'
        ctx.fillText(String(shown.count), (slot.x + 10) * SCALE, (slot.y + 15) * SCALE)
      }
    }
  }

  function putStack(slot, stack) {
    const next = normalizeStack(stack)
    if (slot.role === 'player') {
      player[slot.index] = next
      return
    }
    if (slot.role === 'hotbar') {
      hotbar[slot.index] = next?.id ?? null
      onHotbar?.(slot.index, hotbar[slot.index])
      return
    }
    items[slot.index] = next
  }

  function clickSlot(slot, shift, right) {
    if (slot.role === 'result') {
      if (!craft?.result || cursorStack) {
        return
      }
      cursorStack = { ...craft.result }
      for (const index of craft.used) {
        const stack = items[index]
        if (!stack) {
          continue
        }
        stack.count -= 1
        items[index] = normalizeStack(stack)
      }
      refreshResult()
      persist()
      paint()
      return
    }
    if (slot.role === 'output') {
      const stack = stackAt(slot)
      if (!stack || cursorStack) {
        return
      }
      cursorStack = { ...stack }
      if (kind === 'smithing') {
        items[0] = normalizeStack(items[0] ? { ...items[0], count: items[0].count - 1 } : null)
        items[1] = normalizeStack(items[1] ? { ...items[1], count: items[1].count - 1 } : null)
        items[2] = normalizeStack(items[2] ? { ...items[2], count: items[2].count - 1 } : null)
      } else if (kind === 'anvil') {
        items[0] = null
      } else {
        items[slot.index] = null
      }
      refreshResult()
      persist()
      paint()
      showCursor()
      return
    }
    const current = stackAt(slot)
    if (shift && current && !cursorStack) {
      moveStack(slot, current)
      return
    }
    if (!cursorStack) {
      if (!current) {
        return
      }
      if (right) {
        const take = Math.ceil(current.count / 2)
        cursorStack = { id: current.id, count: take }
        putStack(slot, { id: current.id, count: current.count - take })
      } else {
        cursorStack = current
        putStack(slot, null)
      }
    } else if (!current) {
      if (right) {
        putStack(slot, { id: cursorStack.id, count: 1 })
        cursorStack = normalizeStack({ id: cursorStack.id, count: cursorStack.count - 1 })
      } else {
        putStack(slot, cursorStack)
        cursorStack = null
      }
    } else if (current.id === cursorStack.id) {
      const room = 64 - current.count
      const move = right ? 1 : Math.min(room, cursorStack.count)
      if (move > 0) {
        putStack(slot, { id: current.id, count: current.count + move })
        cursorStack = normalizeStack({ id: cursorStack.id, count: cursorStack.count - move })
      }
    } else if (!right) {
      putStack(slot, cursorStack)
      cursorStack = current
    }
    refreshResult()
    persist()
    paint()
    showCursor()
  }

  function moveStack(slot, stack) {
    const targets = layout.slots.filter((entry) => {
      if (slot.role === 'block' || slot.role === 'craft') {
        return entry.role === 'player' || entry.role === 'hotbar'
      }
      return entry.role === 'block' || entry.role === 'craft'
    })
    let left = stack.count
    for (const target of targets) {
      const there = stackAt(target)
      if (there?.id === stack.id && there.count < 64) {
        const move = Math.min(64 - there.count, left)
        putStack(target, { id: stack.id, count: there.count + move })
        left -= move
      }
    }
    for (const target of targets) {
      if (left < 1) {
        break
      }
      if (!stackAt(target)) {
        const move = Math.min(64, left)
        putStack(target, { id: stack.id, count: move })
        left -= move
      }
    }
    putStack(slot, left > 0 ? { id: stack.id, count: left } : null)
    refreshResult()
    persist()
    paint()
  }

  function showCursor() {
    if (!cursorStack) {
      cursor.hidden = true
      return
    }
    wantIcon(cursorStack.id)
    const icon = icons.get(cursorStack.id)
    if (!icon) {
      cursor.hidden = true
      return
    }
    cursor.src = icon instanceof HTMLCanvasElement ? icon.toDataURL() : icon.src
    cursor.hidden = false
  }

  function slotFromEvent(event) {
    const box = canvas.getBoundingClientRect()
    const x = (event.clientX - box.left) / SCALE
    const y = (event.clientY - box.top) / SCALE
    return layout.slots.find((slot) => x >= slot.x && x < slot.x + 18 && y >= slot.y && y < slot.y + 18) ?? null
  }

  canvas.addEventListener('pointerdown', (event) => {
    event.stopPropagation()
    event.preventDefault()
    const slot = slotFromEvent(event)
    if (slot) {
      clickSlot(slot, event.shiftKey, event.button === 2)
    }
  })
  root.addEventListener('pointerdown', (event) => event.stopPropagation())
  window.addEventListener('pointermove', (event) => {
    if (!open) {
      return
    }
    cursor.style.left = `${event.clientX - 8}px`
    cursor.style.top = `${event.clientY - 8}px`
  })

  function tickCook(delta) {
    if (!open || (kind !== 'furnace' && kind !== 'blast_furnace' && kind !== 'smoker')) {
      return
    }
    const recipe = matchCook(kind, items[0]?.id)
    if (!recipe) {
      return
    }
    const output = items[2]
    if (output && (output.id !== recipe.result.id || output.count + recipe.result.count > 64)) {
      return
    }
    if (cookLeft <= 0) {
      const fuel = fuelTime(items[1]?.id)
      if (!fuel) {
        return
      }
      items[1] = normalizeStack({ id: items[1].id, count: items[1].count - 1 })
      cookLeft = fuel
    }
    cookLeft = Math.max(0, cookLeft - delta * 20)
    cookProgress += delta * 20
    if (cookProgress >= recipe.time) {
      cookProgress = 0
      items[0] = normalizeStack({ id: items[0].id, count: items[0].count - 1 })
      items[2] = {
        id: recipe.result.id,
        count: (output?.count ?? 0) + recipe.result.count,
      }
      persist()
      paint()
    }
  }

  return {
    isOpen() {
      return open
    },
    open(next) {
      loadRecipes()
      kind = next.kind
      where = next.x == null ? null : { x: next.x, y: next.y, z: next.z }
      parts = next.parts ?? null
      layout = stationLayout(kind)
      if (parts) {
        items = [
          ...readItems({ items: parts[0].items }, 27),
          ...readItems({ items: parts[1].items }, 27),
        ]
      } else {
        items = readItems(next.nbt, containerSize(kind))
      }
      player = readItems({ items: next.player }, 27)
      hotbar = (next.hotbar ?? getHotbar?.()?.slots ?? emptySlots(9)).slice()
      cookLeft = next.nbt?.burn ?? 0
      cursorStack = null
      cursor.hidden = true
      textureReady = false
      texture.src = `/resource-pack/minecraft/textures/gui/container/${layout.texture}`
      refreshResult()
      resize()
      open = true
      root.hidden = false
      paint()
    },
    close() {
      if (cursorStack) {
        const slot = player.findIndex((stack) => !stack)
        if (slot >= 0) {
          player[slot] = cursorStack
        }
        cursorStack = null
      }
      if (open) {
        persist()
      }
      open = false
      root.hidden = true
      cursor.hidden = true
    },
    tick(delta) {
      tickCook(delta)
    },
  }
}
