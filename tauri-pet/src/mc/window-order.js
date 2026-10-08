export function coversPoint(win, x, y) {
  return Boolean(win)
    && x >= win.x
    && x <= win.x + win.width
    && y >= win.y
    && y <= win.y + win.height
}

// `windows` is front-to-back. Returns true when a nearer window contains the point.
export function frontCovers(windows, x, y, id) {
  for (const win of windows ?? []) {
    if (!win) {
      continue
    }
    if (id != null && win.id === id) {
      return false
    }
    if (coversPoint(win, x, y)) {
      return true
    }
  }
  return false
}

// Visible pieces of a window's top edge. A nearer window cuts the span it covers.
export function visibleTopSpans(win, windows) {
  if (!win) {
    return []
  }
  let spans = [[win.x, win.x + win.width]]
  const y = win.y
  for (const front of windows ?? []) {
    if (!front) {
      continue
    }
    if (front.id === win.id) {
      break
    }
    if (y < front.y || y > front.y + front.height) {
      continue
    }
    const cutL = front.x
    const cutR = front.x + front.width
    const next = []
    for (const [start, end] of spans) {
      if (cutR <= start || cutL >= end) {
        next.push([start, end])
        continue
      }
      if (start < cutL) {
        next.push([start, Math.min(end, cutL)])
      }
      if (end > cutR) {
        next.push([Math.max(start, cutR), end])
      }
    }
    spans = next
  }
  return spans.filter(([start, end]) => end - start > 4)
}

// Title bars on the screen's top edge are not seats. A few pixels covers the
// invisible window border that maximized windows report above y=0.
export const SCREEN_TOP_SEAT = 8
const TITLE_BAR = 32
// Screen y grows downward. A drop this far above the top, or this far into the
// client area under the title, still counts as sitting on that window.
export const SEAT_ABOVE = 36
export const SEAT_LIP = 80
// Upper rim only. Screen y grows downward, so this is the band under the top.
export const SEAT_EDGE = 40
// Feet follow the cursor. The body stands above them, so a drop anywhere from
// a body-height above the top through the bottom of the window is still a sit.
export const SEAT_REACH = 160

export function atScreenTop(win) {
  return Boolean(win) && win.y <= SCREEN_TOP_SEAT
}

// Front-to-back. The first window that owns the point is the only seat.
// A covered top returns null instead of a window behind it.
export function seatAt(windows, x, y, ignoreId) {
  const list = windows ?? []
  for (const win of list) {
    if (!win) {
      continue
    }
    const spans = visibleTopSpans(win, list)
    const onSpan = spans.some(([left, right]) => x >= left && x <= right)
    const onTitle = onSpan && y >= win.y - 4 && y <= win.y + TITLE_BAR
    const inside = coversPoint(win, x, y)
    if (!onTitle && !inside) {
      continue
    }
    if (atScreenTop(win)) {
      return null
    }
    if (ignoreId != null && win.id === ignoreId) {
      return null
    }
    if (!onTitle) {
      return null
    }
    return win
  }
  return null
}

// Drop-to-sit. Same ownership rules as seatAt, plus a band above the top and a
// lip just under the title. A point deeper in the client area stays put and
// does not fall through to a window behind.
export function seatDrop(windows, x, y, ignoreId) {
  const list = windows ?? []
  for (const win of list) {
    if (!win) {
      continue
    }
    const spans = visibleTopSpans(win, list)
    const onSpan = spans.some(([left, right]) => x >= left && x <= right)
    const onTitle = onSpan && y >= win.y - 4 && y <= win.y + TITLE_BAR
    const above = onSpan && y >= win.y - SEAT_ABOVE && y < win.y - 4
    const lip = onSpan && y > win.y + TITLE_BAR && y <= win.y + TITLE_BAR + SEAT_LIP
    const inside = coversPoint(win, x, y)
    if (!onTitle && !above && !lip && !inside) {
      continue
    }
    if (atScreenTop(win)) {
      return null
    }
    if (ignoreId != null && win.id === ignoreId) {
      return null
    }
    if (onTitle || above || lip) {
      return win
    }
    return null
  }
  return null
}

function seatEdgeAt(windows, x, y) {
  const list = windows ?? []
  for (const win of list) {
    if (!win) {
      continue
    }
    const spans = visibleTopSpans(win, list)
    const onSpan = spans.some(([left, right]) => x >= left && x <= right)
    const onEdge = onSpan && y >= win.y - SEAT_ABOVE && y <= win.y + SEAT_EDGE
    const inside = coversPoint(win, x, y)
    if (!onEdge && !inside) {
      continue
    }
    if (atScreenTop(win)) {
      return null
    }
    if (onEdge) {
      return win
    }
    return null
  }
  return null
}

// Cursor is above a window top (screen y grows downward). Used when the pet
// was dragged upward onto that window.
export function seatAbove(windows, x, y) {
  const list = windows ?? []
  let best = null
  let bestDy = Infinity
  for (const win of list) {
    if (!win || atScreenTop(win)) {
      continue
    }
    const spans = visibleTopSpans(win, list)
    if (!spans.some(([left, right]) => x >= left && x <= right)) {
      continue
    }
    const dy = win.y - y
    if (dy < -SEAT_ABOVE || dy > 220) {
      continue
    }
    if (dy < bestDy) {
      best = win
      bestDy = dy
    }
  }
  return best
}

