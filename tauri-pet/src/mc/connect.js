import {
  bareId,
  canConnectFence,
  FACING_OFFSET,
  isBed,
  isChest,
  isDoor,
  isFence,
  isFenceGate,
  isPane,
  isPiston,
  isStairs,
  isTallPlant,
  isWall,
  opposite,
  rotateY,
} from './ids.js'

function prop(block, key, fallback) {
  const value = block?.properties?.[key]
  return value == null || value === '' ? fallback : String(value)
}

function boolProp(block, key) {
  return prop(block, key, 'false') === 'true'
}

function setProp(block, key, value) {
  block.properties = { ...block.properties, [key]: String(value) }
}

function neighbor(get, x, y, facing) {
  if (facing === 'east') {
    return get(x + 1, y)
  }
  if (facing === 'west') {
    return get(x - 1, y)
  }
  return null
}

function sameAxis(a, b) {
  return (a === 'east' || a === 'west') === (b === 'east' || b === 'west')
}

function updateFenceLike(get, block, x, y) {
  for (const dir of ['east', 'west']) {
    const next = neighbor(get, x, y, dir)
    let connect = false
    if (next) {
      if (isFenceGate(next.id)) {
        const facing = prop(next, 'facing', 'south')
        connect = facing === 'north' || facing === 'south'
      } else {
        connect = canConnectFence(next.id, next.properties)
      }
    }
    setProp(block, dir, connect)
  }
  setProp(block, 'north', false)
  setProp(block, 'south', false)
}

function updateWall(get, block, x, y) {
  for (const dir of ['east', 'west']) {
    const next = neighbor(get, x, y, dir)
    const connect = Boolean(next && canConnectFence(next.id, next.properties))
    setProp(block, dir, connect ? 'low' : 'none')
  }
  setProp(block, 'north', 'none')
  setProp(block, 'south', 'none')
  const up = get(x, y + 1)
  setProp(block, 'up', !up || !isWall(up.id))
}

function updatePane(get, block, x, y) {
  for (const dir of ['east', 'west']) {
    const next = neighbor(get, x, y, dir)
    const connect = Boolean(next && (isPane(next.id) || canConnectFence(next.id, next.properties)))
    setProp(block, dir, connect)
  }
  setProp(block, 'north', false)
  setProp(block, 'south', false)
}

function updateStairs(get, block, x, y) {
  const facing = prop(block, 'facing', 'east')
  const half = prop(block, 'half', 'bottom')
  const front = neighbor(get, x, y, facing)
  const back = neighbor(get, x, y, opposite(facing))
  let shape = 'straight'
  if (front && isStairs(front.id) && prop(front, 'half', 'bottom') === half && !sameAxis(facing, prop(front, 'facing', 'east'))) {
    const turn = prop(front, 'facing', 'east')
    shape = rotateY(facing, 1) === turn ? 'outer_right' : 'outer_left'
  } else if (back && isStairs(back.id) && prop(back, 'half', 'bottom') === half && !sameAxis(facing, prop(back, 'facing', 'east'))) {
    const turn = prop(back, 'facing', 'east')
    shape = rotateY(facing, 1) === turn ? 'inner_left' : 'inner_right'
  }
  setProp(block, 'shape', shape)
}

function updateChest(get, block, x, y) {
  const facing = prop(block, 'facing', 'south')
  const leftDir = rotateY(facing, 1)
  const rightDir = rotateY(facing, -1)
  const left = neighbor(get, x, y, leftDir)
  const right = neighbor(get, x, y, rightDir)
  if (left && isChest(left.id) && bareId(left.id) === bareId(block.id) && prop(left, 'facing', 'south') === facing) {
    setProp(block, 'type', 'right')
    return
  }
  if (right && isChest(right.id) && bareId(right.id) === bareId(block.id) && prop(right, 'facing', 'south') === facing) {
    setProp(block, 'type', 'left')
    return
  }
  setProp(block, 'type', 'single')
}

