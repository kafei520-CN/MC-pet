function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function clamp01(value) {
  return clamp(value, 0, 1)
}

function smooth(value) {
  const t = clamp01(value)
  return t * t * (3 - 2 * t)
}

// Left-arm Euler order is Z then X. Positive Z swings toward the character's left.
function armAngles(localX, localY, localZ) {
  const len = Math.hypot(localX, localY, localZ) || 1
  const nx = clamp(localX / len, -1, 1)
  const ny = localY / len
  const nz = localZ / len
  return {
    x: Math.atan2(-nz, -ny),
    y: 0,
    z: Math.asin(nx),
  }
}

export function swapArmRotation(yaw, direction, u) {
  const liftIn = clamp01(u / 0.18)
  const liftOut = u > 0.8 ? clamp01((u - 0.8) / 0.2) : 0
  const lift = liftIn * (1 - liftOut)
  const across = smooth((u - 0.14) / 0.62)
  const slide = direction * (-0.28 + 1.2 * across)
  const wx = slide * lift
  const wy = -0.55 + 1.75 * lift
  const wz = 0.38 * lift
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  return armAngles(
    wx * cos - wz * sin,
    wy,
    wx * sin + wz * cos,
  )
}

export function applySwapArm(bone, yaw, direction, u) {
  const rot = swapArmRotation(yaw, direction, u)
  bone.rotation.x = rot.x
  bone.rotation.y = rot.y
  bone.rotation.z = rot.z
}
