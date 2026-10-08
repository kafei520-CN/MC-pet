const MODES = [
  { id: 'survival', label: '生存模式' },
  { id: 'creative', label: '创造模式' },
]

const DIFFICULTIES = [
  { id: 'peaceful', label: '和平' },
  { id: 'easy', label: '简单' },
  { id: 'normal', label: '普通' },
  { id: 'hard', label: '困难' },
]

export function gameModeLabel(id) {
  return MODES.find((item) => item.id === id)?.label ?? '创造模式'
}

export function difficultyLabel(id) {
  return DIFFICULTIES.find((item) => item.id === id)?.label ?? '和平'
}
