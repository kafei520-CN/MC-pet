const GUI = 2
const ICON = 9
const HOTBAR_W = 184
const HOTBAR_H = 23

function makeRow(kind, label) {
  const row = document.createElement('div')
  row.className = `survival-row ${kind}`
  row.setAttribute('aria-label', label)
  const icons = []
  for (let i = 0; i < 10; i += 1) {
    const icon = document.createElement('span')
    icon.className = `survival-icon ${kind} empty`
    row.appendChild(icon)
    icons.push(icon)
  }
  return { row, icons }
}

function paintRow(row, value) {
  const half = Math.max(0, Math.min(20, Number(value) || 0) / 2)
  row.icons.forEach((icon, index) => {
    const full = index + 1 <= half
    const halfIcon = !full && index < half
    icon.classList.toggle('full', full)
    icon.classList.toggle('half', halfIcon)
    icon.classList.toggle('empty', !full && !halfIcon)
  })
}

export function createSurvivalView() {
  const root = document.createElement('div')
  root.id = 'survival-hud'
  root.hidden = true
  const health = makeRow('health', '生命值')
  const hunger = makeRow('hunger', '饱食度')
  root.append(health.row, hunger.row)
  document.body.appendChild(root)

  return {
    setVisible(on) {
      root.hidden = !on
      root.style.display = on ? 'flex' : 'none'
    },
    sync(state) {
      paintRow(health, state?.health)
      paintRow(hunger, state?.hunger)
    },
    place(screenX, headTop) {
      const width = HOTBAR_W * GUI
      const hotbarHeight = HOTBAR_H * GUI
      const left = Math.round(screenX - width / 2)
      const hotbarTop = Math.round(headTop - hotbarHeight - 10)
      const x = Math.max(4, Math.min(window.innerWidth - width - 4, left))
      const y = Math.max(4, hotbarTop - ICON * GUI - 2)
      root.style.width = `${width}px`
      root.style.transform = `translate(${x}px, ${y}px)`
    },
  }
}