function updateGate(get, block, x, y) {
  const facing = prop(block, 'facing', 'south')
  const sideA = neighbor(get, x, y, rotateY(facing, 1))
  const sideB = neighbor(get, x, y, rotateY(facing, -1))
  const inWall = Boolean((sideA && isWall(sideA.id)) || (sideB && isWall(sideB.id)))
  setProp(block, 'in_wall', inWall)
}

export function updateConnections(get, set, x, y) {
  const block = get(x, y)
  if (!block) {
    return
  }
  if (isFence(block.id)) {
    updateFenceLike(get, block, x, y)
    set(x, y, block)
  } else if (isWall(block.id)) {
    updateWall(get, block, x, y)
    set(x, y, block)
  } else if (isPane(block.id)) {
    updatePane(get, block, x, y)
    set(x, y, block)
  } else if (isStairs(block.id)) {
    updateStairs(get, block, x, y)
    set(x, y, block)
  } else if (isChest(block.id)) {
    updateChest(get, block, x, y)
    set(x, y, block)
  } else if (isFenceGate(block.id)) {
    updateGate(get, block, x, y)
    set(x, y, block)
  }
}

export function touchNeighbors(get, set, x, y) {
  updateConnections(get, set, x, y)
  updateConnections(get, set, x + 1, y)
  updateConnections(get, set, x - 1, y)
  updateConnections(get, set, x, y + 1)
  updateConnections(get, set, x, y - 1)
}

export function extraCells(id, x, y, properties = {}) {
  const name = bareId(id)
  const props = { ...properties }
  const cells = []
  if (isDoor(name)) {
    const half = props.half ?? 'lower'
    const shared = {
      facing: props.facing ?? 'east',
      hinge: props.hinge ?? 'left',
      open: props.open ?? 'false',
      powered: props.powered ?? 'false',
    }
    if (half === 'upper') {
      cells.push({ x, y, id: name, properties: { ...shared, half: 'upper' } })
      cells.push({ x, y: y - 1, id: name, properties: { ...shared, half: 'lower' } })
    } else {
      cells.push({ x, y, id: name, properties: { ...shared, half: 'lower' } })
      cells.push({ x, y: y + 1, id: name, properties: { ...shared, half: 'upper' } })
    }
    return cells
  }
  if (isBed(name)) {
    const facing = props.facing ?? 'east'
    const part = props.part ?? 'foot'
    const occ = props.occupied ?? 'false'
    const offset = FACING_OFFSET[facing] ?? FACING_OFFSET.east
    if (part === 'head') {
      cells.push({ x, y, id: name, properties: { facing, part: 'head', occupied: occ } })
      cells.push({ x: x - offset.x, y: y - (offset.y ?? 0), id: name, properties: { facing, part: 'foot', occupied: occ } })
    } else {
      cells.push({ x, y, id: name, properties: { facing, part: 'foot', occupied: occ } })
      cells.push({ x: x + offset.x, y: y + (offset.y ?? 0), id: name, properties: { facing, part: 'head', occupied: occ } })
    }
    return cells
  }
  if (isTallPlant(name)) {
    const half = props.half ?? 'lower'
    if (half === 'upper') {
      cells.push({ x, y, id: name, properties: { half: 'upper' } })
      cells.push({ x, y: y - 1, id: name, properties: { half: 'lower' } })
    } else {
      cells.push({ x, y, id: name, properties: { half: 'lower' } })
      cells.push({ x, y: y + 1, id: name, properties: { half: 'upper' } })
    }
    return cells
  }
  if (isPiston(name) && String(props.extended) === 'true') {
    const facing = props.facing ?? 'east'
    const offset = FACING_OFFSET[facing] ?? FACING_OFFSET.east
    cells.push({ x, y, id: name, properties: { facing, extended: 'true' } })
    cells.push({
      x: x + offset.x,
      y: y + (offset.y ?? 0),
      id: 'piston_head',
      properties: { facing, type: name === 'sticky_piston' ? 'sticky' : 'normal', short: 'false' },
    })
    return cells
  }
  return [{ x, y, id: name, properties: props }]
}

export function partnerCells(block, x, y) {
  return extraCells(block.id, x, y, block.properties)
}
