import * as THREE from 'three'
import layers from './data/entity-layers-1.20.1.json'
import { entityCube } from './java-model.js'
import { walkPhase } from './anim-window.js'

const images = new Map()
const PIGLIN = new Set(['piglin', 'piglin_brute', 'zombified_piglin'])
const FISH = new Set(['cod', 'salmon', 'tropical_fish', 'pufferfish', 'tadpole'])
const FISH_SIDE = new Set(['cod', 'salmon', 'tropical_fish', 'pufferfish'])
const SKIP_PART = /baby_leg$|_saddle|saddle$|^head_saddle$|^mouth_saddle_wrap$|_chest$/

export function isFish(type) {
  return FISH.has(type)
}

export function hasJavaEntity(type) {
  return Boolean(layers.entities[type])
}

export async function createJavaEntity(type) {
  const spec = meshSpec(type)
  if (!spec) {
    return null
  }
  const image = await loadImage(`/resource-pack/minecraft/textures/${spec.texture}`)
  if (!image) {
    return null
  }
  const texture = new THREE.Texture(image)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.flipY = false
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  const material = new THREE.MeshLambertMaterial({ map: texture, side: THREE.DoubleSide, alphaTest: 0.1 })
  const root = new THREE.Group()
  root.name = type
  root.scale.set(-1, -1, 1)
  root.rotation.y = Math.PI
  root.position.y = 24.016
  const parts = new Map()
  for (const child of spec.root.children) {
    buildPart(root, child, spec, material, parts)
  }
  return {
    model: {
      kind: 'java',
      object3D: root,
      animate(moved, speed, life, extra = {}) {
        if (type === 'strider') {
          poseStrider(parts, moved, speed)
          return
        }
        if (FISH.has(type)) {
          poseFish(root, parts, type, life, extra.inWater)
          return
        }
        const swing = Math.sin(walkPhase(moved, speed)) * 1.4
        const opposite = -swing
        addRot(parts, 'right_leg', swing, 0)
        addRot(parts, 'left_leg', opposite, 0)
        addRot(parts, 'right_arm', opposite, 0)
        addRot(parts, 'left_arm', swing, 0)
        addRot(parts, 'right_hind_leg', swing, 0)
        addRot(parts, 'left_hind_leg', opposite, 0)
        addRot(parts, 'right_front_leg', opposite, 0)
        addRot(parts, 'left_front_leg', swing, 0)
        const wing = Math.sin(life * 14)
        addRot(parts, 'right_wing', 0, wing)
        addRot(parts, 'left_wing', 0, -wing)
      },
      dispose() {
        material.dispose()
        texture.dispose()
      },
    },
    preAnimation: [],
    hw: FISH.has(type) ? 0.25 : 0.45,
    hh: FISH.has(type) ? 0.35 : 1.4,
  }
}

function meshSpec(type) {
  const spec = layers.entities[type]
  if (!spec) {
    return null
  }
  if (!PIGLIN.has(type)) {
    return spec
  }
  const root = structuredClone(spec.root)
  root.children = root.children.filter((child) => child.name !== 'hat').map((child) => (
    child.name === 'head' ? piglinHead() : child
  ))
  return { ...spec, root }
}

function piglinHead() {
  return {
    name: 'head',
    pose: { x: 0, y: 0, z: 0, xr: 0, yr: 0, zr: 0 },
    cubes: [
      { u: 0, v: 0, x: -5, y: -8, z: -4, width: 10, height: 8, depth: 8, grow: [0, 0, 0], mirror: false },
      { u: 31, v: 1, x: -2, y: -4, z: -5, width: 4, height: 4, depth: 1, grow: [0, 0, 0], mirror: false },
      { u: 2, v: 4, x: 2, y: -2, z: -5, width: 1, height: 2, depth: 1, grow: [0, 0, 0], mirror: false },
      { u: 2, v: 0, x: -3, y: -2, z: -5, width: 1, height: 2, depth: 1, grow: [0, 0, 0], mirror: false },
    ],
    children: [
      {
        name: 'left_ear',
        pose: { x: 4.5, y: -6, z: 0, xr: 0, yr: 0, zr: -0.5235988 },
        cubes: [{ u: 51, v: 6, x: 0, y: 0, z: -2, width: 1, height: 5, depth: 4, grow: [0, 0, 0], mirror: false }],
        children: [],
      },
      {
        name: 'right_ear',
        pose: { x: -4.5, y: -6, z: 0, xr: 0, yr: 0, zr: 0.5235988 },
        cubes: [{ u: 39, v: 6, x: -1, y: 0, z: -2, width: 1, height: 5, depth: 4, grow: [0, 0, 0], mirror: false }],
        children: [],
      },
    ],
  }
}

