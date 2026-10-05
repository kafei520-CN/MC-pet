// 1.20.1 client: BlockModel/BlockElement/BlockFaceUV, ModelPart.Cube, KeyframeAnimations.
// Entity geometry and keyframe clips are Java data in this version. The JSON reader is the block model reader.

const FACES = ['down', 'up', 'north', 'south', 'west', 'east']

export function readBlockModel(json) {
  const source = typeof json === 'string' ? JSON.parse(json) : json
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new Error('Expected a block model object')
  }
  return {
    parent: text(source.parent, ''),
    textures: readTextures(source.textures),
    ambientOcclusion: source.ambientocclusion == null ? null : bool(source.ambientocclusion, 'ambientocclusion'),
    guiLight: source.gui_light == null ? null : guiLight(source.gui_light),
    elements: source.elements ? source.elements.map(readElement) : [],
    display: source.display && typeof source.display === 'object' ? source.display : {},
  }
}

export function linkParent(model, parent) {
  return { ...model, parentModel: parent ?? null }
}

export function elementsOf(model) {
  if (model.elements.length === 0 && model.parentModel) {
    return elementsOf(model.parentModel)
  }
  return model.elements
}

export function textureOf(model, name) {
  let key = name.startsWith('#') ? name.slice(1) : name
  for (let hop = 0; hop < 16; hop += 1) {
    let value = null
    let current = model
    while (current) {
      if (current.textures && Object.prototype.hasOwnProperty.call(current.textures, key)) {
        value = current.textures[key]
        break
      }
      current = current.parentModel
    }
    if (value == null) {
      return 'minecraft:missingno'
    }
    if (!value.startsWith('#')) {
      return value
    }
    key = value.slice(1)
  }
  return 'minecraft:missingno'
}

export function missingFaceUv(from, to, face) {
  if (face === 'down') {
    return [from[0], 16 - to[2], to[0], 16 - from[2]]
  }
  if (face === 'up') {
    return [from[0], from[2], to[0], to[2]]
  }
  if (face === 'north') {
    return [16 - to[0], 16 - to[1], 16 - from[0], 16 - from[1]]
  }
  if (face === 'south') {
    return [from[0], 16 - to[1], to[0], 16 - from[1]]
  }
  if (face === 'west') {
    return [from[2], 16 - to[1], to[2], 16 - from[1]]
  }
  return [16 - to[2], 16 - to[1], 16 - from[2], 16 - from[1]]
}

export function faceCorner(uv, rotation, index) {
  const shifted = (index + rotation / 90) % 4
  const u = shifted === 0 || shifted === 1 ? uv[0] : uv[2]
  const v = shifted === 0 || shifted === 3 ? uv[1] : uv[3]
  return [u, v]
}

