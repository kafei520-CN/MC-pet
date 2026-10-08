import * as THREE from 'three'
import { PlayerObject } from 'skinview3d'
import { CREATIVE_ICON_INSET, drawGuiIcon, ICON_SIZE, PACK_ICON_INSET, renderGuiIcon } from './icon.js'
import { loadCreativeTabs } from './creative.js'
import { itemDisplayName, loadItemLang } from './lang.js'
import { asStack, itemStack, mergeInto, sameStack, stackCount, stackId, stackRoom } from './item-stack.js'

const SCALE = 2
const GUI_W = 195
const GUI_H = 136
const COLS = 9
const ROWS = 5
const SLOT = 18
const ORIGIN_X = 9
const ORIGIN_Y = 16
const CATALOG = { x: 9, y: 18, cols: 9, rows: 5, slot: 18 }
const CREATIVE_BAR = { x: 9, y: 112, slot: 18 }
const TRACK_X = 175
const TRACK_Y = 18
const TRACK_H = 112
const KNOB_H = 15
const TAB_W = 26
const TAB_H = 32
const PANEL_Y = 28
const PREVIEW = { x: 73, y: 6, w: 32, h: 43 }
const PACK_INV = { x: 8, y: 53, pitch: 18 }
const PACK_BAR = { x: 8, y: 111, pitch: 18 }
const PACK_TRASH = { x: 172, y: 111, w: 18, h: 18 }
const SEARCH_BOX = { x: 82, y: 6, w: 80, h: 12 }
const PACK_VIEW = -2

