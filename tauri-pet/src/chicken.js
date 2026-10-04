import * as THREE from 'three'
import { BedrockModel } from '@bedrock-viewer/model-viewer'

export async function createChicken() {
  const geometry = await loadJson('vanilla/chicken.geo.json')
  const animations = await loadJson('vanilla/chicken.animation.json')
  const model = await BedrockModel.load({
    geometry,
    geometryName: 'geometry.chicken.v1.12',
    texture: 'vanilla/chicken.png',
  })
  const clip = BedrockModel.loadAnimationClip(animations, 'animation.chicken.general')
  model.playAnimation(clip)
  const scale = 4
  model.object3D.scale.set(-scale, scale, scale)
  model.object3D.rotation.y = Math.PI
  model.object3D.position.set(2, 3, 0)
  const group = new THREE.Group()
  group.add(model.object3D)
  group.visible = false
  return { model, group, hand: new THREE.Vector3() }
}

export function flapChicken(chicken, delta, time) {
  if (!chicken?.group.visible) {
    return
  }
  const flap = Math.sin(time * 14) * 48
  for (const playback of chicken.model.animations.animations ?? []) {
    playback.env.variable.wing_flap = flap
  }
  chicken.model.update(delta)
}

export function holdChickenLeg(chicken, arm, rig) {
  if (!chicken?.group.visible) {
    return
  }
  arm.updateWorldMatrix(true, true)
  chicken.hand.set(0, -11, 2)
  arm.localToWorld(chicken.hand)
  rig.worldToLocal(chicken.hand)
  chicken.group.position.copy(chicken.hand)
  chicken.group.rotation.set(0, 0, 0)
}

async function loadJson(path) {
  const response = await fetch(path)
  if (!response.ok) {
    throw new Error(`${path} ${response.status}`)
  }
  const text = await response.text()
  return JSON.parse(text.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''))
}
