import { BLOCK_PX, worldToScreen } from './scale.js'

const STAGES = 10

export function createMineOverlay() {
  const img = document.createElement('img')
  img.id = 'mine-crack'
  img.alt = ''
  img.draggable = false
  img.hidden = true
  img.style.position = 'fixed'
  img.style.pointerEvents = 'none'
  img.style.zIndex = '5'
  img.style.imageRendering = 'pixelated'
  document.body.appendChild(img)

  return {
    set(cell, stage) {
      if (!cell || stage < 0) {
        img.hidden = true
        return
      }
      const index = Math.max(0, Math.min(STAGES - 1, stage | 0))
      const next = `/resource-pack/minecraft/textures/block/destroy_stage_${index}.png`
      if (img.getAttribute('src') !== next) {
        img.src = next
      }
      const top = worldToScreen(cell.x, cell.y + 1)
      img.style.left = `${Math.round(top.x)}px`
      img.style.top = `${Math.round(top.y)}px`
      img.style.width = `${Math.round(BLOCK_PX)}px`
      img.style.height = `${Math.round(BLOCK_PX)}px`
      img.hidden = false
    },
    clear() {
      img.hidden = true
    },
    dispose() {
      img.remove()
    },
  }
}
