import { gridSize } from './scale.js'

function cellId(cell) {
  if (!cell) {
    return null
  }
  if (typeof cell === 'string') {
    return { id: cell, properties: undefined }
  }
  if (cell.id) {
    return { id: cell.id, properties: cell.p ?? cell.properties }
  }
  return null
}

function originX(spec, layerWidth) {
  const cols = gridSize().cols
  const anchor = spec?.anchor ?? 'center'
  const offset = spec?.offsetX ?? spec?.x ?? 0
  if (anchor === 'left') {
    return Math.max(0, offset)
  }
  const width = spec?.width ?? layerWidth ?? 1
  return Math.max(0, Math.floor(cols / 2) - Math.floor(width / 2) + offset)
}

function parseLayers(layers, ox, originY, z, blocks) {
  if (!Array.isArray(layers)) {
    return
  }
  layers.forEach((row, y) => {
    if (!row) {
      return
    }
    row.forEach((cell, x) => {
      const parsed = cellId(cell)
      if (!parsed) {
        return
      }
      blocks.push({
        x: ox + x,
        y: originY + y,
        z,
        id: parsed.id,
        properties: parsed.properties,
      })
    })
  })
}

export function parseSchematic(json) {
  const spec = json?.origin ?? {}
  const originY = spec.y ?? spec.originY ?? 0
  const blocks = []
  if (Array.isArray(json?.slices)) {
    const width = Math.max(0, ...json.slices.flatMap((slice) => (slice.layers ?? []).map((row) => (row ? row.length : 0))))
    const ox = originX(spec, width)
    for (const slice of json.slices) {
      parseLayers(slice.layers, ox, originY, slice.z ?? 0, blocks)
    }
  } else if (Array.isArray(json?.layers)) {
    const width = Math.max(0, ...json.layers.map((row) => (row ? row.length : 0)))
    const ox = originX(spec, width)
    parseLayers(json.layers, ox, originY, 0, blocks)
  }
  if (Array.isArray(json?.blocks)) {
    const ox = originX(spec, 1)
    for (const block of json.blocks) {
      const parsed = cellId(block)
      if (!parsed) {
        continue
      }
      blocks.push({
        x: ox + (block.x ?? 0),
        y: originY + (block.y ?? 0),
        z: block.z ?? 0,
        id: parsed.id,
        properties: parsed.properties,
      })
    }
  }
  blocks.sort((a, b) => a.y - b.y || a.x - b.x || (a.z ?? 0) - (b.z ?? 0))
  return blocks
}
