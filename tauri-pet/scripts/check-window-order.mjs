import { dragDownSeat, feetWindow, frontCovers, seatAbove, seatAt, seatDrop, seatEdge, seatEntered, seatForDrop, seatPullDown, seatRelease, seatXOn, SEAT_ABOVE, SEAT_EDGE, SEAT_LIP, SEAT_REACH, standWindow, visibleTopSpans } from '../src/mc/window-order.js'

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
assert(seatAt(windows, 250, 210)?.id === 'front', 'the title bar of the front window is a seat')
assert(seatAt(windows, 250, 400) == null, 'the window body is not a seat')
assert(seatAt(windows, 90, 260)?.id === 'back', 'an exposed top beside the front window is the back window')
assert(seatAt(windows, 250, 260) == null, 'a point on the front window body does not sit on the window behind')
const strip = { id: 'strip', x: 100, y: 240, width: 200, height: 40 }
assert(seatAt([strip, back], 250, 350) == null, 'a covered top does not fall through to the window behind')
assert(seatAt(windows, 250, 400, 'front') == null, 'ignoring the front window does not sit through it')
assert(seatXOn(back, windows, 90) != null, 'the exposed stub still has a seat x')
assert(seatXOn(back, [{ ...front, x: 80, width: 500 }, back], 200) == null, 'a fully covered top has no seat x')

const titleBottom = front.y + 32
assert(seatDrop(windows, 250, front.y + 8)?.id === 'front', 'a title-bar drop sits')
assert(seatDrop(windows, 250, front.y - 20)?.id === 'front', 'a drop just above the top sits')
assert(seatDrop(windows, 250, front.y - SEAT_ABOVE - 8) == null, 'a drop well above the top stays in the air')
assert(seatDrop(windows, 250, titleBottom + 40)?.id === 'front', 'a drop in the lip under the title sits')
assert(seatDrop(windows, 250, titleBottom + SEAT_LIP + 30) == null, 'a drop deep in the window stays put')
assert(seatDrop(windows, 250, titleBottom + 40)?.id !== 'back', 'the front lip does not sit on the window behind')
assert(seatDrop(windows, 90, back.y + 40)?.id === 'back', 'an exposed lip beside the front window sits on the back window')
assert(seatDrop([flush], 80, 40) == null, 'a screen-top window is not a drop seat')
assert(seatDrop([flush, underFlush], 80, 120) == null, 'a screen-top window does not pass a drop through')

assert(standWindow([front], 250, front.y)?.id === 'front', 'feet on the top are standing on that window')
assert(standWindow([front], 250, front.y + 20)?.id === 'front', 'feet just under the top still count as standing')
assert(standWindow([front], 250, 400) == null, 'feet deep in the window are not standing on it')
assert(seatPullDown(windows, 'front', 250, 360)?.id === 'front', 'a downward pull into the window sits')
assert(seatPullDown(windows, 'front', 250, front.y - 90)?.id === 'front', 'a downward pull still above the title sits')
assert(seatPullDown(windows, 'front', 250, front.y - 200) == null, 'a pull far above the window does not sit')
assert(seatPullDown(windows, 'back', 250, 400) == null, 'a nearer window blocks a pull onto the window behind')
assert(seatPullDown(windows, 'back', 90, 350)?.id === 'back', 'a pull onto an exposed top sits on that window')
assert(seatPullDown([flush], 'flush', 80, 80) == null, 'a screen-top window is not a pull seat')

assert(seatRelease(windows, 250, 360)?.id === 'front', 'a release inside the window sits')
assert(seatRelease(windows, 250, front.y - 140)?.id === 'front', 'a release a body-height above the top sits')
assert(seatRelease(windows, 250, front.y - SEAT_REACH - 20) == null, 'a release far above the window does not sit')
assert(seatRelease(windows, 250, front.y + front.height + 30) == null, 'a release below the window does not sit')
assert(seatRelease(windows, 250, 400)?.id === 'front', 'the front window keeps a release inside it')
assert(seatRelease(windows, 90, 350)?.id === 'back', 'an exposed strip sits on the back window')
assert(seatRelease([flush], 80, 200) == null, 'a screen-top window is not a release seat')
assert(seatRelease([flush, underFlush], 80, 160) == null, 'a screen-top window does not pass a release through')
assert(seatEdge(windows, 250, front.y + 8)?.id === 'front', 'the upper edge is a seat')
assert(seatEdge(windows, 250, front.y - 20)?.id === 'front', 'just above the upper edge is a seat')
assert(seatEdge(windows, 250, front.y - 100)?.id === 'front', 'a neck above the edge sits when the body rests on it')
assert(seatEdge(windows, 250, front.y - 220) == null, 'a neck far above the edge does not sit')
assert(seatEdge(windows, 250, front.y + SEAT_EDGE + 30) == null, 'below the upper edge is not a seat')
assert(seatEdge(windows, 250, 400) == null, 'the window body is not an edge seat')
assert(seatEdge(windows, 90, back.y + 8)?.id === 'back', 'an exposed upper edge sits on that window')
assert(seatEdge(windows, 250, back.y + 8) == null, 'a covered upper edge does not sit on the window behind')
assert(seatEdge([flush], 80, 12) == null, 'a screen-top window edge is not a seat')
assert(seatAbove(windows, 250, front.y - 80)?.id === 'front', 'dragging up just above a window sits on it')
assert(seatAbove(windows, 250, front.y - 400) == null, 'dragging up far above a window does not sit')
assert(seatEntered(windows, 250, 320)?.id === 'front', 'a release inside the front window sits on it')
assert(seatEntered(windows, 250, 400)?.id === 'front', 'inside the front window does not sit on the one behind')
assert(seatEntered(windows, 20, 400) == null, 'outside every window does not sit')
assert(seatEntered([flush], 80, 200) == null, 'a screen-top window is not an entered seat')
assert(feetWindow([front], 250, front.y)?.id === 'front', 'feet on the top remember that window')
assert(feetWindow([front], 250, 400) == null, 'feet deep in the window are not standing on it')
assert(dragDownSeat(windows, front, 250, front.y + 50)?.id === 'front', 'a downward drag onto the edge sits')
assert(dragDownSeat(windows, front, 250, front.y - 70)?.id === 'front', 'a short downward drag still over the window sits')
assert(dragDownSeat(windows, front, 250, front.y + 200) == null, 'a drag deep into the window does not sit')
assert(dragDownSeat(windows, front, 20, front.y + 20) == null, 'a drag off the window does not sit')
assert(dragDownSeat(windows, back, 250, back.y + 20) == null, 'a nearer window blocks the drag-down seat')
assert(dragDownSeat(windows, back, 90, back.y + 10)?.id === 'back', 'a drag onto an exposed edge sits on that window')
assert(seatForDrop(windows, 250, front.y + front.height + 30)?.id === 'front', 'feet just below the window still sit when the body overlaps it')
assert(seatForDrop(windows, 250, front.y + front.height + 400) == null, 'feet far below the window do not sit')

console.log('window order ok')
