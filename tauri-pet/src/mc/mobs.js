import * as THREE from 'three'
import { overlap, worldBoxes } from './collision.js'
import { findPath } from './pathfind.js'
import { applyEntityMolang, createEntityModel } from './bedrock-pack.js'
import { createJavaEntity, isFish } from './java-entity.js'
import { isFluid } from './ids.js'
import { walkDistance, walkSpeed } from './anim-window.js'
import { eggType, isSpawnEgg } from './spawn-egg.js'

function solidsNear(getBlock, x, y, extra = []) {
  const boxes = []
  for (let gx = Math.floor(x - 1); gx <= Math.floor(x + 1); gx += 1) {
    for (let gy = Math.floor(y - 1); gy <= Math.floor(y + 2); gy += 1) {
      boxes.push(...worldBoxes(getBlock(gx, gy), gx, gy))
    }
  }
  return boxes.concat(extra)
}

const HEAD_FOLLOW = 0.62

function wrapAngle(value) {
  let angle = value
  while (angle > Math.PI) {
    angle -= Math.PI * 2
  }
  while (angle < -Math.PI) {
    angle += Math.PI * 2
  }
  return angle
}

function findHead(root) {
  if (!root) {
    return null
  }
  return root.getObjectByName('head')
    || root.getObjectByName('Head')
    || root.getObjectByName('head2')
}

function bindHead(mob) {
  if (mob.head) {
    return mob.head
  }
  const head = findHead(mob.model?.object3D)
  if (!head) {
    return null
  }
  if (!head.userData.base) {
    head.userData.base = {
      x: head.rotation.x,
      y: head.rotation.y,
      z: head.rotation.z,
    }
  }
  mob.head = head
  return head
}

function inWaterAt(getBlock, x, y) {
  const block = getBlock(Math.floor(x), Math.floor(y))
  const id = block?.id
  return Boolean(id && isFluid(id) && !String(id).includes('lava'))
}

function lookAround(mob, dt) {
  if (isFish(mob.type)) {
    return
  }
  const walking = Math.abs(mob.vx) > 0.08
  const blend = Math.min(1, dt * (walking ? 8 : 3.2))
  if (walking) {
    const target = mob.vx > 0 ? Math.PI / 2 : -Math.PI / 2
    mob.bodyYaw = wrapAngle(mob.bodyYaw + wrapAngle(target - mob.bodyYaw) * Math.min(1, dt * 8))
    mob.headYaw += (0 - mob.headYaw) * blend
    mob.headPitch += (0 - mob.headPitch) * blend
    mob.gazeWait = 0.4 + Math.random() * 0.5
    return
  }
  mob.gazeWait -= dt
  if (mob.gazeWait <= 0) {
    const wide = Math.random() < 0.38
    mob.gazeYaw = (Math.random() * 2 - 1) * (wide ? 1.5 : 0.72)
    mob.gazePitch = Math.random() * 0.7 - 0.28
    mob.gazeWait = 0.85 + Math.random() * 2.4
  }
  mob.headYaw += (mob.gazeYaw - mob.headYaw) * blend
  mob.headPitch += (mob.gazePitch - mob.headPitch) * blend
  if (mob.headYaw > HEAD_FOLLOW) {
    mob.bodyYaw += mob.headYaw - HEAD_FOLLOW
    mob.headYaw = HEAD_FOLLOW
  } else if (mob.headYaw < -HEAD_FOLLOW) {
    mob.bodyYaw += mob.headYaw + HEAD_FOLLOW
    mob.headYaw = -HEAD_FOLLOW
  }
  if (Math.abs(mob.gazeYaw) < 0.3) {
    mob.bodyYaw += (0 - mob.bodyYaw) * Math.min(1, dt * 1.5)
  }
  mob.bodyYaw = wrapAngle(mob.bodyYaw)
}

function applyHead(mob) {
  const head = bindHead(mob)
  if (!head) {
    return
  }
  const base = head.userData.base
  head.rotation.x = base.x + mob.headPitch
  head.rotation.y = base.y + mob.headYaw
}

function pose(mob) {
  if (!mob.view) {
    return
  }
  mob.view.position.set(mob.x * 16 - 8, mob.y * 16 - 8, 8)
  mob.view.rotation.y = mob.bodyYaw
  if (mob.model?.kind !== 'java' && isFish(mob.type) && !mob.inWater && mob.type !== 'tadpole') {
    mob.view.rotation.z = Math.PI / 2
  } else if (mob.model?.kind !== 'java') {
    mob.view.rotation.z = 0
  }
  applyHead(mob)
}