export function entityCube(cube) {
  const texU = cube.u ?? 0
  const texV = cube.v ?? 0
  const width = cube.width
  const height = cube.height
  const depth = cube.depth
  const grow = cube.grow ?? [0, 0, 0]
  const mirror = Boolean(cube.mirror)
  const texWidth = cube.texWidth ?? 64
  const texHeight = cube.texHeight ?? 32
  const show = new Set(cube.faces ?? FACES)
  let x0 = cube.x
  let y0 = cube.y
  let z0 = cube.z
  let x1 = x0 + width
  let y1 = y0 + height
  let z1 = z0 + depth
  x0 -= grow[0]
  y0 -= grow[1]
  z0 -= grow[2]
  x1 += grow[0]
  y1 += grow[1]
  z1 += grow[2]
  if (mirror) {
    const swap = x1
    x1 = x0
    x0 = swap
  }
  const u0 = texU
  const u1 = texU + depth
  const u2 = texU + depth + width
  const u3 = texU + depth + width + width
  const u4 = texU + depth + width + depth
  const u5 = texU + depth + width + depth + width
  const v0 = texV
  const v1 = texV + depth
  const v2 = texV + depth + height
  const corner = (x, y, z) => ({ x, y, z })
  const p0 = corner(x0, y0, z0)
  const p1 = corner(x1, y0, z0)
  const p2 = corner(x1, y1, z0)
  const p3 = corner(x0, y1, z0)
  const p4 = corner(x0, y0, z1)
  const p5 = corner(x1, y0, z1)
  const p6 = corner(x1, y1, z1)
  const p7 = corner(x0, y1, z1)
  const faces = []
  const add = (face, points, uStart, vStart, uEnd, vEnd) => {
    if (!show.has(face)) {
      return
    }
    const verts = points.map((point) => ({ ...point }))
    verts[0].u = uEnd / texWidth
    verts[0].v = vStart / texHeight
    verts[1].u = uStart / texWidth
    verts[1].v = vStart / texHeight
    verts[2].u = uStart / texWidth
    verts[2].v = vEnd / texHeight
    verts[3].u = uEnd / texWidth
    verts[3].v = vEnd / texHeight
    if (mirror) {
      verts.reverse()
    }
    faces.push({ face, mirror, vertices: verts })
  }
  add('down', [p5, p4, p0, p1], u1, v0, u2, v1)
  add('up', [p2, p3, p7, p6], u2, v1, u3, v0)
  add('west', [p0, p4, p7, p3], u0, v1, u1, v2)
  add('north', [p1, p0, p3, p2], u1, v1, u2, v2)
  add('east', [p5, p1, p2, p6], u2, v1, u4, v2)
  add('south', [p4, p5, p6, p7], u4, v1, u5, v2)
  return {
    min: [Math.min(x0, x1), y0, z0],
    max: [Math.max(x0, x1), y1, z1],
    faces,
  }
}

export function posVec(x, y, z) {
  return [x, -y, z]
}

export function degreeVec(x, y, z) {
  const rad = Math.PI / 180
  return [x * rad, y * rad, z * rad]
}

export function scaleVec(x, y, z) {
  return [x - 1, y - 1, z - 1]
}

export function animationSeconds(definition, millis) {
  const seconds = millis / 1000
  return definition.loop ? seconds % definition.length : seconds
}

export function sampleAnimation(definition, seconds, scale = 1) {
  const time = definition.loop ? seconds % definition.length : seconds
  const pose = {}
  for (const [bone, channels] of Object.entries(definition.bones ?? {})) {
    const acc = { position: [0, 0, 0], rotation: [0, 0, 0], scale: [0, 0, 0] }
    for (const channel of channels) {
      const frames = channel.keyframes ?? []
      if (frames.length === 0) {
        continue
      }
      const found = upperBound(frames, time)
      const left = Math.max(0, found - 1)
      const right = Math.min(frames.length - 1, left + 1)
      const a = frames[left]
      const b = frames[right]
      const span = b.time - a.time
      const t = right === left || span === 0 ? 0 : clamp( (time - a.time) / span, 0, 1)
      const mode = b.interpolation ?? channel.interpolation ?? 'linear'
      const delta = mode === 'catmullrom'
        ? catmull(frames, left, right, t)
        : lerpVec(frameVec(a), frameVec(b), t)
      const target = channel.target
      acc[target] = addVec(acc[target], scaleVec3(delta, scale))
    }
    pose[bone] = acc
  }
  return pose
}

function readTextures(textures) {
  const map = {}
  if (!textures || typeof textures !== 'object') {
    return map
  }
  for (const [key, value] of Object.entries(textures)) {
    if (typeof value !== 'string') {
      throw new Error(`Texture ${key} must be a string`)
    }
    map[key] = value
  }
  return map
}

