import { worldBoxes } from './collision.js'
import { BLOCK_PX, screenToWorld, worldToScreen } from './scale.js'

export function hitTest(getBlock, screenX, screenY) {
  const world = screenToWorld(screenX, screenY)
  const x = Math.floor(world.x)
  const y = Math.floor(world.y)
  const block = getBlock(x, y)
  if (!block) {
    return null
  }
  const boxes = worldBoxes(block, x, y)
  const inside = boxes.some((box) => (
    world.x >= box.minX && world.x <= box.maxX && world.y >= box.minY && world.y <= box.maxY
  ))
  if (!inside && boxes.length) {
    return null
  }
  return { x, y, id: block.id, properties: { ...block.properties }, nbt: block.nbt }
}

export function blockScreenRects(blocks) {
  const rects = []
  for (const block of blocks) {
    const boxes = worldBoxes(block, block.x, block.y)
    for (const box of boxes) {
      const topLeft = worldToScreen(box.minX, box.maxY)
      rects.push({
        x: topLeft.x,
        y: topLeft.y,
        width: (box.maxX - box.minX) * BLOCK_PX,
        height: (box.maxY - box.minY) * BLOCK_PX,
      })
    }
  }
  return rects
}