// Drag into a window: the front window that contains the point, or its upper
// edge. Screen-top windows are not seats and do not pass through.
export function seatEntered(windows, x, y) {
  const list = windows ?? []
  for (const win of list) {
    if (!win) {
      continue
    }
    const spans = visibleTopSpans(win, list)
    const onSpan = spans.some(([left, right]) => x >= left && x <= right)
    const onEdge = onSpan && y >= win.y - SEAT_ABOVE && y <= win.y + SEAT_EDGE
    const inside = coversPoint(win, x, y)
    if (!onEdge && !inside) {
      continue
    }
    if (atScreenTop(win)) {
      return null
    }
    return win
  }
  return null
}

// The grab point is the neck. The doll hangs below it, so a rest on the upper
// edge is often under the cursor. Screen y grows downward.
const BODY_DROPS = [0, 48, 96, 128]

export function seatEdge(windows, x, y) {
  for (const drop of BODY_DROPS) {
    const seat = seatEdgeAt(windows, x, y + drop)
    if (seat) {
      return seat
    }
  }
  return null
}

// The pet is already standing on this window's top. Screen y grows downward.
export function feetWindow(windows, x, y) {
  const list = windows ?? []
  let best = null
  let bestDist = Infinity
  for (const win of list) {
    if (!win || atScreenTop(win)) {
      continue
    }
    const spans = visibleTopSpans(win, list)
    if (!spans.some(([left, right]) => x >= left - 20 && x <= right + 20)) {
      continue
    }
    const dy = y - win.y
    if (dy < -48 || dy > 80) {
      continue
    }
    const dist = Math.abs(dy)
    if (dist < bestDist) {
      best = win
      bestDist = dist
    }
  }
  return best
}

// Already on `home`, dragged downward toward its upper edge.
export function dragDownSeat(windows, home, x, y) {
  if (!home) {
    return null
  }
  const list = windows ?? []
  const win = list.find((item) => item && item.id === home.id) || home
  if (!win || atScreenTop(win)) {
    return null
  }
  if (x < win.x - 24 || x > win.x + win.width + 24) {
    return null
  }
  if (y < win.y - 160 || y > win.y + 140) {
    return null
  }
  for (const front of list) {
    if (!front) {
      continue
    }
    if (front.id === win.id) {
      break
    }
    if (coversPoint(front, x, y)) {
      return null
    }
  }
  return win
}

// Feet are on this window's visible top. Screen y grows downward.
export function standWindow(windows, x, y) {
  const list = windows ?? []
  for (const win of list) {
    if (!win || atScreenTop(win)) {
      continue
    }
    const spans = visibleTopSpans(win, list)
    const onSpan = spans.some(([left, right]) => x >= left && x <= right)
    if (!onSpan) {
      continue
    }
    const dy = y - win.y
    if (dy >= -24 && dy <= 48) {
      return win
    }
    if (coversPoint(win, x, y)) {
      return null
    }
  }
  return null
}

// Release-to-sit. x must lie on the visible top. y may be up to SEAT_REACH
// above that top, or anywhere down through the window. A covered top does not
// fall through to a window behind. Screen-top windows are not seats.
export function seatRelease(windows, x, y) {
  const list = windows ?? []
  for (const win of list) {
    if (!win) {
      continue
    }
    const spans = visibleTopSpans(win, list)
    const onSpan = spans.some(([left, right]) => x >= left && x <= right)
    const inReach = onSpan && y >= win.y - SEAT_REACH && y <= win.y + win.height
    const inside = coversPoint(win, x, y)
    if (!inReach && !inside) {
      continue
    }
    if (atScreenTop(win)) {
      return null
    }
    if (inReach) {
      return win
    }
    return null
  }
  return null
}

// Cursor is the feet. Also accept a window the body still overlaps when the
// feet have been pulled just below that window.
export function seatForDrop(windows, x, y) {
  const direct = seatRelease(windows, x, y)
  if (direct) {
    return direct
  }
  const list = windows ?? []
  if (list.some((win) => atScreenTop(win) && coversPoint(win, x, y))) {
    return null
  }
  for (const lift of [80, 160]) {
    const seat = seatRelease(list, x, y - lift)
    if (seat && y <= seat.y + seat.height + 48) {
      return seat
    }
  }
  return null
}

// Pulled downward from a window the pet was already standing on.
// The release can be above the title or inside that window.
export function seatPullDown(windows, homeId, x, y) {
  const list = windows ?? []
  const win = list.find((item) => item && item.id === homeId)
  if (!win || atScreenTop(win)) {
    return null
  }
  const spans = visibleTopSpans(win, list)
  const onSpan = spans.some(([left, right]) => x >= left && x <= right)
  if (!onSpan) {
    return null
  }
  if (y < win.y - 160 || y > win.y + win.height) {
    return null
  }
  for (const front of list) {
    if (!front) {
      continue
    }
    if (front.id === win.id) {
      break
    }
    if (coversPoint(front, x, y)) {
      return null
    }
  }
  return win
}

export function seatXOn(win, windows, x) {
  const spans = visibleTopSpans(win, windows).filter(([start, end]) => end - start > 16)
  if (!spans.length) {
    return null
  }
  let span = spans.find(([start, end]) => x >= start && x <= end)
  if (!span) {
    let bestDist = Infinity
    for (const item of spans) {
      const dist = Math.abs((item[0] + item[1]) / 2 - x)
      if (dist < bestDist) {
        bestDist = dist
        span = item
      }
    }
  }
  const inset = Math.min(18, (span[1] - span[0]) / 2)
  const min = span[0] + inset
  const max = Math.max(min, span[1] - inset)
  return Math.min(max, Math.max(min, x))
}
