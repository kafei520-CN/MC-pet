import { emit } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { LogicalSize } from '@tauri-apps/api/dpi'
import { getCurrentWindow } from '@tauri-apps/api/window'

const window = getCurrentWindow()
window.setSize(new LogicalSize(300, 460)).catch(() => {})

for (const button of document.querySelectorAll('[data-action]')) {
  button.addEventListener('click', () => {
    emit('pet-menu', { action: button.dataset.action })
  })
}

const buildButton = document.querySelector('#build')
invoke('load_pet_settings')
  .then((text) => {
    if (!text) {
      return
    }
    const data = JSON.parse(text)
    if (data.build === 'slim') {
      buildButton.dataset.slim = '1'
      buildButton.textContent = '模型：纤细'
    }
    document.querySelector('#chibi').checked = Boolean(data.chibi)
    if (data.skinName) {
      document.querySelector('#skin-name').textContent = data.skinName
    }
  })
  .catch(() => {})

buildButton.addEventListener('click', (event) => {
  const slim = event.currentTarget.dataset.slim !== '1'
  event.currentTarget.dataset.slim = slim ? '1' : '0'
  event.currentTarget.textContent = slim ? '模型：纤细' : '模型：粗壮'
  emit('pet-menu', { action: 'build', slim })
})

document.querySelector('#chibi').addEventListener('change', (event) => {
  emit('pet-menu', { action: 'chibi', on: event.target.checked })
})

document.querySelector('#hide').addEventListener('change', (event) => {
  emit('pet-menu', { action: 'hidden', on: event.target.checked })
})

document.querySelector('#skin').addEventListener('change', (event) => {
  const file = event.target.files?.[0]
  if (!file) {
    return
  }
  document.querySelector('#skin-name').textContent = file.name
  const reader = new FileReader()
  reader.onload = () => {
    emit('pet-menu', { action: 'skin', url: reader.result, name: file.name })
  }
  reader.readAsDataURL(file)
})
