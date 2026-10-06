// Full clip is a progress bar. The midline is rest (passing pose).
// A window expands equally from that midline. Its length is proportional
// to speed. WALK_MAX is a full run stride; current walk 1.4 only uses a
// short center slice so the legs stay in a walk, not a high kick.
// The slice ping-pongs so the ends of the window do not snap.

export const WALK_PERIOD = (Math.PI * 2) / 0.8
export const WALK_MAX = 8

export function walkSpeed(vx) {
  return Math.min(1, Math.abs(Number(vx) || 0) / WALK_MAX)
}

export function animWindow(speed) {
  return Math.min(1, Math.max(0, Number(speed) || 0))
}

export function walkLoop(moved) {
  const u = (Number(moved) || 0) / WALK_PERIOD
  return u - Math.floor(u)
}

export function pingPong(u) {
  const x = u - Math.floor(u)
  return x < 0.5 ? x * 2 : 2 - x * 2
}

export function walkClipTime(moved, speed, length = 1) {
  const span = animWindow(speed) * length
  const mid = length * 0.5
  if (span <= 1e-6) {
    return mid
  }
  return mid - span * 0.5 + pingPong(walkLoop(moved)) * span
}

export function walkPhase(moved, speed) {
  return (walkClipTime(moved, speed, 1) - 0.5) * Math.PI * 2
}

export function walkDistance(moved, speed) {
  return (walkPhase(moved, speed) - Math.PI / 2) / 0.6662
}
