import { bareId } from './ids.js'
import { asStack, itemStack, stackId } from './item-stack.js'

export const HOTBAR_SIZE = 9

export const STARTER_ITEMS = [
  'wooden_sword',
  'apple',
  'bread',
  'grass_block',
  'dirt',
  'oak_planks',
  'oak_log',
  'stone',
  'torch',
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

function copySlot(slot) {
  const stack = asStack(slot)
  return stack ? { id: stack.id, count: stack.count } : null
}

function nearestSlot(slots, selected, id) {
  let found = -1
  let best = Infinity
  for (let index = 0; index < slots.length; index += 1) {
    if (stackId(slots[index]) !== id) {
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
      slots[index] = itemStack(STARTER_ITEMS[index], 1)
    }
    selected = 0
    const held = bareId(handId)
    if (!held) {
      return
    }
    const found = slots.findIndex((slot) => stackId(slot) === held)
    if (found >= 0) {
      selected = found
      return
    }
    slots[0] = itemStack(held, 1)
  }

  seed()

  return {
    seed,
    state() {
      return {
        selected,
        slots: slots.map(copySlot),
      }
    },
    save() {
      return {
        selected,
        slots: slots.map(copySlot),
      }
    },
    read(saved, handId) {
      const incoming = Array.isArray(saved?.slots) ? saved.slots : null
      if (!incoming || incoming.length !== HOTBAR_SIZE) {
        seed(handId)
        return
      }
      for (let index = 0; index < HOTBAR_SIZE; index += 1) {
        slots[index] = asStack(incoming[index])
      }
      const next = Number(saved.selected)
      selected = Number.isInteger(next) && next >= 0 && next < HOTBAR_SIZE ? next : 0
    },
    selectedItem() {
      return stackId(slots[selected]) || null
    },
    selectedStack() {
      return copySlot(slots[selected])
    },
    consumeSelected() {
      const stack = slots[selected]
      if (!stack) {
        return null
      }
      const id = stackId(stack)
      if (stack.count <= 1) {
        slots[selected] = null
      } else {
        slots[selected] = { id, count: stack.count - 1 }
      }
      return id
    },
    setSlot(index, value) {
      if (!Number.isInteger(index) || index < 0 || index >= HOTBAR_SIZE) {
        return { selected, id: stackId(slots[selected]) || null }
      }
      slots[index] = asStack(value)
      return { selected, id: stackId(slots[selected]) || null }
    },
    selectIndex(index) {
      if (!Number.isInteger(index) || index < 0 || index >= HOTBAR_SIZE) {
        return { selected, id: stackId(slots[selected]) || null }
      }
      selected = index
      return { selected, id: stackId(slots[selected]) || null }
    },
    cycle(step) {
      const delta = step >= 0 ? 1 : -1
      selected = (selected + delta + HOTBAR_SIZE) % HOTBAR_SIZE
      return { selected, id: stackId(slots[selected]) || null }
    },
    commit(id) {
      const name = bareId(id)
      if (!name) {
        return { id: null, direction: 0, distance: 0, selected }
      }
      if (stackId(slots[selected]) === name) {
        return { id: name, direction: 0, distance: 0, selected }
      }
      const found = nearestSlot(slots, selected, name)
      if (found >= 0) {
        const distance = Math.abs(found - selected)
        const direction = found > selected ? 1 : -1
        selected = found
        return { id: name, direction, distance, selected }
      }
      slots[selected] = itemStack(name, 1)
      return { id: name, direction: 0, distance: 0, selected, replaced: true }
    },
  }
}