function renderIcon(id) {
  return renderGuiIcon(id, 16 * SCALE)
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
  const camera = new THREE.PerspectiveCamera(40, PREVIEW.w / PREVIEW.h, 0.1, 256)
  camera.position.set(0, 6, 48)
  camera.lookAt(0, 1, 0)
  const player = new PlayerObject()
  player.cape.visible = false
  player.elytra.visible = false
  player.ears.visible = false
  player.resetJoints()
  scene.add(player)
  scene.add(new THREE.AmbientLight(0xffffff, 2.4))
  const key = new THREE.DirectionalLight(0xffffff, 1.2)
  key.position.set(8, 16, 24)
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
  const search = document.createElement('input')
  search.className = 'creative-search'
  search.type = 'text'
  search.spellcheck = false
  search.autocomplete = 'off'
  search.placeholder = ''
  search.hidden = true
  root.append(canvas, preview.canvas, search)
  document.body.appendChild(root)
  const ctx = canvas.getContext('2d')
  const cursor = document.createElement('img')
  cursor.className = 'cursor-item'
  cursor.hidden = true
  cursor.alt = ''
  const tip = document.createElement('div')
  tip.className = 'mc-tooltip'
  tip.hidden = true
  document.body.append(cursor, tip)

  const background = new Image()
  const tabsImage = new Image()
  let backgroundReady = false
  let tabsReady = false
  background.onload = () => {
    backgroundReady = true
    paint()
  }
  tabsImage.onload = () => {
    tabsReady = true
    paint()
  }
  const itemsTexture = '/resource-pack/minecraft/textures/gui/container/creative_inventory/tab_items.png'
  const packTexture = '/resource-pack/minecraft/textures/gui/container/creative_inventory/tab_inventory.png'
  const searchTexture = '/resource-pack/minecraft/textures/gui/container/creative_inventory/tab_item_search.png'
  background.src = packTexture
  tabsImage.src = '/resource-pack/minecraft/textures/gui/container/creative_inventory/tabs.png'

  const icons = new Map()
  const iconUrls = new Map()
  const iconJobs = new Map()
  let pageTexture = packTexture
  let iconChain = Promise.resolve()
  let catalog = []
  let warmup = null
  let tabIndex = 6
  let view = 'pack'
  let query = ''
  let scroll = 0
  let hover = -1
  let hoverTrash = false
  let mouse = { x: PREVIEW.x + PREVIEW.w / 2, y: PANEL_Y + PREVIEW.y + PREVIEW.h / 2 }
  let pointer = { x: 0, y: 0 }
  let hotbar = { selected: 0, slots: Array.from({ length: 9 }, () => null) }
  let open = false
  let carried = null

  function canvasHeight() {
    return PANEL_Y + GUI_H - 4 + TAB_H
  }

  function liveHotbar() {
    const bar = getHotbar?.() ?? hotbar
    hotbar = {
      selected: bar.selected ?? 0,
      slots: (bar.slots ?? hotbar.slots).slice(),
    }
    return hotbar
  }

  function resize() {
    const width = GUI_W * SCALE
    const height = canvasHeight() * SCALE
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const left = Math.round((window.innerWidth - width) / 2)
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
    search.style.left = `${SEARCH_BOX.x * SCALE}px`
    search.style.top = `${(PANEL_Y + SEARCH_BOX.y) * SCALE}px`
    search.style.width = `${SEARCH_BOX.w * SCALE}px`
    search.style.height = `${SEARCH_BOX.h * SCALE}px`
  }

  function isPack() {
    return view === 'pack'
  }

  function isSearch() {
    return view === 'search'
  }

  function allItems() {
    const seen = new Set()
    const list = []
    for (const tab of catalog) {
      if (tab.id === 'search') {
        continue
      }
      for (const stack of tab.items ?? []) {
        const id = stackId(stack)
        if (!id || seen.has(id)) {
          continue
        }
        seen.add(id)
        list.push(stack)
      }
    }
    return list
  }

  function items() {
    if (isSearch()) {
      const q = query.trim().toLowerCase()
      const list = allItems()
      if (!q) {
        return list
      }
      const compact = q.replace(/\s+/g, '_')
      return list.filter((stack) => {
        const id = stackId(stack)
        return id.includes(compact) || id.replace(/_/g, '').includes(q.replace(/[\s_]/g, ''))
      })
    }
    return catalog[tabIndex]?.items ?? []
  }

  function playerItems() {
    const list = getPlayer?.() ?? []
    return Array.from({ length: 27 }, (_, index) => list[index] ?? null)
  }

  function maxScroll() {
    return Math.max(0, Math.ceil(items().length / COLS) - CATALOG.rows)
  }

  function wantIcon(id) {
    if (!id || icons.has(id) || iconJobs.has(id)) {
      return
    }
    iconJobs.set(id, true)
    iconChain = iconChain.then(async () => {
      try {
        const image = await renderIcon(id)
        if (!image) {
          return
        }
        icons.set(id, image)
        if (open) {
          paint()
        }
      } catch (error) {
        console.error(error)
      } finally {
        iconJobs.delete(id)
      }
    })
  }

  function prefetchImage(url) {
    return new Promise((resolve) => {
      const image = new Image()
      image.onload = () => resolve()
      image.onerror = () => resolve()
      image.src = url
    })
  }

  function queueCatalogIcons() {
    for (const tab of catalog) {
      wantIcon(tab.icon)
      for (const stack of tab.items ?? []) {
        wantIcon(stackId(stack))
      }
    }
    wantIcon('chest')
  }

  function startWarmup() {
    if (warmup) {
      return warmup
    }
    warmup = (async () => {
      const [tabs] = await Promise.all([
        loadCreativeTabs(),
        loadItemLang(),
        prefetchImage(itemsTexture),
        prefetchImage(searchTexture),
      ])
      catalog = tabs
      queueCatalogIcons()
      await iconChain
    })()
    return warmup
  }

  function iconUrl(id) {
    if (iconUrls.has(id)) {
      return iconUrls.get(id)
    }
    const image = icons.get(id)
    if (!image) {
      return ''
    }
    const url = image instanceof HTMLCanvasElement ? image.toDataURL() : (image.src || '')
    if (url) {
      iconUrls.set(id, url)
    }
    return url
  }

  function tabRect(index) {
    const tab = catalog[index]
    if (!tab) {
      return { x: 0, y: 0, w: TAB_W, h: TAB_H, bottom: false }
    }
    if (tab.align === 'right') {
      return { x: GUI_W - TAB_W, y: 0, w: TAB_W, h: TAB_H, bottom: false }
    }
    const bottom = tab.row === 'bottom'
    const rowTabs = catalog.filter((item) => (item.row === 'bottom') === bottom && item.align !== 'right')
    const slot = Math.max(0, rowTabs.findIndex((item) => item.id === tab.id))
    return {
      x: slot * 27,
      y: bottom ? PANEL_Y + GUI_H - 4 : 0,
      w: TAB_W,
      h: TAB_H,
      bottom,
    }
  }

  function chestRect() {
    return { x: GUI_W - TAB_W, y: PANEL_Y + GUI_H - 4, w: TAB_W, h: TAB_H }
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

  function paintTab(index, selected, rect, bottom, iconId) {
    wantIcon(iconId)
    drawTab(index, selected, rect.x, rect.y, bottom)
    const icon = icons.get(iconId)
    if (!icon) {
      return
    }
    const iconY = selected ? (bottom ? 9 : 6) : 8
    ctx.drawImage(icon, (rect.x + 5) * SCALE, (rect.y + iconY) * SCALE, 16 * SCALE, 16 * SCALE)
  }

  function paintUnselectedTabs() {
    catalog.forEach((tab, index) => {
      if (!isPack() && index === tabIndex) {
        return
      }
      const rect = tabRect(index)
      paintTab(index, false, rect, rect.bottom, tab.icon)
    })
    if (!isPack()) {
      paintTab(6, false, chestRect(), true, 'chest')
    }
  }

  function paintSelectedTab() {
    if (isPack()) {
      paintTab(6, true, chestRect(), true, 'chest')
      return
    }
    const tab = catalog[tabIndex]
    if (!tab) {
      return
    }
    const rect = tabRect(tabIndex)
    paintTab(tabIndex, true, rect, rect.bottom, tab.icon)
  }

  function pageFile() {
    if (isPack()) {
      return packTexture
    }
    if (isSearch()) {
      return searchTexture
    }
    return itemsTexture
  }

  function paint() {
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, GUI_W * SCALE, canvasHeight() * SCALE)
    const pack = isPack()
    const nextTexture = pageFile()
    if (pageTexture !== nextTexture) {
      pageTexture = nextTexture
      backgroundReady = false
      background.src = nextTexture
    }
    liveHotbar()
    paintUnselectedTabs()
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
    paintSelectedTab()
    syncPreview()
    showCarried()
  }

  function paintItems() {
    const name = isSearch() ? '搜索物品' : (catalog[tabIndex]?.name ?? '')
    ctx.font = `${8 * SCALE}px "Minecraft", "Segoe UI", sans-serif`
    ctx.fillStyle = '#3f3f3f'
    ctx.fillText(name, 9 * SCALE, (PANEL_Y + 13) * SCALE)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(name, 8 * SCALE, (PANEL_Y + 12) * SCALE)
    if (!isSearch()) {
      const pages = Math.max(1, maxScroll() + 1)
      const pageText = `${Math.min(pages, scroll + 1)}/${pages}`
      const pageWidth = ctx.measureText(pageText).width
      ctx.fillStyle = '#3f3f3f'
      ctx.fillText(pageText, GUI_W * SCALE - pageWidth - 7 * SCALE, (PANEL_Y + 13) * SCALE)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(pageText, GUI_W * SCALE - pageWidth - 8 * SCALE, (PANEL_Y + 12) * SCALE)
    }
    const stacks = visibleIds()
    stacks.forEach((stack, index) => {
      const id = stackId(stack)
      const icon = icons.get(id)
      if (!icon) {
        return
      }
      const col = index % CATALOG.cols
      const row = Math.floor(index / CATALOG.cols)
      const x = CATALOG.x + col * CATALOG.slot
      const y = PANEL_Y + CATALOG.y + row * CATALOG.slot
      drawGuiIcon(ctx, icon, x, y, SCALE, CREATIVE_ICON_INSET)
      const count = stackCount(stack)
      if (count > 1) {
        ctx.font = `${8 * SCALE}px "Segoe UI", sans-serif`
        ctx.fillStyle = '#3f3f3f'
        ctx.fillText(String(count), (x + 11) * SCALE, (y + 16) * SCALE)
        ctx.fillStyle = '#ffffff'
        ctx.fillText(String(count), (x + 10) * SCALE, (y + 15) * SCALE)
      }
    })
    paintCreativeBar()
    const local = hover - scroll * COLS
    if (local >= 0 && local < stacks.length) {
      const col = local % COLS
      const row = Math.floor(local / COLS)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.fillRect(
        (CATALOG.x + col * CATALOG.slot + CREATIVE_ICON_INSET) * SCALE,
        (PANEL_Y + CATALOG.y + row * CATALOG.slot + CREATIVE_ICON_INSET) * SCALE,
        ICON_SIZE * SCALE,
        ICON_SIZE * SCALE,
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
    const stacks = list.slice(start, start + CATALOG.cols * CATALOG.rows)
    for (const stack of stacks) {
      wantIcon(stackId(stack))
    }
    for (const tab of catalog) {
      wantIcon(tab.icon)
    }
    for (const slot of hotbar.slots) {
      wantIcon(stackId(slot))
    }
    wantIcon('chest')
    return stacks
  }

  function paintCreativeBar() {
    const y = PANEL_Y + CREATIVE_BAR.y
    liveHotbar().slots.forEach((slot, index) => {
      paintStack(stackId(slot), stackCount(slot), CREATIVE_BAR.x + index * CREATIVE_BAR.slot, y, CREATIVE_ICON_INSET)
    })
  }

  function paintStack(id, count, x, y, inset = PACK_ICON_INSET) {
    if (!id) {
      return
    }
    wantIcon(id)
    const icon = icons.get(id)
    if (!icon) {
      return
    }
    drawGuiIcon(ctx, icon, x, y, SCALE, inset)
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
      paintStack(
        stack?.id,
        stack?.count ?? 0,
        PACK_INV.x + col * PACK_INV.pitch,
        PANEL_Y + PACK_INV.y + row * PACK_INV.pitch,
      )
    }
    liveHotbar().slots.forEach((slot, index) => {
      paintStack(stackId(slot), stackCount(slot), PACK_BAR.x + index * PACK_BAR.pitch, PANEL_Y + PACK_BAR.y)
    })
    if (hoverTrash) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.fillRect(
        (PACK_TRASH.x + PACK_ICON_INSET) * SCALE,
        (PANEL_Y + PACK_TRASH.y + PACK_ICON_INSET) * SCALE,
        ICON_SIZE * SCALE,
        ICON_SIZE * SCALE,
      )
    }
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
    preview.player.resetJoints()
    preview.player.rotation.set(0, 0, 0)
    const cx = PREVIEW.x + PREVIEW.w / 2
    const cy = PANEL_Y + PREVIEW.y + PREVIEW.h / 2
    const yaw = Math.atan((mouse.x - cx) / 40)
    const pitch = Math.atan((mouse.y - cy) / 40)
    preview.player.skin.head.rotation.set(
      Math.max(-0.55, Math.min(0.4, pitch)),
      Math.max(-0.7, Math.min(0.7, yaw)),
      0,
    )
    preview.renderer.render(preview.scene, preview.camera)
  }

  function showCarried(event) {
    if (!open || !carried) {
      cursor.hidden = true
      return
    }
    const url = iconUrl(carried.id)
    if (url && cursor.dataset.item !== carried.id) {
      cursor.src = url
      cursor.dataset.item = carried.id
    }
    if (url || cursor.dataset.item === carried.id) {
      cursor.hidden = false
    }
    cursor.style.left = `${pointer.x - 8}px`
    cursor.style.top = `${pointer.y - 8}px`
  }

  function takeCatalog(id) {
    if (!id) {
      return
    }
    if (carried && carried.id !== id) {
      carried = null
      paint()
      return
    }
    const next = itemStack(id, carried && carried.id === id ? carried.count + 1 : 1)
    if (!next) {
      return
    }
    carried = next
    wantIcon(id)
    paint()
  }

  function localPoint(event) {
    pointer.x = event.clientX
    pointer.y = event.clientY
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
      return PACK_VIEW
    }
    return -1
  }

  function slotAt(point) {
    const top = PANEL_Y + CATALOG.y
    const col = Math.floor((point.x - CATALOG.x) / CATALOG.slot)
    const row = Math.floor((point.y - top) / CATALOG.slot)
    if (col < 0 || row < 0 || col >= CATALOG.cols || row >= CATALOG.rows) {
      return -1
    }
    if (point.x > ORIGIN_X + COLS * SLOT || point.y > top + ROWS * SLOT) {
      return -1
    }
    const index = scroll * COLS + row * COLS + col
    return index < items().length ? index : -1
  }

  function packSlotAt(point) {
    const top = PANEL_Y + PACK_INV.y
    if (point.y < top || point.y >= top + PACK_INV.pitch * 3 || point.x < PACK_INV.x || point.x >= PACK_INV.x + PACK_INV.pitch * 9) {
      return -1
    }
    const col = Math.floor((point.x - PACK_INV.x) / PACK_INV.pitch)
    const row = Math.floor((point.y - top) / PACK_INV.pitch)
    return row * 9 + col
  }

  function creativeBarAt(point) {
    const top = PANEL_Y + CREATIVE_BAR.y
    if (point.y < top || point.y >= top + CREATIVE_BAR.slot || point.x < CREATIVE_BAR.x || point.x >= CREATIVE_BAR.x + 9 * CREATIVE_BAR.slot) {
      return -1
    }
    const col = Math.floor((point.x - CREATIVE_BAR.x) / CREATIVE_BAR.slot)
    return col >= 0 && col < 9 ? col : -1
  }

  function placeHotbar(index) {
    const state = getHotbar?.() ?? hotbar
    const current = asStack(state.slots[index])
    if (carried && current && sameStack(current, carried)) {
      const merged = mergeInto(current, carried)
      onSetSlot?.(index, merged.dest)
      carried = merged.leftover
    } else if (carried) {
      onSetSlot?.(index, carried)
      carried = current
    } else if (current) {
      carried = current
      onSetSlot?.(index, null)
    }
    paint()
  }

  function clickCreativeBar(index) {
    placeHotbar(index)
  }

  function packBarAt(point) {
    const top = PANEL_Y + PACK_BAR.y
    if (point.y < top || point.y >= top + PACK_BAR.pitch || point.x < PACK_BAR.x || point.x >= PACK_BAR.x + PACK_BAR.pitch * 9) {
      return -1
    }
    const col = Math.floor((point.x - PACK_BAR.x) / PACK_BAR.pitch)
    return col >= 0 && col < 9 ? col : -1
  }

  function packTrashAt(point) {
    const x = PACK_TRASH.x
    const y = PANEL_Y + PACK_TRASH.y
    return point.x >= x && point.x < x + PACK_TRASH.w && point.y >= y && point.y < y + PACK_TRASH.h
  }

  function showSearch(on) {
    search.hidden = !on
    if (on) {
      search.focus()
    } else {
      search.blur()
    }
  }

  function selectTab(index) {
    if (index === PACK_VIEW) {
      view = 'pack'
      showSearch(false)
      paint()
      return
    }
    if (index < 0 || index >= catalog.length) {
      return
    }
    const nextView = catalog[index].id === 'search' ? 'search' : 'items'
    if (index === tabIndex && view === nextView) {
      return
    }
    tabIndex = index
    view = nextView
    scroll = 0
    hover = -1
    showSearch(nextView === 'search')
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
      if (!stack || !sameStack(stack, carried) || stackRoom(stack) < 1) {
        continue
      }
      const move = Math.min(stackRoom(stack), carried.count)
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

  function clickPack(point, shift) {
    if (packTrashAt(point)) {
      carried = null
      if (shift) {
        setPlayer?.(Array.from({ length: 27 }, () => null))
        for (let index = 0; index < 9; index += 1) {
          onClear?.(index)
        }
      }
      paint()
      return
    }
    const outerIndex = packBarAt(point)
    if (outerIndex >= 0) {
      placeHotbar(outerIndex)
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
    } else if (carried && stack && sameStack(stack, carried) && stackRoom(stack) > 0) {
      const move = Math.min(stackRoom(stack), carried.count)
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

  function placeTip(clientX, clientY) {
    const pad = 8
    const width = tip.offsetWidth
    const height = tip.offsetHeight
    let x = clientX + 12
    let y = clientY - 18
    if (x + width + pad > window.innerWidth) {
      x = clientX - width - 8
    }
    if (y < pad) {
      y = clientY + 20
    }
    if (y + height + pad > window.innerHeight) {
      y = window.innerHeight - height - pad
    }
    tip.style.left = `${Math.max(pad, x)}px`
    tip.style.top = `${Math.max(pad, y)}px`
  }

  function showTip(id, clientX, clientY) {
    if (!open || carried || !id) {
      tip.hidden = true
      return
    }
    const text = id === '__destroy__' ? '销毁物品' : itemDisplayName(id)
    if (tip.textContent !== text) {
      tip.textContent = text
    }
    tip.hidden = false
    placeTip(clientX, clientY)
  }

  function hoverIdAt(point) {
    if (isPack()) {
      if (packTrashAt(point)) {
        return '__destroy__'
      }
      const bar = packBarAt(point)
      if (bar >= 0) {
        return stackId(liveHotbar().slots[bar]) || null
      }
      const inv = packSlotAt(point)
      if (inv >= 0) {
        return playerItems()[inv]?.id ?? null
      }
      return null
    }
    const bar = creativeBarAt(point)
    if (bar >= 0) {
      return stackId(liveHotbar().slots[bar]) || null
    }
    const index = slotAt(point)
    return index >= 0 ? stackId(items()[index]) : null
  }

  canvas.addEventListener('mousemove', (event) => {
    const point = localPoint(event)
    mouse = point
    showCarried()
    if (isPack()) {
      const nextTrash = packTrashAt(point)
      if (hover !== -1 || nextTrash !== hoverTrash) {
        hover = -1
        hoverTrash = nextTrash
        paint()
      } else {
        syncPreview()
      }
      showTip(hoverIdAt(point), event.clientX, event.clientY)
      return
    }
    const next = slotAt(point)
    if (next !== hover) {
      hover = next
      paint()
    }
    showTip(hoverIdAt(point), event.clientX, event.clientY)
  })
  canvas.addEventListener('mouseleave', () => {
    hover = -1
    hoverTrash = false
    tip.hidden = true
    if (open) {
      paint()
    }
  })
  window.addEventListener('pointermove', (event) => {
    pointer.x = event.clientX
    pointer.y = event.clientY
    if (open && carried) {
      showCarried()
    }
  })
  canvas.addEventListener('pointerdown', (event) => {
    event.stopPropagation()
    const point = localPoint(event)
    if (event.button !== 0) {
      return
    }
    if (isPack() && packTrashAt(point)) {
      clickPack(point, event.shiftKey)
      return
    }
    const tab = tabAt(point)
    if (tab !== -1) {
      selectTab(tab)
      return
    }
    if (isPack()) {
      clickPack(point, event.shiftKey)
      return
    }
    const bar = creativeBarAt(point)
    if (bar >= 0) {
      clickCreativeBar(bar)
      return
    }
    const slot = slotAt(point)
    if (slot < 0) {
      return
    }
    takeCatalog(stackId(items()[slot]))
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
      tip.hidden = true
      paint()
    }
  }, { passive: false })
  search.addEventListener('pointerdown', (event) => {
    event.stopPropagation()
  })
  search.addEventListener('keydown', (event) => {
    event.stopPropagation()
  })
  search.addEventListener('input', () => {
    query = search.value
    scroll = 0
    hover = -1
    visibleIds()
    paint()
  })
  window.addEventListener('resize', () => {
    resize()
    paint()
  })
  resize()
  startWarmup()

  return {
    isOpen() {
      return open
    },
    ready() {
      return startWarmup()
    },
    async open() {
      if (!catalog.length) {
        await startWarmup()
      }
      if (!catalog.length) {
        catalog = await loadCreativeTabs()
      }
      const searchIndex = catalog.findIndex((tab) => tab.id === 'search')
      if (searchIndex >= 0) {
        tabIndex = searchIndex
      } else if (tabIndex < 0 || tabIndex >= catalog.length) {
        tabIndex = 0
      }
      view = 'pack'
      query = ''
      search.value = ''
      showSearch(false)
      open = true
      root.hidden = false
      scroll = 0
      await loadItemLang()
      liveHotbar()
      visibleIds()
      paint()
    },
    close() {
      stashCarried()
      open = false
      root.hidden = true
      preview.canvas.hidden = true
      cursor.hidden = true
      tip.hidden = true
      showSearch(false)
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