function pickGoal(mob, supportAt) {
  const dir = Math.random() < 0.5 ? -1 : 1
  const span = 4 + Math.random() * 10
  const goalX = mob.x + dir * span
  const stand = supportAt(goalX, mob.y + 1.3, mob.hw)
  return { x: goalX, y: stand }
}

function followPath(mob, dt) {
  const path = mob.path
  if (!path || mob.pi >= path.length) {
    mob.vx = 0
    mob.path = null
    return false
  }
  const node = path[mob.pi]
  const dx = node.x - mob.x
  const dy = node.y - mob.y
  if (Math.abs(dx) < 0.22 && Math.abs(dy) < 0.35) {
    mob.pi += 1
    if (mob.pi >= path.length) {
      mob.vx = 0
      mob.path = null
      return false
    }
    return true
  }
  mob.facing = dx >= 0 ? 1 : -1
  mob.vx = mob.facing * 1.4
  if ((node.jump || dy > 0.55) && mob.vy === 0) {
    mob.vy = 9
  }
  return true
}

function fieldSolids(getBlock, x, y, extra) {
  const boxes = extra ? extra.slice() : []
  const minX = Math.floor(x - 24)
  const maxX = Math.floor(x + 24)
  const maxY = Math.max(4, Math.floor(y + 8))
  for (let gx = minX; gx <= maxX; gx += 1) {
    for (let gy = 0; gy <= maxY; gy += 1) {
      const block = getBlock(gx, gy)
      if (block) {
        boxes.push(...worldBoxes(block, gx, gy))
      }
    }
  }
  return boxes
}

function steerMob(mob, dt, getBlock, extras, helpers) {
  if (mob.vy !== 0 && mob.path) {
    followPath(mob, dt)
    return
  }
  if (followPath(mob, dt)) {
    return
  }
  if (mob.idleWait > 0) {
    mob.idleWait -= dt
    mob.vx = 0
    if (mob.idleWait <= 0) {
      const goal = pickGoal(mob, helpers.supportAt)
      const solids = fieldSolids(getBlock, mob.x, mob.y, extras)
      const path = findPath({
        startX: mob.x,
        startY: mob.y,
        goalX: goal.x,
        goalY: goal.y,
        hw: mob.hw,
        hh: mob.hh,
        solids,
        supportAt: (wx, fromY) => helpers.supportAt(wx, fromY, mob.hw),
      })
      if (path && path.length > 1) {
        mob.path = path
        mob.pi = 1
        followPath(mob, dt)
      } else {
        let routed = false
        for (let n = 0; n < 3 && !routed; n += 1) {
          const retry = pickGoal(mob, helpers.supportAt)
          const again = findPath({
            startX: mob.x,
            startY: mob.y,
            goalX: retry.x,
            goalY: retry.y,
            hw: mob.hw,
            hh: mob.hh,
            solids,
            supportAt: (wx, fromY) => helpers.supportAt(wx, fromY, mob.hw),
          })
          if (again && again.length > 1) {
            mob.path = again
            mob.pi = 1
            followPath(mob, dt)
            routed = true
          }
        }
        if (!routed) {
          mob.vx = 0
          mob.idleWait = 1.2 + Math.random() * 2
        }
      }
    }
    return
  }
  mob.walkWait -= dt
  if (mob.walkWait <= 0) {
    mob.vx = 0
    mob.path = null
    mob.idleWait = 1.4 + Math.random() * 3.5
    mob.walkWait = 2.4 + Math.random() * 5
  }
}

function syncAnim(mob, dt) {
  if (!mob.model) {
    return
  }
  mob.life += dt
  mob.moved += Math.abs(mob.vx) * dt
  lookAround(mob, dt)
  const speed = mob.vy === 0 ? walkSpeed(mob.vx) : 0
  if (mob.model.kind === 'java') {
    mob.model.animate(mob.moved, speed, mob.life, { inWater: mob.inWater })
    pose(mob)
    return
  }
  applyEntityMolang(mob.model, mob.pre, {
    modified_distance_moved: walkDistance(mob.moved, speed),
    modified_move_speed: speed > 0.02 ? 1 : 0,
    ground_speed: Math.abs(mob.vx),
    is_on_ground: mob.vy === 0 && !mob.inWater ? 1 : 0,
    swell_amount: 0,
    is_baby: 0,
    is_in_water: mob.inWater ? 1 : 0,
    is_on_fire: 0,
    is_sitting: 0,
    is_dancing: 0,
    is_riding: 0,
    is_jumping: 0,
    is_charging: 0,
    is_grazing: 0,
    is_standing: 1,
    is_powered: 0,
    variant: 0,
    time_stamp: 0,
    frame_alpha: 0,
    target_x_rotation: 0,
    target_y_rotation: 0,
    wing_flap_position: mob.life,
  }, {
    gliding_speed_value: 1,
    stand_anim: 0,
    wing_flap: Math.sin(mob.life * 14) * 48,
  })
  mob.model.update(dt)
  pose(mob)
}

