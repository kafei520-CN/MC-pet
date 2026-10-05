const PANEL_Y = 28
const GUI_W = 195
const GUI_H = 136
const TAB_W = 26
const TAB_H = 32
const PACK_BAR = { x: 8, y: 111, pitch: 18 }
const PACK_TRASH = { x: 172, y: 111, w: 18, h: 18 }
const PREVIEW = { x: 73, y: 6, w: 32, h: 43 }

function hit(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function assert(ok, message) {
  if (!ok) {
    throw new Error(message)
  }
}

const trash = { x: PACK_TRASH.x, y: PANEL_Y + PACK_TRASH.y, w: PACK_TRASH.w, h: PACK_TRASH.h }
const chest = { x: GUI_W - TAB_W, y: PANEL_Y + GUI_H - 4, w: TAB_W, h: TAB_H }
const bar = {
  x: PACK_BAR.x,
  y: PANEL_Y + PACK_BAR.y,
  w: PACK_BAR.pitch * 9,
  h: PACK_BAR.pitch,
}
const preview = { x: PREVIEW.x, y: PANEL_Y + PREVIEW.y, w: PREVIEW.w, h: PREVIEW.h }

assert(PACK_TRASH.x >= PACK_BAR.x + PACK_BAR.pitch * 9, 'trash sits after hotbar')
assert(PACK_TRASH.y === PACK_BAR.y, 'trash shares hotbar row')
assert(!hit(trash, chest), `trash overlaps chest tab ${JSON.stringify(trash)} ${JSON.stringify(chest)}`)
assert(!hit(trash, bar), 'trash overlaps hotbar slots')
assert(trash.y + trash.h <= chest.y, 'trash is above the chest tab')
assert(preview.x === 73 && preview.w === 32 && preview.h === 43, 'vanilla preview box')

const lookY = 1
const camY = 6
assert(camY > lookY, 'camera looks slightly down at standing player')

function headLook(mouseX, mouseY) {
  const cx = PREVIEW.x + PREVIEW.w / 2
  const cy = PANEL_Y + PREVIEW.y + PREVIEW.h / 2
  return {
    pitch: Math.max(-0.55, Math.min(0.4, Math.atan((mouseY - cy) / 40))),
    yaw: Math.max(-0.7, Math.min(0.7, Math.atan((mouseX - cx) / 40))),
  }
}
const right = headLook(PREVIEW.x + PREVIEW.w + 80, PANEL_Y + PREVIEW.y + PREVIEW.h / 2)
const left = headLook(PREVIEW.x - 80, PANEL_Y + PREVIEW.y + PREVIEW.h / 2)
const down = headLook(PREVIEW.x + PREVIEW.w / 2, PANEL_Y + PREVIEW.y + PREVIEW.h + 80)
assert(right.yaw > 0.3 && left.yaw < -0.3, 'head yaws toward mouse')
assert(down.pitch > 0.3, 'head pitches down toward mouse')
console.log('creative pack layout ok')