function readElement(element) {
  const from = vec3(element.from, 'from')
  const to = vec3(element.to, 'to')
  checkExtent(from, 'from')
  checkExtent(to, 'to')
  const faces = {}
  const rawFaces = element.faces
  if (!rawFaces || typeof rawFaces !== 'object') {
    throw new Error('Expected faces')
  }
  for (const [name, face] of Object.entries(rawFaces)) {
    if (!FACES.includes(name)) {
      throw new Error(`Unknown facing: ${name}`)
    }
    const rotation = face.rotation ?? 0
    if (rotation < 0 || rotation % 90 !== 0 || rotation / 90 > 3) {
      throw new Error(`Invalid rotation ${rotation} found, only 0/90/180/270 allowed`)
    }
    faces[name] = {
      texture: String(face.texture ?? ''),
      cullface: face.cullface ?? null,
      tintindex: face.tintindex ?? -1,
      rotation,
      uv: face.uv ? uv4(face.uv) : missingFaceUv(from, to, name),
    }
  }
  if (Object.keys(faces).length === 0) {
    throw new Error('Expected between 1 and 6 unique faces, got 0')
  }
  return {
    from,
    to,
    shade: element.shade == null ? true : bool(element.shade, 'shade'),
    rotation: readRotation(element.rotation),
    faces,
  }
}

function readRotation(rotation) {
  if (!rotation) {
    return null
  }
  const angle = Number(rotation.angle)
  const abs = Math.abs(angle)
  if (angle !== 0 && abs !== 22.5 && abs !== 45) {
    throw new Error(`Invalid rotation ${angle} found, only -45/-22.5/0/22.5/45 allowed`)
  }
  const axis = String(rotation.axis ?? '').toLowerCase()
  if (axis !== 'x' && axis !== 'y' && axis !== 'z') {
    throw new Error(`Invalid rotation axis: ${rotation.axis}`)
  }
  const origin = vec3(rotation.origin, 'origin').map((value) => value * 0.0625)
  return { origin, axis, angle, rescale: Boolean(rotation.rescale) }
}

function frameVec(frame) {
  return [frame.x ?? 0, frame.y ?? 0, frame.z ?? 0]
}

function upperBound(frames, time) {
  let low = 0
  let high = frames.length
  while (low < high) {
    const mid = (low + high) >> 1
    if (time <= frames[mid].time) {
      high = mid
    } else {
      low = mid + 1
    }
  }
  return low
}

function catmull(frames, left, right, t) {
  const p0 = frameVec(frames[Math.max(0, left - 1)])
  const p1 = frameVec(frames[left])
  const p2 = frameVec(frames[right])
  const p3 = frameVec(frames[Math.min(frames.length - 1, right + 1)])
  return [0, 1, 2].map((axis) => catmullComponent(t, p0[axis], p1[axis], p2[axis], p3[axis]))
}

function catmullComponent(t, p0, p1, p2, p3) {
  return 0.5 * (
    2 * p1
    + (p2 - p0) * t
    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
    + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t
  )
}

function lerpVec(a, b, t) {
  return a.map((value, index) => value + (b[index] - value) * t)
}

function addVec(a, b) {
  return a.map((value, index) => value + b[index])
}

function scaleVec3(value, scale) {
  return value.map((part) => part * scale)
}

function vec3(value, name) {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new Error(`Expected 3 ${name} values, found: ${value?.length ?? 0}`)
  }
  return value.map((part, index) => {
    const number = Number(part)
    if (!Number.isFinite(number)) {
      throw new Error(`${name}[${index}] is not a number`)
    }
    return number
  })
}

function uv4(value) {
  if (!Array.isArray(value) || value.length !== 4) {
    throw new Error(`Expected 4 uv values, found: ${value?.length ?? 0}`)
  }
  return value.map((part, index) => {
    const number = Number(part)
    if (!Number.isFinite(number)) {
      throw new Error(`uv[${index}] is not a number`)
    }
    return number
  })
}

function checkExtent(value, name) {
  if (value.some((part) => part < -16 || part > 32)) {
    throw new Error(`'${name}' specifier exceeds the allowed boundaries`)
  }
}

function bool(value, name) {
  if (typeof value !== 'boolean') {
    throw new Error(`Expected ${name} to be a Boolean`)
  }
  return value
}

function text(value, fallback) {
  return value == null ? fallback : String(value)
}

function guiLight(value) {
  if (value === 'front' || value === 'side') {
    return value
  }
  throw new Error(`Invalid gui light: ${value}`)
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}
