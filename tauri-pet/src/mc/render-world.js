import { createScene, poseSpecial } from 'block-model-renderer'
import { getAssets, MC_VERSION, PLAINS } from './assets.js'
import { isChest } from './ids.js'

const GROUND_SHADE = 0.78

export async function rebuildWorld(root, blocks, previous) {
  previous?.dispose?.()
  if (!blocks.length) {
    return null
  }
  const assets = await getAssets()
  const ground = await buildLayer(assets, blocks.filter((block) => block.y === 0), GROUND_SHADE)
  const upper = await buildLayer(assets, blocks.filter((block) => block.y !== 0), 1)
  const handles = [ground, upper].filter(Boolean)
  if (!handles.length) {
    return null
  }
  for (const handle of handles) {
    root.add(handle.group)
    applySpecialPoses(handle.group, blocks)
  }
  return {
    group: root,
    dispose() {
      for (const handle of handles) {
        root.remove(handle.group)
        handle.dispose?.()
      }
    },
    sortTranslucent(camera) {
      for (const handle of handles) {
        handle.sortTranslucent?.(camera)
      }
    },
  }
}

async function buildLayer(assets, blocks, shade) {
  if (!blocks.length) {
    return null
  }
  const entries = blocks.map((block) => ({
    id: block.id,
    properties: block.properties ?? {},
    pos: [block.x, block.y, block.z ?? 0],
    nbt: block.nbt,
    biome: PLAINS,
  }))
  const handle = await createScene(assets, entries, {
    biome: PLAINS,
    lighting: 'scene',
    animate: true,
    optimize: true,
    defaults: 'game',
    version: MC_VERSION,
    randomOffset: true,
  })
  if (!handle) {
    return null
  }
  if (shade < 1) {
    darken(handle.group, shade)
  }
  return handle
}

function darken(group, amount) {
  group.traverse((node) => {
    if (!node.material) {
      return
    }
    const list = Array.isArray(node.material) ? node.material : [node.material]
    const copies = list.map((material) => {
      const copy = material.clone()
      if (copy.color) {
        copy.color.multiplyScalar(amount)
      }
      return copy
    })
    node.material = Array.isArray(node.material) ? copies : copies[0]
  })
}

function applySpecialPoses(group, blocks) {
  const open = blocks.some((block) => isChest(block.id) && (block.nbt?.open || String(block.properties?.open) === 'true'))
  if (!open) {
    return
  }
  group.traverse((node) => {
    const dynamic = node.userData?.dynamic
    if (!dynamic) {
      return
    }
    const kind = typeof dynamic === 'string' ? dynamic : dynamic.kind
    if (kind !== 'chest' && kind !== 'shulker_box') {
      return
    }
    poseSpecial(node, { openness: 1 })
    if (typeof dynamic.open === 'function') {
      dynamic.open()
    }
  })
}
