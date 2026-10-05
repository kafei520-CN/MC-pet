import * as THREE from 'three'
import layers from './data/entity-layers-1.20.1.json'
import { entityCube } from './java-model.js'

const images = new Map()

export function hasJavaEntity(type) {
  return Boolean(layers.entities[type])
}

export async function createJavaEntity(type) {
  const spec = layers.entities[type]
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
      animate(moved, speed, life) {
        const swing = Math.cos(moved * 0.6662) * 1.4 * speed
        const opposite = Math.cos(moved * 0.6662 + Math.PI) * 1.4 * speed
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
    hw: 0.45,
    hh: 1.4,
  }
}

function buildPart(parent, part, spec, material, parts) {
  const group = new THREE.Group()
  group.name = part.name
  group.position.set(part.pose.x, part.pose.y, part.pose.z)
  group.rotation.order = 'ZYX'
  group.rotation.set(part.pose.xr, part.pose.yr, part.pose.zr)
  group.userData.base = { x: part.pose.xr, y: part.pose.yr, z: part.pose.zr }
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
