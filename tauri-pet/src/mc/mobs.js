import * as THREE from 'three'
import { overlap, worldBoxes } from './collision.js'
import { applyEntityMolang, createEntityModel } from './bedrock-pack.js'
import { createJavaEntity } from './java-entity.js'
import { eggType, isSpawnEgg } from './spawn-egg.js'

function solidsNear(getBlock, x, y) {
  const boxes = []
  for (let gx = Math.floor(x - 1); gx <= Math.floor(x + 1); gx += 1) {
    for (let gy = Math.floor(y - 1); gy <= Math.floor(y + 2); gy += 1) {
      boxes.push(...worldBoxes(getBlock(gx, gy), gx, gy))
    }
  }
  return boxes
}

function pose(mob) {
  if (!mob.view) {
    return
  }
  mob.view.position.set(mob.x * 16, mob.y * 16, 8)
  mob.view.rotation.y = 0
}

function syncAnim(mob, dt) {
  if (!mob.model) {
    return
  }
  mob.life += dt
  mob.moved += Math.abs(mob.vx) * dt
  const speed = mob.vy === 0 ? Math.min(1, Math.abs(mob.vx) / 1.4) : 0
  if (mob.model.kind === 'java') {
    mob.model.animate(mob.moved, speed, mob.life)
    pose(mob)
    return
  }
  applyEntityMolang(mob.model, mob.pre, {
    modified_distance_moved: mob.moved,
    modified_move_speed: speed,
    ground_speed: Math.abs(mob.vx),
    is_on_ground: mob.vy === 0 ? 1 : 0,
    swell_amount: 0,
    is_baby: 0,
    is_in_water: 0,
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

  function spawn(type, x, y) {
    const mob = {
      nid: next,
      type,
      x: x + 0.5,
      y,
      vx: Math.random() < 0.5 ? -1.4 : 1.4,
      vy: 0,
      hw: 0.3,
      hh: 0.9,
      moved: 0,
      life: 0,
      pre: [],
    }
    next += 1
    mobs.push(mob)
    void attach(mob)
    return mob
  }

  function step(dt, getBlock) {
    for (const mob of mobs) {
      mob.vy -= 32 * dt
      let x = mob.x + mob.vx * dt
      let y = mob.y + mob.vy * dt
      const aabb = { minX: x - mob.hw, maxX: x + mob.hw, minY: y, maxY: y + mob.hh }
      const boxes = solidsNear(getBlock, x, y)
      for (const box of boxes) {
        if (!overlap(aabb, box)) {
          continue
        }
        if (mob.vy <= 0 && aabb.minY <= box.maxY && aabb.maxY > box.maxY) {
          y = box.maxY
          mob.vy = 0
          aabb.minY = y
          aabb.maxY = y + mob.hh
        }
        if (mob.vx > 0 && aabb.maxX > box.minX && aabb.minX < box.minX) {
          x = box.minX - mob.hw
          mob.vx = -Math.abs(mob.vx)
        } else if (mob.vx < 0 && aabb.minX < box.maxX && aabb.maxX > box.maxX) {
          x = box.maxX + mob.hw
          mob.vx = Math.abs(mob.vx)
        }
      }
      if (y < 0) {
        y = 0
        mob.vy = 0
      }
      mob.x = x
      mob.y = y
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
      const mob = {
        nid: next,
        type: item.type,
        x: Number(item.x) || 0.5,
        y: Number(item.y) || 0,
        vx: Math.random() < 0.5 ? -1.4 : 1.4,
        vy: 0,
        hw: 0.3,
        hh: 0.9,
        moved: 0,
        life: 0,
        pre: [],
      }
      next += 1
      mobs.push(mob)
      void attach(mob)
    }
  }

  return { spawn, step, save, load, isSpawnEgg, eggType }
}
