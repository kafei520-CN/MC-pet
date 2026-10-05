import { frontCovers, visibleTopSpans } from '../src/mc/window-order.js'

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

console.log('window order ok')
