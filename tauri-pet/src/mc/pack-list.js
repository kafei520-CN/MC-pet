import { packIndexKey } from './pack-key.js'

let cached = null
let resolved = false
let pending = null

// Installed builds have no Vite dev server, so /resource-pack/__list 404s.
// closeBundle writes resource-pack/__index.json. Dev falls back to __list.
function loadIndex() {
  if (resolved) {
    return Promise.resolve(cached)
  }
  if (pending) {
    return pending
  }
  pending = fetch('/resource-pack/__index.json').then(async (response) => {
    if (response.status === 404 || !response.ok) {
      cached = null
      resolved = response.status === 404
      return null
    }
    try {
      const data = await response.json()
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        cached = null
        resolved = true
        return null
      }
      cached = data
      resolved = true
      return cached
    } catch {
      cached = null
      resolved = true
      return null
    }
  }).catch(() => null).finally(() => {
    pending = null
  })
  return pending
}

async function listLive(dir) {
  try {
    const response = await fetch(
      `/resource-pack/__list?dir=${encodeURIComponent(dir)}`,
    )
    if (!response.ok) {
      return []
    }
    const names = await response.json()
    return Array.isArray(names) ? names : []
  } catch {
    return []
  }
}

export async function listPack(dir) {
  const index = await loadIndex()
  if (index) {
    const names = index[packIndexKey(dir)]
    return Array.isArray(names) ? names : []
  }
  return listLive(dir)
}