export function createMobs(root) {
  const mobs = []
  const group = new THREE.Group()
  group.name = 'mobs'
  root.add(group)
  let next = 1

  function drop(mob) {
    if (mob.view) {
      group.remove(mob.view)
    }
    mob.model?.dispose?.()
    mob.view = null
    mob.model = null
  }

  async function attach(mob) {
    let built
    try {
      built = await createJavaEntity(mob.type)
      if (!built) {
        built = await createEntityModel(mob.type)
      }
    } catch (error) {
      console.error(error)
      return
    }
    if (!built || !mobs.includes(mob)) {
      built?.model?.dispose?.()
      return
    }
    const view = new THREE.Group()
    view.name = mob.type
    view.add(built.model.object3D)
    group.add(view)
    mob.view = view
    mob.model = built.model
    mob.pre = built.preAnimation
    mob.hw = built.hw
    mob.hh = built.hh
    pose(mob)
  }

  function makeMob(type, x, y) {
    const facing = Math.random() < 0.5 ? -1 : 1
    const mob = {
      nid: next,
      type,
      x,
      y,
      facing,
      vx: facing * 1.4,
      vy: 0,
      hw: 0.3,
      hh: 0.9,
      moved: 0,
      life: Math.random() * 10,
      pre: [],
      bodyYaw: 0,
      headYaw: 0,
      headPitch: 0,
      gazeYaw: 0,
      gazePitch: 0,
      gazeWait: Math.random() * 1.2,
      idleWait: 0,
      walkWait: 2 + Math.random() * 4,
      path: null,
      pi: 0,
    }
    next += 1
    return mob
  }

  function spawn(type, x, y) {
    const mob = makeMob(type, x + 0.5, y)
    mobs.push(mob)
    void attach(mob)
    return mob
  }

  function step(dt, getBlock, extraSolids = [], helpers = { supportAt: (wx, fromY) => Math.max(0, fromY) }) {
    for (const mob of mobs) {
      steerMob(mob, dt, getBlock, extraSolids, helpers)
      mob.vy -= 32 * dt
      let x = mob.x + mob.vx * dt
      let y = mob.y + mob.vy * dt
      const aabb = { minX: x - mob.hw, maxX: x + mob.hw, minY: y, maxY: y + mob.hh, minZ: 0.2, maxZ: 0.8 }
      const boxes = solidsNear(getBlock, x, y, extraSolids)
      for (const box of boxes) {
        if (!overlap(aabb, box)) {
          continue
        }
        if (mob.vy <= 0 && aabb.minY <= box.maxY + 0.02 && aabb.maxY > box.maxY && aabb.minY >= box.maxY - 1.4) {
          y = box.maxY
          mob.vy = 0
          aabb.minY = y
          aabb.maxY = y + mob.hh
        }
        if (mob.vx > 0 && aabb.maxX > box.minX && aabb.minX < box.minX) {
          x = box.minX - mob.hw
          mob.facing = -1
          mob.vx = 0
          mob.path = null
        } else if (mob.vx < 0 && aabb.minX < box.maxX && aabb.maxX > box.maxX) {
          x = box.maxX + mob.hw
          mob.facing = 1
          mob.vx = 0
          mob.path = null
        }
      }
      const stand = helpers.supportAt(x, Math.max(y, 0) + mob.hh + 0.2, mob.hw)
      if (mob.vy <= 0 && y <= stand + 0.12) {
        y = stand
        mob.vy = 0
      } else if (y < 0) {
        y = 0
        mob.vy = 0
      }
      mob.x = x
      mob.y = y
      mob.inWater = inWaterAt(getBlock, x, y)
      syncAnim(mob, dt)
    }
  }

  function save() {
    return mobs.map((mob) => ({ type: mob.type, x: mob.x, y: mob.y }))
  }

  function load(list) {
    for (const mob of mobs.splice(0, mobs.length)) {
      drop(mob)
    }
    for (const item of list ?? []) {
      if (!item?.type) {
        continue
      }
      const mob = makeMob(item.type, Number(item.x) || 0.5, Number(item.y) || 0)
      mobs.push(mob)
      void attach(mob)
    }
  }

  return { spawn, step, save, load, isSpawnEgg, eggType }
}
