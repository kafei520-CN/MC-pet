import { bareId } from './ids.js'

export const HOTBAR_SIZE = 9

export const STARTER_ITEMS = [
  'grass_block',
  'dirt',
  'cobblestone',
  'oak_planks',
  'oak_log',
  'oak_leaves',
  'stone',
  'glass',
  'oak_fence',
]

export function swapDuration(distance) {
  const slots = Math.max(1, Math.abs(distance))
  return Math.min(0.95, 0.32 + 0.07 * slots)
}

export function selectDuration(distance) {
  const slots = Math.max(1, Math.abs(distance))
  return Math.min(0.42, 0.11 + 0.035 * slots)
}

function emptySlots() {
  return Array.from({ length: HOTBAR_SIZE }, () => null)
}

function nearestSlot(slots, selected, id) {
  let found = -1
  let best = Infinity
  for (let index = 0; index < slots.length; index += 1) {
    if (slots[index] !== id) {
      continue
    }
    const distance = Math.abs(index - selected)
    if (distance < best || (distance === best && index < found)) {
      best = distance
      found = index
    }
  }
  return found
}

export function createHotbar() {
  const slots = emptySlots()
  let selected = 0

  function seed(handId) {
    for (let index = 0; index < HOTBAR_SIZE; index += 1) {
      slots[index] = STARTER_ITEMS[index] ?? null
    }
    selected = 0
    const held = bareId(handId)
    if (!held) {
      return
    }
    const found = slots.indexOf(held)
    if (found >= 0) {
      selected = found
      return
    }
    slots[0] = held
  }

  seed()

  return {
    seed,
    state() {
      return {
        selected,
        slots: slots.slice(),
      }
    },
    save() {
      return {
        selected,
        slots: slots.slice(),
      }
    },
    read(saved, handId) {
      const incoming = Array.isArray(saved?.slots) ? saved.slots : null
      if (!incoming || incoming.length !== HOTBAR_SIZE) {
        seed(handId)
        return
      }
      for (let index = 0; index < HOTBAR_SIZE; index += 1) {
        const name = bareId(incoming[index])
        slots[index] = name || null
      }
      const next = Number(saved.selected)
      selected = Number.isInteger(next) && next >= 0 && next < HOTBAR_SIZE ? next : 0
    },
    selectedItem() {
      return slots[selected]
    },
    setSlot(index, id) {
      if (!Number.isInteger(index) || index < 0 || index >= HOTBAR_SIZE) {
        return { selected, id: slots[selected] }
      }
      slots[index] = bareId(id) || null
      return { selected, id: slots[selected] }
    },
    selectIndex(index) {
      if (!Number.isInteger(index) || index < 0 || index >= HOTBAR_SIZE) {
        return { selected, id: slots[selected] }
      }
      selected = index
      return { selected, id: slots[selected] }
    },
    cycle(step) {
      const delta = step >= 0 ? 1 : -1
      selected = (selected + delta + HOTBAR_SIZE) % HOTBAR_SIZE
      return { selected, id: slots[selected] }
    },
    commit(id) {
      const name = bareId(id)
      if (!name) {
        return { id: null, direction: 0, distance: 0, selected }
      }
      if (slots[selected] === name) {
        return { id: name, direction: 0, distance: 0, selected }
      }
      const found = nearestSlot(slots, selected, name)
      if (found >= 0) {
        const distance = Math.abs(found - selected)
        const direction = found > selected ? 1 : -1
        selected = found
        return { id: name, direction, distance, selected }
      }
      slots[selected] = name
      return { id: name, direction: 0, distance: 0, selected, replaced: true }
    },
  }
}
