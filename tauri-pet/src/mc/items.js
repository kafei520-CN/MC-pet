import * as THREE from 'three'
import { loadModel, parseBlockstate, parseItemDefinition, resolveModelData } from 'block-model-renderer'
import { getAssets, itemExists, MC_VERSION, PLAINS } from './assets.js'
import { bareId } from './ids.js'

function createGrip(arm, side) {
  const grip = new THREE.Group()
  grip.name = side === 'left' ? 'leftItem' : 'rightItem'
  const outward = side === 'left' ? 1 : -1
  grip.position.set(outward * 0.5, -7, 2)
  grip.rotation.order = 'XYZ'
  grip.rotation.x = Math.PI / 2
  arm.add(grip)
  return grip
}

export function createHandHolders(bones) {
  return {
    right: createGrip(bones.rightArm, 'right'),
    left: createGrip(bones.leftArm, 'left'),
  }
}

function clearHolder(holder) {
  while (holder.children.length) {
    const child = holder.children[0]
    holder.remove(child)
    child.traverse?.((node) => {
      node.geometry?.dispose?.()
      if (node.material) {
        const mats = Array.isArray(node.material) ? node.material : [node.material]
        for (const mat of mats) {
          mat.dispose?.()
        }
      }
    })
  }
}

export async function setHeldItem(holder, id, components, hand) {
  clearHolder(holder)
  if (!id) {
    return { ok: true, id: null }
  }
  const name = bareId(id)
  const exists = await itemExists(name)
  if (!exists) {
    return { ok: false, error: `unknown item ${name}` }
  }
  const assets = await getAssets()
  const display = hand === 'left' ? 'thirdperson_lefthand' : 'thirdperson_righthand'
  let refs
  try {
    if (name === 'grass_block') {
      refs = await parseBlockstate(assets, name, {
        biome: PLAINS,
        version: MC_VERSION,
        defaults: 'game',
      })
    } else {
      refs = await parseItemDefinition(assets, name, {
        data: components ?? {},
        display,
        version: MC_VERSION,
      })
    }
  } catch {
    refs = [{ type: 'item', model: `minecraft:item/${name}` }]
  }
  const models = refs.length ? refs : [{ type: 'item', model: `minecraft:item/${name}` }]
  const group = new THREE.Group()
  for (const ref of models) {
    const resolved = await resolveModelData(assets, ref)
    const part = await loadModel(null, assets, resolved, {
      display,
      lighting: 'item',
      animate: true,
      version: MC_VERSION,
      biome: PLAINS,
    })
    group.add(part)
  }
  if (name === 'grass_block') {
    group.scale.setScalar(0.375)
  }
  holder.add(group)
  return { ok: true, id: name, components: components ?? {} }
}
