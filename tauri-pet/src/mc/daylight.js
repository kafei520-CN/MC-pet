export const NIGHT_AMBIENT = 1.35
export const NIGHT_SUN = 0.55
export const DAY_AMBIENT = 2.85
export const DAY_SUN = 1.2

export function dayAmount(date = new Date()) {
  const t = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600
  if (t >= 7 && t < 18) {
    return 1
  }
  if (t >= 6 && t < 7) {
    return t - 6
  }
  if (t >= 18 && t < 20) {
    return 1 - (t - 18) / 2
  }
  return 0
}

export function lightLevels(date) {
  const amount = dayAmount(date)
  return {
    amount,
    ambient: NIGHT_AMBIENT + (DAY_AMBIENT - NIGHT_AMBIENT) * amount,
    sun: NIGHT_SUN + (DAY_SUN - NIGHT_SUN) * amount,
    daytime: amount > 0.45 ? 'noon' : 'midnight',
    brightness: 0.72 + 0.28 * amount,
  }
}
