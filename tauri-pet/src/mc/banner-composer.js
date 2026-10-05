export const DYE = {
  white: '#F9FFFE',
  orange: '#F9801D',
  magenta: '#C74EBD',
  light_blue: '#3AB3DA',
  yellow: '#FED83D',
  lime: '#80C71F',
  pink: '#F38BAA',
  gray: '#474F52',
  light_gray: '#9D9D97',
  cyan: '#169C9C',
  purple: '#8932B8',
  blue: '#3C44AA',
  brown: '#835432',
  green: '#5E7C16',
  red: '#B02E26',
  black: '#1D1D21',
}

const PATTERN_FILES = {
  stripe_bottom: 'stripe_bottom',
  stripe_top: 'stripe_top',
  stripe_left: 'stripe_left',
  stripe_right: 'stripe_right',
  stripe_center: 'stripe_center',
  stripe_middle: 'stripe_middle',
  stripe_downright: 'stripe_downright',
  stripe_downleft: 'stripe_downleft',
  small_stripes: 'small_stripes',
  cross: 'cross',
  straight_cross: 'straight_cross',
  diagonal_left: 'diagonal_left',
  diagonal_right: 'diagonal_right',
  diagonal_up_left: 'diagonal_up_left',
  diagonal_up_right: 'diagonal_up_right',
  half_vertical: 'half_vertical',
  half_vertical_right: 'half_vertical_right',
  half_horizontal: 'half_horizontal',
  half_horizontal_bottom: 'half_horizontal_bottom',
  square_bottom_left: 'square_bottom_left',
  square_bottom_right: 'square_bottom_right',
  square_top_left: 'square_top_left',
  square_top_right: 'square_top_right',
  triangle_bottom: 'triangle_bottom',
  triangle_top: 'triangle_top',
  triangles_bottom: 'triangles_bottom',
  triangles_top: 'triangles_top',
  circle: 'circle',
  rhombus: 'rhombus',
  border: 'border',
  curly_border: 'curly_border',
  bricks: 'bricks',
  gradient: 'gradient',
  gradient_up: 'gradient_up',
  creeper: 'creeper',
  skull: 'skull',
  flower: 'flower',
  mojang: 'mojang',
  globe: 'globe',
  piglin: 'piglin',
}

function dyeHex(color) {
  return DYE[color] ?? DYE.white
}

function loadImage(url) {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = url
  })
}

function tint(image, hex) {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, 0, 0)
  const color = Number.parseInt(String(hex).replace('#', ''), 16)
  const r = (color >> 16) & 255
  const g = (color >> 8) & 255
  const b = color & 255
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = pixels.data
  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i] * r / 255
    data[i + 1] = data[i + 1] * g / 255
    data[i + 2] = data[i + 2] * b / 255
  }
  ctx.putImageData(pixels, 0, 0)
  return canvas
}

export function patternTexture(pattern) {
  const file = PATTERN_FILES[String(pattern ?? '').replace(/^minecraft:/, '')]
  return file ? `/resource-pack/minecraft/textures/entity/banner/${file}.png` : ''
}

export async function composeBannerTexture(color, patterns = []) {
  const base = await loadImage('/resource-pack/minecraft/textures/entity/banner/base.png')
  if (!base) {
    return null
  }
  const canvas = document.createElement('canvas')
  canvas.width = base.width
  canvas.height = base.height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(tint(base, dyeHex(color)), 0, 0)
  for (const layer of patterns.slice(0, 6)) {
    const url = patternTexture(layer?.pattern)
    if (!url) {
      continue
    }
    const sprite = await loadImage(url)
    if (!sprite) {
      continue
    }
    ctx.drawImage(tint(sprite, dyeHex(layer.color)), 0, 0)
  }
  return canvas
}
