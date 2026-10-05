import * as THREE from 'three'
import { createHotbar, STARTER_ITEMS } from '../src/mc/hotbar.js'
import { swapArmRotation } from '../src/mc/swap-arm.js'

function assert(cond, message) {
  if (!cond) {
    throw new Error(message)
  }
}

const bar = createHotbar()
assert(bar.state().slots.join() === STARTER_ITEMS.join(), 'starter slots')
assert(bar.state().selected === 0, 'starter selected')

let change = bar.commit('dirt')
assert(change.direction === 1 && change.distance === 1 && change.selected === 1, 'switch to dirt')
change = bar.commit('dirt')
assert(change.direction === 0 && change.selected === 1, 'stay on dirt')
change = bar.commit('poppy')
assert(change.replaced === true && bar.state().slots[1] === 'poppy', 'replace current slot')
change = bar.commit('grass_block')
assert(change.direction === -1 && change.selected === 0, 'switch back left')

const saved = createHotbar()
saved.read({ selected: 4, slots: ['stone', 'dirt', 'oak_log', 'glass', 'torch', null, null, null, null] })
assert(saved.state().selected === 4 && saved.state().slots[4] === 'torch', 'load save')
saved.read(null, 'oak_planks')
assert(saved.state().selected === 3 && saved.state().slots[3] === 'oak_planks', 'seed selects held item')
saved.read({ selected: 9, slots: ['a'] }, 'dirt')
assert(saved.state().slots[1] === 'dirt' && saved.state().selected === 1, 'bad save reseeds')

function worldArm(yaw, direction, u) {
  const rot = swapArmRotation(yaw, direction, u)
  const local = new THREE.Vector3(0, -1, 0)
  local.applyEuler(new THREE.Euler(rot.x, rot.y, rot.z, 'XYZ'))
  local.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
  return local
}

for (const yaw of [0, Math.PI / 2, -Math.PI / 2]) {
  for (const direction of [1, -1]) {
    const mid = worldArm(yaw, direction, 0.55)
    const raised = mid.y > 0.45
    const signed = mid.x * direction > 0.15
    if (!raised || !signed) {
      throw new Error(`swipe yaw=${yaw.toFixed(2)} dir=${direction} arm=${mid.x.toFixed(2)},${mid.y.toFixed(2)},${mid.z.toFixed(2)}`)
    }
  }
}

const down = worldArm(0, 1, 0)
assert(down.y < 0.2, 'swipe starts low')
console.log('hotbar checks ok')
