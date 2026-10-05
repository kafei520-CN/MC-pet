import * as THREE from 'three'
import { PlayerObject } from 'skinview3d'
import { DISPLAYS, renderBlock, renderItem } from 'block-model-renderer'
import { blockExists, getAssets, MC_VERSION, PLAINS } from './assets.js'
import { loadCreativeTabs } from './creative.js'

const SCALE = 2
const GUI_W = 195
const GUI_H = 136
const COLS = 9
const ROWS = 5
const SLOT = 18
const ORIGIN_X = 9
const ORIGIN_Y = 18
const TRACK_X = 175
const TRACK_Y = 18
const TRACK_H = 112
const KNOB_H = 15
const TAB_W = 26
const TAB_H = 32
const TAB_PITCH = 28
const PANEL_Y = 28
const BAR_GAP = 4
const CANVAS_W = 230
const CHEST_X = 198
const PREVIEW = { x: 73, y: 6, w: 32, h: 43 }

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

function createPreview() {
  const canvas = document.createElement('canvas')
  canvas.className = 'doll'
  canvas.hidden = true
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false })
  renderer.setClearColor(0x000000, 0)
  if (THREE.SRGBColorSpace) {
    renderer.outputColorSpace = THREE.SRGBColorSpace
  }
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(50, PREVIEW.w / PREVIEW.h, 0.1, 256)
  camera.position.set(12, -4, 42)
  camera.lookAt(0, -8, 0)
  const player = new PlayerObject()
  player.cape.visible = false
  player.elytra.visible = false
  player.ears.visible = false
  player.rotation.y = -0.45
  scene.add(player)
  scene.add(new THREE.AmbientLight(0xffffff, 2.4))
  const key = new THREE.DirectionalLight(0xffffff, 1.2)
  key.position.set(-6, 10, 8)
  scene.add(key)
  return { canvas, renderer, scene, camera, player }
}