function poseFish(root, parts, type, life, inWater) {
  const age = life * 20
  const land = !inWater
  let yawDeg = 4.3 * Math.sin(0.6 * age)
  if (type === 'salmon') {
    const amp = land ? 1.3 : 1
    const hz = land ? 1.7 : 1
    yawDeg = amp * 4.3 * Math.sin(hz * 0.6 * age)
  }
  root.rotation.y = Math.PI + yawDeg * Math.PI / 180
  if (land && FISH_SIDE.has(type)) {
    const tx = type === 'cod' ? 0.1 : 0.2
    const tz = type === 'cod' ? -0.1 : 0
    root.position.set(tx * 16, 2, tz * 16)
    root.rotation.z = Math.PI / 2
  } else {
    root.position.set(0, 24.016, 0)
    root.rotation.z = 0
  }
  const boost = land ? 1.5 : 1
  if (type === 'salmon') {
    const amp = land ? 1.3 : 1
    const hz = land ? 1.7 : 1
    addYaw(parts, 'body_back', -amp * 0.25 * Math.sin(hz * 0.6 * age))
  } else if (type === 'tadpole') {
    addYaw(parts, 'tail', -boost * 0.25 * Math.sin(0.3 * age))
  } else if (type === 'pufferfish') {
    addRot(parts, 'right_fin', 0, -0.2 + 0.4 * Math.sin(age * 0.2))
    addRot(parts, 'left_fin', 0, 0.2 - 0.4 * Math.sin(age * 0.2))
  } else {
    addYaw(parts, 'tail_fin', -boost * 0.45 * Math.sin(0.6 * age))
    addYaw(parts, 'tail', -boost * 0.45 * Math.sin(0.6 * age))
  }
}

function poseStrider(parts, moved, speed) {
  const t = moved * 1.5
  const amt = speed > 0.02 ? 0.25 : 0
  const left = Math.sin(t * 0.5) * 2 * amt
  const right = Math.sin(t * 0.5 + Math.PI) * 2 * amt
  addRot(parts, 'left_leg', left, 0.17453292 * Math.cos(t * 0.5) * amt)
  addRot(parts, 'right_leg', right, 0.17453292 * Math.cos(t * 0.5 + Math.PI) * amt)
  setY(parts, 'left_leg', 8 + 4 * Math.sin(t * 0.5 + Math.PI) * amt)
  setY(parts, 'right_leg', 8 + 4 * Math.sin(t * 0.5) * amt)
  setY(parts, 'body', 2 - 4 * Math.cos(t) * amt)
  addRot(parts, 'body', 0, 0.4 * Math.sin(t) * amt)
}

function buildPart(parent, part, spec, material, parts) {
  if (SKIP_PART.test(part.name)) {
    return
  }
  const group = new THREE.Group()
  group.name = part.name
  group.position.set(part.pose.x, part.pose.y, part.pose.z)
  group.rotation.order = 'ZYX'
  group.rotation.set(part.pose.xr, part.pose.yr, part.pose.zr)
  group.userData.base = { x: part.pose.xr, y: part.pose.yr, z: part.pose.zr }
  group.userData.baseY = part.pose.y
  for (const cube of part.cubes) {
    group.add(cubeMesh(cube, spec, material))
  }
  for (const child of part.children) {
    buildPart(group, child, spec, material, parts)
  }
  parts.set(part.name, group)
  parent.add(group)
}

function cubeMesh(cube, spec, material) {
  const baked = entityCube({
    ...cube,
    texWidth: spec.texWidth * (cube.texScale?.[0] ?? 1),
    texHeight: spec.texHeight * (cube.texScale?.[1] ?? 1),
  })
  const positions = []
  const uvs = []
  const indices = []
  for (const face of baked.faces) {
    const start = positions.length / 3
    for (const vertex of face.vertices) {
      positions.push(vertex.x, vertex.y, vertex.z)
      uvs.push(vertex.u, vertex.v)
    }
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return new THREE.Mesh(geometry, material)
}

function addRot(parts, name, x, z) {
  const part = parts.get(name)
  if (!part) {
    return
  }
  const base = part.userData.base
  part.rotation.x = base.x + x
  part.rotation.z = base.z + z
}

function setY(parts, name, y) {
  const part = parts.get(name)
  if (!part) {
    return
  }
  part.position.y = y
}

function addYaw(parts, name, y) {
  const part = parts.get(name)
  if (!part) {
    return
  }
  part.rotation.y = part.userData.base.y + y
}

function loadImage(url) {
  if (images.has(url)) {
    return images.get(url)
  }
  const pending = new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image.width > 0 ? image : null)
    image.onerror = () => resolve(null)
    image.src = url
  })
  images.set(url, pending)
  return pending
}
