import { bareId } from './ids.js'

export function itemStack(id, count = 1) {
  const name = bareId(id)
  if (!name) {
    return null
  }
  const n = Math.max(1, Math.min(64, Math.floor(Number(count) || 1)))
  return { id: name, count: n }
}

export function stackId(stack) {
  if (!stack) {
    return ''
  }
  if (typeof stack === 'string') {
    return bareId(stack)
  }
  return bareId(stack.id)
}

export function stackCount(stack) {
  if (!stack) {
    return 0
  }
  if (typeof stack === 'string') {
    return 1
  }
  return Math.max(1, Math.floor(Number(stack.count) || 1))
}
