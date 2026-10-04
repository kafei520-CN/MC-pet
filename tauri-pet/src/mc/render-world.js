import { createScene, poseSpecial } from 'block-model-renderer'
import { getAssets, MC_VERSION, PLAINS } from './assets.js'
import { isChest } from './ids.js'

export async function rebuildWorld(root, blocks, previous) {
  previous?.dispose?.()
  if (!blocks.length) {
    return null
  }
  const assets = await getAssets()
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
  root.add(handle.group)
  applySpecialPoses(handle.group, blocks)
  return handle
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
