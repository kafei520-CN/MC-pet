export const SCALE = 4.5
export const SKIN_HEIGHT = 32
export const PLAYER_METERS = 1.8
export const BLOCK_PX = (SKIN_HEIGHT * SCALE) / PLAYER_METERS
export const MODEL_UNITS = 16
export const WORLD_SCALE = BLOCK_PX / MODEL_UNITS

export const PLAYER_WIDTH = 0.6
export const PLAYER_HEIGHT = 1.8

export function workSize() {
  return { width: window.innerWidth, height: window.innerHeight }
}

export function gridSize() {
  const { width, height } = workSize()
  return {
    cols: Math.floor(width / BLOCK_PX),
    rows: Math.floor(height / BLOCK_PX),
    width,
    height,
  }
}

export function screenToWorld(sx, sy) {
  const { height } = workSize()
  return {
    x: sx / BLOCK_PX,
    y: (height - sy) / BLOCK_PX,
  }
}

export function worldToScreen(wx, wy) {
  const { height } = workSize()
  return {
    x: wx * BLOCK_PX,
    y: height - wy * BLOCK_PX,
  }
}

export function layoutWorldRoot(root) {
  const { height } = workSize()
  root.scale.set(WORLD_SCALE, WORLD_SCALE, WORLD_SCALE)
  root.position.set(BLOCK_PX / 2, -height + BLOCK_PX / 2, 0)
}
