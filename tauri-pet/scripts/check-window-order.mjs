import { frontCovers, seatAt, seatXOn, visibleTopSpans } from '../src/mc/window-order.js'

function assert(ok, message) {
  if (!ok) {
    throw new Error(message)
  }
}

const front = { id: 'front', x: 100, y: 200, width: 400, height: 300 }
const back = { id: 'back', x: 80, y: 260, width: 500, height: 200 }
const windows = [front, back]

assert(frontCovers(windows, 200, 260, 'back'), 'front window covers the back title bar')
assert(!frontCovers(windows, 200, 200, 'front'), 'the front window is not covered by itself')
assert(!frontCovers(windows, 90, 260, 'back'), 'the back title bar stays open beside the front window')

const cut = visibleTopSpans(back, windows)
assert(cut.length === 2, `covered middle splits the top, got ${JSON.stringify(cut)}`)
assert(cut[0][0] === 80 && cut[0][1] === 100, 'left stub stays')
assert(cut[1][0] === 500 && cut[1][1] === 580, 'right stub stays')

const clear = { id: 'clear', x: 0, y: 40, width: 200, height: 80 }
const below = { id: 'below', x: 0, y: 400, width: 200, height: 80 }
assert(visibleTopSpans(below, [clear, below]).length === 1, 'a window that does not reach this top does not cut it')
assert(visibleTopSpans(back, [front, back]).length === 2, 'a fully overlapped middle is removed')
assert(visibleTopSpans(back, [{ ...front, x: 80, width: 500 }, back]).length === 0, 'a nearer window hides the whole top')

const high = { id: 'high', x: 10, y: 40, width: 300, height: 400 }
const flush = { id: 'flush', x: 0, y: 0, width: 500, height: 400 }
const underFlush = { id: 'under', x: 40, y: 80, width: 300, height: 240 }
assert(seatAt([high], 80, 48)?.id === 'high', 'a window below the screen edge can be sat on')
assert(seatAt([flush], 80, 40) == null, 'a window on the screen top is not a seat')
assert(seatAt([flush, underFlush], 80, 120) == null, 'a screen-top window does not pass the seat through')
assert(seatAt(windows, 250, 400)?.id === 'front', 'a point on the front window sits on the front window')
assert(seatAt(windows, 90, 260)?.id === 'back', 'an exposed top beside the front window is the back window')
assert(seatAt(windows, 250, 260)?.id === 'front', 'a point on the front window does not sit on the window behind')
const strip = { id: 'strip', x: 100, y: 240, width: 200, height: 40 }
assert(seatAt([strip, back], 250, 350) == null, 'a covered top does not fall through to the window behind')
assert(seatAt(windows, 250, 400, 'front') == null, 'ignoring the front window does not sit through it')
assert(seatXOn(back, windows, 90) != null, 'the exposed stub still has a seat x')
assert(seatXOn(back, [{ ...front, x: 80, width: 500 }, back], 200) == null, 'a fully covered top has no seat x')

console.log('window order ok')
