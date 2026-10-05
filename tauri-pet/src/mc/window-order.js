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
