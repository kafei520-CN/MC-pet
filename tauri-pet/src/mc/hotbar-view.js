import { DISPLAYS, renderBlock, renderItem } from 'block-model-renderer'
import { blockExists, getAssets, MC_VERSION, PLAINS } from './assets.js'
import { selectDuration } from './hotbar.js'

const GUI = 2
const HOTBAR = { x: 0, y: 0, w: 182, h: 22 }
const SELECT = { x: 0, y: 22, w: 24, h: 22 }
const PITCH = 20
const ICON = 16
const PAD = 1
const SRC_W = HOTBAR.w + PAD * 2
const SRC_H = HOTBAR.h + PAD

function clamp01(value) {
  return Math.max(0, Math.min(1, value))
}

function smooth(value) {
  const t = clamp01(value)
  return t * t * (3 - 2 * t)
}

const BLOCK_ICON = {
  ...DISPLAYS.block,
  rotateFlat: true,
}

async function renderIcon(id) {
  const assets = await getAssets()
  const size = ICON * GUI
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

export function createHotbarView() {
  const root = document.createElement('div')
  root.id = 'hotbar'
  root.hidden = true
  const canvas = document.createElement('canvas')
  root.appendChild(canvas)
  document.body.appendChild(root)
  const ctx = canvas.getContext('2d')

  const widgets = new Image()
  let widgetsReady = false
  widgets.onload = () => {
    widgetsReady = true
    paint()
  }

  const icons = new Map()
  const iconJobs = new Map()
  let iconChain = Promise.resolve()
  let slots = Array.from({ length: 9 }, () => null)
  let slotKey = ''
  let origin = 0
  let target = 0
  let elapsed = 1
  let duration = 1
  let cssWidth = SRC_W * GUI
  let cssHeight = SRC_H * GUI

  function resizeCanvas() {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    cssWidth = SRC_W * GUI
    cssHeight = SRC_H * GUI
    canvas.width = Math.round(cssWidth * dpr)
    canvas.height = Math.round(cssHeight * dpr)
    canvas.style.width = `${cssWidth}px`
    canvas.style.height = `${cssHeight}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  resizeCanvas()
  widgets.src = '/resource-pack/minecraft/textures/gui/widgets.png'
  window.addEventListener('resize', () => {
    resizeCanvas()
    paint()
  })

  function displayed() {
    if (elapsed >= duration) {
      return target
    }
    return origin + (target - origin) * smooth(elapsed / duration)
  }

  function wantIcon(id) {
    if (!id || icons.has(id) || iconJobs.has(id)) {
      return
    }
    iconJobs.set(id, true)
    iconChain = iconChain.then(async () => {
      try {
        const image = await renderIcon(id)
        icons.set(id, image)
        paint()
      } catch (error) {
        console.error(error)
      } finally {
        iconJobs.delete(id)
      }
    })
  }

  function paint() {
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, cssWidth, cssHeight)
    if (!widgetsReady) {
      return
    }
    const scale = GUI
    ctx.drawImage(
      widgets,
      HOTBAR.x,
      HOTBAR.y,
      HOTBAR.w,
      HOTBAR.h,
      PAD * scale,
      PAD * scale,
      HOTBAR.w * scale,
      HOTBAR.h * scale,
    )
    for (let index = 0; index < slots.length; index += 1) {
      const icon = icons.get(slots[index])
      if (!icon) {
        continue
      }
      const dx = (PAD + 3 + index * PITCH) * scale
      const dy = (PAD + 3) * scale
      ctx.drawImage(icon, dx, dy, ICON * scale, ICON * scale)
    }
    const slot = displayed()
    ctx.drawImage(
      widgets,
      SELECT.x,
      SELECT.y,
      SELECT.w,
      SELECT.h,
      (PAD + slot * PITCH - 1) * scale,
      (PAD - 1) * scale,
      SELECT.w * scale,
      SELECT.h * scale,
    )
  }

  return {
    setVisible(on) {
      root.hidden = !on
    },
    sync(state) {
      const nextKey = state.slots.join('|')
      if (nextKey !== slotKey) {
        slotKey = nextKey
        slots = state.slots.slice()
        for (const id of slots) {
          wantIcon(id)
        }
        paint()
      }
      if (state.selected !== target) {
        origin = displayed()
        const distance = Math.abs(state.selected - target)
        target = state.selected
        elapsed = 0
        duration = selectDuration(distance || 1)
        paint()
      }
    },
    tick(delta) {
      if (elapsed >= duration) {
        return
      }
      elapsed += delta
      paint()
    },
    place(screenX, headTop) {
      const left = Math.round(screenX - cssWidth / 2)
      const top = Math.round(headTop - cssHeight - 10)
      const x = Math.max(4, Math.min(window.innerWidth - cssWidth - 4, left))
      const y = Math.max(4, top)
      root.style.transform = `translate(${x}px, ${y}px)`
    },
  }
}
