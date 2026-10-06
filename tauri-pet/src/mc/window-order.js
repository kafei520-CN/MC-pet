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
