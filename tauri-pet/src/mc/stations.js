import { bareId } from './ids.js'

export function stationKind(id) {
  const name = bareId(id)
  if (!name) {
    return null
  }
  if (name === 'chest' || name === 'trapped_chest') {
    return 'chest'
  }
  if (name === 'barrel') {
    return 'barrel'
  }
  if (name === 'shulker_box' || name.endsWith('_shulker_box')) {
    return 'shulker'
  }
  if (name === 'furnace') {
    return 'furnace'
  }
  if (name === 'blast_furnace') {
    return 'blast_furnace'
  }
  if (name === 'smoker') {
    return 'smoker'
  }
  if (name === 'brewing_stand') {
    return 'brewing'
  }
  if (name === 'anvil' || name.endsWith('_anvil')) {
    return 'anvil'
  }
  if (name === 'smithing_table') {
    return 'smithing'
  }
  if (name === 'crafting_table') {
    return 'crafting'
  }
  return null
}

function grid(cols, rows, x, y, role, start = 0) {
  const slots = []
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      slots.push({
        x: x + col * 18,
        y: y + row * 18,
        role,
        index: start + row * cols + col,
      })
    }
  }
  return slots
}

function playerSlots(invY, hotbarY) {
  return [
    ...grid(9, 3, 8, invY, 'player'),
    ...grid(9, 1, 8, hotbarY, 'hotbar'),
  ]
}

function chestLayout(rows) {
  const yOff = (rows - 4) * 18
  return {
    texture: 'generic_54.png',
    width: 176,
    height: 114 + rows * 18,
    split: { rows, top: rows * 18 + 17, bottomV: 126, bottomH: 96 },
    slots: [
      ...grid(9, rows, 8, 18, 'block'),
      ...playerSlots(103 + yOff, 161 + yOff),
    ],
  }
}

export function stationLayout(kind) {
  if (kind === 'double_chest') {
    return chestLayout(6)
  }
  if (kind === 'chest' || kind === 'barrel') {
    return chestLayout(3)
  }
  if (kind === 'inventory') {
    return {
      texture: 'inventory.png',
      width: 176,
      height: 166,
      slots: [
        { x: 98, y: 18, role: 'craft', index: 0 },
        { x: 116, y: 18, role: 'craft', index: 1 },
        { x: 98, y: 36, role: 'craft', index: 2 },
        { x: 116, y: 36, role: 'craft', index: 3 },
        { x: 154, y: 28, role: 'result', index: 0 },
        ...playerSlots(84, 142),
      ],
    }
  }
  if (kind === 'shulker') {
    return {
      texture: 'shulker_box.png',
      width: 176,
      height: 166,
      slots: [
        ...grid(9, 3, 8, 18, 'block'),
        ...playerSlots(84, 142),
      ],
    }
  }
  if (kind === 'furnace' || kind === 'blast_furnace' || kind === 'smoker') {
    const texture = kind === 'furnace' ? 'furnace.png' : `${kind}.png`
    return {
      texture,
      width: 176,
      height: 166,
      slots: [
        { x: 56, y: 17, role: 'block', index: 0 },
        { x: 56, y: 53, role: 'block', index: 1 },
        { x: 116, y: 35, role: 'output', index: 2 },
        ...playerSlots(84, 142),
      ],
    }
  }
  if (kind === 'brewing') {
    return {
      texture: 'brewing_stand.png',
      width: 176,
      height: 166,
      slots: [
        { x: 56, y: 51, role: 'block', index: 0 },
        { x: 79, y: 58, role: 'block', index: 1 },
        { x: 102, y: 51, role: 'block', index: 2 },
        { x: 79, y: 17, role: 'block', index: 3 },
        { x: 17, y: 17, role: 'block', index: 4 },
        ...playerSlots(84, 142),
      ],
    }
  }
  if (kind === 'anvil') {
    return {
      texture: 'anvil.png',
      width: 176,
      height: 166,
      slots: [
        { x: 27, y: 47, role: 'block', index: 0 },
        { x: 76, y: 47, role: 'block', index: 1 },
        { x: 134, y: 47, role: 'output', index: 2 },
        ...playerSlots(84, 142),
      ],
    }
  }
  if (kind === 'smithing') {
    return {
      texture: 'smithing.png',
      width: 176,
      height: 166,
      slots: [
        { x: 8, y: 48, role: 'block', index: 0 },
        { x: 26, y: 48, role: 'block', index: 1 },
        { x: 44, y: 48, role: 'block', index: 2 },
        { x: 98, y: 48, role: 'output', index: 3 },
        ...playerSlots(84, 142),
      ],
    }
  }
  return {
    texture: 'crafting_table.png',
    width: 176,
    height: 166,
    slots: [
      ...grid(3, 3, 30, 17, 'craft'),
      { x: 124, y: 35, role: 'result', index: 0 },
      ...playerSlots(84, 142),
    ],
  }
}

export function containerSize(kind) {
  if (kind === 'double_chest') {
    return 54
  }
  if (kind === 'inventory') {
    return 4
  }
  if (kind === 'chest' || kind === 'barrel' || kind === 'shulker') {
    return 27
  }
  if (kind === 'brewing') {
    return 5
  }
  if (kind === 'smithing') {
    return 4
  }
  if (kind === 'anvil' || kind === 'furnace' || kind === 'blast_furnace' || kind === 'smoker') {
    return 3
  }
  return 9
}

export function emptySlots(count) {
  return Array.from({ length: count }, () => null)
}

export function normalizeStack(stack) {
  if (!stack || !stack.id || stack.count < 1) {
    return null
  }
  return { id: bareId(stack.id), count: Math.min(64, Math.floor(stack.count)) }
}

export function readItems(nbt, count) {
  const source = Array.isArray(nbt?.items) ? nbt.items : []
  return Array.from({ length: count }, (_, index) => normalizeStack(source[index]))
}
