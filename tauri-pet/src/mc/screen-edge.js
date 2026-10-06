// Screen x grows to the right. D is +x, A is -x (same as steerControl).
// The doll never leaves the screen. Walking into a bezel starts a climb
// that faces the bezel: A at the left looks left, D at the right looks right.

const STAY = 8

export function resolveEdgeX(x, screenW) {
  const stayLeft = STAY
  const stayRight = Math.max(stayLeft, screenW - STAY)
  return Math.min(stayRight, Math.max(stayLeft, x))
}

export function rimClimbFace(side) {
  return side === 'left' ? -1 : 1
}

export function stepScreenRim(state) {
  const screenW = state.screenW
  const min = STAY
  const max = Math.max(min, screenW - STAY)
  const keys = state.keys ?? {}
  const left = Boolean(keys.a) && !keys.d
  const right = Boolean(keys.d) && !keys.a
  let x = resolveEdgeX(state.x, screenW)
  let climb = null
  if (x <= min + 2 && left) {
    x = min
    climb = 'left'
  } else if (x >= max - 2 && right) {
    x = max
    climb = 'right'
  }
  return { x, climb }
}
