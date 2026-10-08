import { bareId } from './ids.js'

// Values follow the vanilla food table for the commonly used items. The
// module intentionally keeps the table small; unknown items simply cannot be
// eaten in survival mode.
const FOOD = new Map([
  ['apple', { hunger: 4, saturation: 2.4 }],
  ['bread', { hunger: 5, saturation: 6 }],
  ['baked_potato', { hunger: 5, saturation: 6 }],
  ['beetroot', { hunger: 1, saturation: 1.2 }],
  ['carrot', { hunger: 3, saturation: 3.6 }],
  ['chorus_fruit', { hunger: 4, saturation: 2.4 }],
  ['cooked_beef', { hunger: 8, saturation: 12.8 }],
  ['cooked_chicken', { hunger: 6, saturation: 7.2 }],
  ['cooked_mutton', { hunger: 6, saturation: 9.6 }],
  ['cooked_porkchop', { hunger: 8, saturation: 12.8 }],
  ['cooked_rabbit', { hunger: 5, saturation: 6 }],
  ['cookie', { hunger: 2, saturation: 0.4 }],
  ['melon_slice', { hunger: 2, saturation: 1.2 }],
  ['mushroom_stew', { hunger: 6, saturation: 7.2 }],
  ['potato', { hunger: 1, saturation: 0.6 }],
  ['pumpkin_pie', { hunger: 8, saturation: 4.8 }],
  ['rabbit_stew', { hunger: 10, saturation: 12 }],
  ['steak', { hunger: 8, saturation: 12.8 }],
  ['suspicious_stew', { hunger: 6, saturation: 7.2 }],
  ['sweet_berries', { hunger: 2, saturation: 0.4 }],
  ['dried_kelp', { hunger: 1, saturation: 0.6 }],
  ['golden_apple', { hunger: 4, saturation: 9.6 }],
])

const WEAPON_DAMAGE = new Map([
  ['wooden_sword', 4],
  ['stone_sword', 5],
  ['iron_sword', 6],
  ['golden_sword', 4],
  ['diamond_sword', 7],
  ['netherite_sword', 8],
  ['wooden_axe', 7],
  ['stone_axe', 9],
  ['iron_axe', 9],
  ['golden_axe', 7],
  ['diamond_axe', 9],
  ['netherite_axe', 10],
  ['trident', 9],
  ['bow', 5],
  ['crossbow', 6],
])

export function foodValue(id) {
  return FOOD.get(bareId(id)) ?? null
}

export function isFood(id) {
  return Boolean(foodValue(id))
}

export function weaponDamage(id) {
  const name = bareId(id)
  return WEAPON_DAMAGE.get(name) ?? 0
}

export function isWeapon(id) {
  return weaponDamage(id) > 0
}

export function createSurvival(onChange) {
  let health = 20
  let hunger = 20
  let saturation = 5
  let mode = 'survival'
  let difficulty = 'normal'
  let regenTimer = 0
  let damageTimer = 0
  let drainTimer = 0

  function state() {
    return {
      health,
      hunger,
      saturation,
      mode,
      difficulty,
    }
  }

  function changed() {
    onChange?.(state())
  }

  function load(data) {
    health = Math.max(0, Math.min(20, Number(data?.health ?? 20)))
    hunger = Math.max(0, Math.min(20, Number(data?.hunger ?? 20)))
    if (health <= 0) {
      health = 20
      hunger = 20
    }
    saturation = Math.max(0, Math.min(hunger, Number(data?.saturation ?? 5)))
    mode = data?.mode === 'creative' ? 'creative' : 'survival'
    difficulty = ['peaceful', 'easy', 'normal', 'hard'].includes(data?.difficulty) ? data.difficulty : 'normal'
    regenTimer = 0
    damageTimer = 0
    drainTimer = 0
  }

  function configure(next = {}) {
    if (next.mode === 'creative' || next.mode === 'survival') {
      mode = next.mode
    }
    if (['peaceful', 'easy', 'normal', 'hard'].includes(next.difficulty)) {
      difficulty = next.difficulty
    }
    changed()
  }

  function reset() {
    health = 20
    hunger = 20
    saturation = 5
    regenTimer = 0
    damageTimer = 0
    drainTimer = 0
    changed()
  }

  function save() {
    return state()
  }

  function damage(amount) {
    const value = Math.max(0, Number(amount) || 0)
    if (!value || health <= 0 || mode === 'creative' || difficulty === 'peaceful') {
      return false
    }
    const scale = difficulty === 'easy' ? 0.5 : difficulty === 'hard' ? 1.5 : 1
    health = Math.max(0, health - value * scale)
    damageTimer = 0.5
    changed()
    return true
  }

  function heal(amount) {
    const value = Math.max(0, Number(amount) || 0)
    if (!value || health >= 20) {
      return false
    }
    health = Math.min(20, health + value)
    changed()
    return true
  }

  function eat(id) {
    const value = foodValue(id)
    if (!value || mode === 'creative' || hunger >= 20 || health <= 0) {
      return { ok: false, error: !value ? 'not edible' : 'not hungry' }
    }
    hunger = Math.min(20, hunger + value.hunger)
    saturation = Math.min(hunger, saturation + value.saturation)
    changed()
    return { ok: true, id: bareId(id), hunger: value.hunger }
  }

  function tick(delta) {
    const dt = Math.max(0, Number(delta) || 0)
    if (mode === 'creative') {
      if (health < 20) {
        health = 20
        changed()
      }
      return false
    }
    if (difficulty === 'peaceful') {
      if (health < 20 || hunger < 20 || saturation < 5) {
        health = 20
        hunger = 20
        saturation = 5
        changed()
      }
      return false
    }
    if (health <= 0) {
      health = 20
      hunger = 20
      saturation = 5
      changed()
      return true
    }
    let dirty = false
    if (hunger >= 18 && health > 0 && health < 20) {
      regenTimer += dt
      if (regenTimer >= 4) {
        regenTimer = 0
        health = Math.min(20, health + 1)
        saturation = Math.max(0, saturation - 1)
        dirty = true
      }
    } else {
      regenTimer = 0
    }
    if (hunger <= 0 && health > 0) {
      damageTimer += dt
      if (damageTimer >= 4) {
        damageTimer = 0
        damage(1)
        dirty = false
      }
    } else {
      damageTimer = Math.max(0, damageTimer - dt)
    }
    if (dirty) {
      changed()
    }
    return dirty
  }

  return { state, save, load, reset, configure, tick, damage, heal, eat, isFood, isWeapon, weaponDamage }
}