export function createCreativeView({
  onPick,
  onSelect,
  onClear,
  onSetSlot,
  getHotbar,
  getPlayer,
  setPlayer,
  getSkin,
} = {}) {
  const root = document.createElement('div')
  root.id = 'creative'
  root.hidden = true
  const canvas = document.createElement('canvas')
  canvas.className = 'gui'
  const preview = createPreview()
  root.append(canvas, preview.canvas)
  document.body.appendChild(root)
  const ctx = canvas.getContext('2d')
  const cursor = document.createElement('img')
  cursor.className = 'cursor-item'
  cursor.hidden = true
  cursor.alt = ''
  document.body.appendChild(cursor)

  const background = new Image()
  const widgets = new Image()
  const tabsImage = new Image()
  let backgroundReady = false
  let widgetsReady = false
  let tabsReady = false
  background.onload = () => {
    backgroundReady = true
    paint()
  }
  widgets.onload = () => {
    widgetsReady = true
    paint()
  }
  tabsImage.onload = () => {
    tabsReady = true
    paint()
  }
  const itemsTexture = '/resource-pack/minecraft/textures/gui/container/creative_inventory/tab_items.png'
  const packTexture = '/resource-pack/minecraft/textures/gui/container/creative_inventory/tab_inventory.png'
  background.src = itemsTexture
  widgets.src = '/resource-pack/minecraft/textures/gui/widgets.png'
  tabsImage.src = '/resource-pack/minecraft/textures/gui/container/creative_inventory/tabs.png'

  const icons = new Map()
  const iconUrls = new Map()
  const iconJobs = new Map()
  let pageTexture = itemsTexture
  let iconChain = Promise.resolve()
  let catalog = []
  let tabIndex = 0
  let scroll = 0
  let hover = -1
  let hotbar = { selected: 0, slots: Array.from({ length: 9 }, () => null) }
  let open = false
  let carried = null

  function canvasHeight() {
    return PANEL_Y + GUI_H + BAR_GAP + 26
  }

  function barY() {
    return PANEL_Y + GUI_H + BAR_GAP
  }

  function resize() {
    const width = CANVAS_W * SCALE
    const height = canvasHeight() * SCALE
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const left = Math.round((window.innerWidth - GUI_W * SCALE) / 2)
    const top = Math.round((window.innerHeight - height) / 2)
    root.style.left = `${left}px`
    root.style.top = `${top}px`
    const boxW = PREVIEW.w * SCALE
    const boxH = PREVIEW.h * SCALE
    preview.canvas.style.left = `${PREVIEW.x * SCALE}px`
    preview.canvas.style.top = `${(PANEL_Y + PREVIEW.y) * SCALE}px`
    preview.canvas.style.width = `${boxW}px`
    preview.canvas.style.height = `${boxH}px`
    preview.renderer.setSize(boxW, boxH, false)
    preview.camera.aspect = PREVIEW.w / PREVIEW.h
    preview.camera.updateProjectionMatrix()
  }

  function isPack() {
    return catalog[tabIndex]?.id === 'pack'
  }

  function items() {
    return catalog[tabIndex]?.items ?? []
  }

  function playerItems() {
    const list = getPlayer?.() ?? []
    return Array.from({ length: 27 }, (_, index) => list[index] ?? null)
  }

  function maxScroll() {
    return Math.max(0, Math.ceil(items().length / COLS) - ROWS)
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
        iconUrls.set(id, iconUrl(image))
        paint()
      } catch (error) {
        console.error(error)
      } finally {
        iconJobs.delete(id)
      }
    })
  }

  function iconUrl(image) {
    if (!image) {
      return ''
    }
    if (image instanceof HTMLCanvasElement) {
      return image.toDataURL()
    }
    return image.src || ''
  }

  function tabRect(index) {
    return { x: index * TAB_PITCH, y: 0, w: TAB_W, h: TAB_H }
  }

  function chestRect() {
    return { x: CHEST_X, y: PANEL_Y + GUI_H - 4, w: TAB_W, h: TAB_H }
  }

  function drawTab(index, selected, x, y, bottom) {
    if (!tabsReady) {
      return
    }
    const column = Math.min(6, Math.max(0, index))
    const row = bottom ? (selected ? 3 : 2) : (selected ? 1 : 0)
    ctx.drawImage(
      tabsImage,
      column * TAB_W,
      row * TAB_H,
      TAB_W,
      TAB_H,
      x * SCALE,
      y * SCALE,
      TAB_W * SCALE,
      TAB_H * SCALE,
    )
  }

  function paintTabs() {
    catalog.forEach((tab, index) => {
      wantIcon(tab.icon)
      const rect = tabRect(index)
      const selected = index === tabIndex
      drawTab(index, selected, rect.x, rect.y, false)
      const icon = icons.get(tab.icon)
      if (!icon) {
        return
      }
      const iconY = selected ? 6 : 8
      ctx.drawImage(icon, (rect.x + 5) * SCALE, (rect.y + iconY) * SCALE, 16 * SCALE, 16 * SCALE)
    })
    wantIcon('chest')
    const chest = chestRect()
    drawTab(6, false, chest.x, chest.y, true)
    const chestIcon = icons.get('chest')
    if (chestIcon) {
      ctx.drawImage(chestIcon, (chest.x + 5) * SCALE, (chest.y + 8) * SCALE, 16 * SCALE, 16 * SCALE)
    }
  }

  function paint() {
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, CANVAS_W * SCALE, canvasHeight() * SCALE)
    const pack = isPack()
    const nextTexture = pack ? packTexture : itemsTexture
    if (pageTexture !== nextTexture) {
      pageTexture = nextTexture
      backgroundReady = false
      background.src = nextTexture
    }
    if (backgroundReady) {
      ctx.drawImage(
        background,
        0,
        0,
        GUI_W,
        GUI_H,
        0,
        PANEL_Y * SCALE,
        GUI_W * SCALE,
        GUI_H * SCALE,
      )
    }
    if (pack) {
      paintPack()
    } else {
      paintItems()
    }
    paintTabs()
    paintBar()
    syncPreview()
    showCarried()
  }

  function paintItems() {
    const name = catalog[tabIndex]?.name ?? ''
    const pages = Math.max(1, maxScroll() + 1)
    const pageText = `${Math.min(pages, scroll + 1)}/${pages}`
    ctx.font = `${8 * SCALE}px "Minecraft", "Segoe UI", sans-serif`
    ctx.fillStyle = '#3f3f3f'
    ctx.fillText(name, 9 * SCALE, (PANEL_Y + 13) * SCALE)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(name, 8 * SCALE, (PANEL_Y + 12) * SCALE)
    const pageWidth = ctx.measureText(pageText).width
    ctx.fillStyle = '#3f3f3f'
    ctx.fillText(pageText, GUI_W * SCALE - pageWidth - 7 * SCALE, (PANEL_Y + 13) * SCALE)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(pageText, GUI_W * SCALE - pageWidth - 8 * SCALE, (PANEL_Y + 12) * SCALE)
    const ids = visibleIds()
    ids.forEach((id, index) => {
      const icon = icons.get(id)
      if (!icon) {
        return
      }
      const col = index % COLS
      const row = Math.floor(index / COLS)
      const dx = (ORIGIN_X + col * SLOT + 1) * SCALE
      const dy = (PANEL_Y + ORIGIN_Y + row * SLOT + 1) * SCALE
      ctx.drawImage(icon, dx, dy, 16 * SCALE, 16 * SCALE)
    })
    if (hover >= 0 && hover < ids.length) {
      const col = hover % COLS
      const row = Math.floor(hover / COLS)
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = SCALE
      ctx.strokeRect(
        (ORIGIN_X + col * SLOT) * SCALE + SCALE / 2,
        (PANEL_Y + ORIGIN_Y + row * SLOT) * SCALE + SCALE / 2,
        (SLOT - 1) * SCALE,
        (SLOT - 1) * SCALE,
      )
    }
    if (tabsReady) {
      const span = maxScroll()
      const knobTravel = TRACK_H - KNOB_H
      const knobY = PANEL_Y + TRACK_Y + (span === 0 ? 0 : (scroll / span) * knobTravel)
      ctx.drawImage(
        tabsImage,
        span === 0 ? 244 : 232,
        0,
        12,
        15,
        TRACK_X * SCALE,
        knobY * SCALE,
        12 * SCALE,
        15 * SCALE,
      )
    }
  }

  function visibleIds() {
    const list = items()
    const start = scroll * COLS
    const ids = list.slice(start, start + COLS * ROWS)
    for (const id of ids) {
      wantIcon(id)
    }
    for (const tab of catalog) {
      wantIcon(tab.icon)
    }
    for (const id of hotbar.slots) {
      wantIcon(id)
    }
    wantIcon('chest')
    return ids
  }

  function paintBar() {
    const bar = getHotbar?.() ?? hotbar
    hotbar = {
      selected: bar.selected ?? 0,
      slots: (bar.slots ?? hotbar.slots).slice(),
    }
    const y = barY()
    if (!widgetsReady) {
      return
    }
    ctx.drawImage(widgets, 0, 0, 182, 22, 7 * SCALE, y * SCALE, 182 * SCALE, 22 * SCALE)
    hotbar.slots.forEach((id, index) => {
      wantIcon(id)
      const icon = icons.get(id)
      if (!icon) {
        return
      }
      ctx.drawImage(icon, (10 + index * 20) * SCALE, (y + 3) * SCALE, 16 * SCALE, 16 * SCALE)
    })
    ctx.drawImage(
      widgets,
      0,
      22,
      24,
      22,
      (6 + hotbar.selected * 20) * SCALE,
      (y - 1) * SCALE,
      24 * SCALE,
      22 * SCALE,
    )
  }

  function paintStack(id, count, x, y) {
    if (!id) {
      return
    }
    wantIcon(id)
    const icon = icons.get(id)
    if (!icon) {
      return
    }
    ctx.drawImage(icon, (x + 1) * SCALE, (y + 1) * SCALE, 16 * SCALE, 16 * SCALE)
    if (count > 1) {
      ctx.font = `${8 * SCALE}px "Segoe UI", sans-serif`
      ctx.fillStyle = '#3f3f3f'
      ctx.fillText(String(count), (x + 11) * SCALE, (y + 16) * SCALE)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(String(count), (x + 10) * SCALE, (y + 15) * SCALE)
    }
  }

  function paintPack() {
    const packs = playerItems()
    for (let index = 0; index < 27; index += 1) {
      const stack = packs[index]
      const col = index % 9
      const row = Math.floor(index / 9)
      paintStack(stack?.id, stack?.count ?? 0, 8 + col * 18, PANEL_Y + 53 + row * 18)
    }
    const bar = getHotbar?.() ?? hotbar
    bar.slots.forEach((id, index) => {
      paintStack(id, 1, 8 + index * 18, PANEL_Y + 111)
    })
  }

  function syncPreview() {
    const show = open && isPack()
    preview.canvas.hidden = !show
    if (!show) {
      return
    }
    const skin = getSkin?.()
    if (skin?.map) {
      if (preview.player.skin.map !== skin.map) {
        preview.player.skin.map = skin.map
      }
      const model = skin.slim ? 'slim' : 'default'
      if (preview.player.skin.modelType !== model) {
        preview.player.skin.modelType = model
      }
    }
    preview.renderer.render(preview.scene, preview.camera)
  }

  function showCarried(event) {
    if (!open || !carried) {
      cursor.hidden = true
      return
    }
    const url = iconUrls.get(carried.id)
    if (!url) {
      cursor.hidden = true
      return
    }
    if (cursor.dataset.item !== carried.id) {
      cursor.src = url
      cursor.dataset.item = carried.id
    }
    cursor.hidden = false
    if (event) {
      cursor.style.left = `${event.clientX - 8}px`
      cursor.style.top = `${event.clientY - 8}px`
    }
  }

  function localPoint(event) {
    const box = canvas.getBoundingClientRect()
    return {
      x: (event.clientX - box.left) / SCALE,
      y: (event.clientY - box.top) / SCALE,
    }
  }

  function hitRect(point, rect) {
    return point.x >= rect.x && point.x < rect.x + rect.w && point.y >= rect.y && point.y < rect.y + rect.h
  }

  function tabAt(point) {
    for (let index = 0; index < catalog.length; index += 1) {
      if (hitRect(point, tabRect(index))) {
        return index
      }
    }
    if (hitRect(point, chestRect())) {
      return catalog.findIndex((tab) => tab.id === 'pack')
    }
    return -1
  }

  function slotAt(point) {
    const top = PANEL_Y + ORIGIN_Y
    const col = Math.floor((point.x - ORIGIN_X) / SLOT)
    const row = Math.floor((point.y - top) / SLOT)
    if (col < 0 || row < 0 || col >= COLS || row >= ROWS) {
      return -1
    }
    if (point.x > ORIGIN_X + COLS * SLOT || point.y > top + ROWS * SLOT) {
      return -1
    }
    const index = scroll * COLS + row * COLS + col
    return index < items().length ? index : -1
  }

  function hotbarAt(point) {
    const y = barY()
    if (point.y < y || point.y > y + 22) {
      return -1
    }
    const col = Math.floor((point.x - 7) / 20)
    return col >= 0 && col < 9 ? col : -1
  }

  function packSlotAt(point) {
    const top = PANEL_Y + 53
    if (point.y < top || point.y >= top + 54 || point.x < 8 || point.x >= 8 + 162) {
      return -1
    }
    const col = Math.floor((point.x - 8) / 18)
    const row = Math.floor((point.y - top) / 18)
    return row * 9 + col
  }

  function packBarAt(point) {
    const top = PANEL_Y + 111
    if (point.y < top || point.y >= top + 18 || point.x < 8 || point.x >= 170) {
      return -1
    }
    const col = Math.floor((point.x - 8) / 18)
    return col >= 0 && col < 9 ? col : -1
  }

  function selectTab(index) {
    if (index < 0 || index === tabIndex) {
      return
    }
    tabIndex = index
    scroll = 0
    hover = -1
    visibleIds()
    paint()
  }

  function stashCarried() {
    if (!carried) {
      cursor.hidden = true
      return
    }
    const packs = playerItems()
    for (let index = 0; index < packs.length && carried; index += 1) {
      const stack = packs[index]
      if (!stack || stack.id !== carried.id || stack.count >= 64) {
        continue
      }
      const move = Math.min(64 - stack.count, carried.count)
      stack.count += move
      carried.count -= move
      if (carried.count <= 0) {
        carried = null
      }
    }
    if (carried) {
      const empty = packs.findIndex((stack) => !stack)
      if (empty >= 0) {
        packs[empty] = carried
        carried = null
      }
    }
    setPlayer?.(packs)
    cursor.hidden = !carried
  }

  function clickPack(point) {
    const trashX = 172
    const trashY = PANEL_Y + 111
    if (point.x >= trashX && point.x < trashX + 18 && point.y >= trashY && point.y < trashY + 18) {
      carried = null
      paint()
      return
    }
    const barIndex = packBarAt(point)
    const outerIndex = barIndex >= 0 ? barIndex : hotbarAt(point)
    if (outerIndex >= 0) {
      const state = getHotbar?.() ?? hotbar
      if (carried) {
        const previous = state.slots[outerIndex]
        onSetSlot?.(outerIndex, carried.id)
        carried = previous ? { id: previous, count: 1 } : null
      } else if (state.selected === outerIndex) {
        onClear?.(outerIndex)
      } else {
        onSelect?.(outerIndex)
      }
      paint()
      return
    }
    const invIndex = packSlotAt(point)
    if (invIndex < 0) {
      return
    }
    const packs = playerItems()
    const stack = packs[invIndex]
    if (!carried && stack) {
      carried = { id: stack.id, count: stack.count }
      packs[invIndex] = null
    } else if (carried && !stack) {
      packs[invIndex] = carried
      carried = null
    } else if (carried && stack && stack.id === carried.id && stack.count < 64) {
      const move = Math.min(64 - stack.count, carried.count)
      stack.count += move
      carried.count -= move
      if (carried.count <= 0) {
        carried = null
      }
    } else if (carried && stack) {
      packs[invIndex] = carried
      carried = stack
    } else {
      return
    }
    setPlayer?.(packs)
    paint()
  }

  canvas.addEventListener('mousemove', (event) => {
    showCarried(event)
    if (isPack()) {
      return
    }
    const next = slotAt(localPoint(event))
    if (next !== hover) {
      hover = next
      paint()
    }
  })
  canvas.addEventListener('mouseleave', () => {
    hover = -1
    if (open) {
      paint()
    }
  })
  window.addEventListener('pointermove', (event) => {
    if (open && carried) {
      showCarried(event)
    }
  })
  canvas.addEventListener('pointerdown', (event) => {
    event.stopPropagation()
    const point = localPoint(event)
    if (event.button !== 0) {
      return
    }
    const tab = tabAt(point)
    if (tab >= 0) {
      selectTab(tab)
      return
    }
    if (isPack()) {
      clickPack(point)
      return
    }
    const slot = slotAt(point)
    if (slot >= 0) {
      onPick?.(items()[slot])
      return
    }
    const bar = hotbarAt(point)
    if (bar >= 0) {
      const state = getHotbar?.() ?? hotbar
      if (state.selected === bar) {
        onClear?.(bar)
      } else {
        onSelect?.(bar)
      }
    }
  })
  root.addEventListener('pointerdown', (event) => {
    event.stopPropagation()
  })
  root.addEventListener('wheel', (event) => {
    if (!open || isPack()) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const limit = maxScroll()
    const next = Math.max(0, Math.min(limit, scroll + (event.deltaY > 0 ? 1 : -1)))
    if (next !== scroll) {
      scroll = next
      hover = -1
      paint()
    }
  }, { passive: false })
  window.addEventListener('resize', () => {
    resize()
    paint()
  })
  resize()

  return {
    isOpen() {
      return open
    },
    async open() {
      if (!catalog.length) {
        catalog = await loadCreativeTabs()
      }
      open = true
      root.hidden = false
      scroll = 0
      visibleIds()
      paint()
    },
    close() {
      stashCarried()
      open = false
      root.hidden = true
      preview.canvas.hidden = true
      cursor.hidden = true
    },
    syncHotbar(state) {
      hotbar = {
        selected: state.selected,
        slots: state.slots.slice(),
      }
      if (open) {
        paint()
      }
    },
  }
}
