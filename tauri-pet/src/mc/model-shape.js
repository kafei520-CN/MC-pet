export function modelFilePath(name) {
  let id = String(name ?? '').replace(/^minecraft:/, '')
  if (!id) {
    return ''
  }
  if (!id.includes('/')) {
    id = `block/${id}`
  }
  return `assets/minecraft/models/${id}.json`
}

function asSpec(entry) {
  if (!entry) {
    return null
  }
  const spec = Array.isArray(entry) ? entry[0] : entry
  if (!spec?.model) {
    return null
  }
  return { model: spec.model, y: Number(spec.y ?? 0) }
}

function whenMatches(when, properties) {
  if (!when) {
    return true
  }
  if (Array.isArray(when.OR)) {
    return when.OR.some((item) => whenMatches(item, properties))
  }
  if (Array.isArray(when.AND)) {
    return when.AND.every((item) => whenMatches(item, properties))
  }
  return Object.entries(when).every(([key, value]) => {
    if (key === 'OR' || key === 'AND') {
      return true
    }
    const have = String(properties?.[key] ?? '')
    const want = String(value)
    return have === want || want.split('|').includes(have)
  })
}

export function chooseModelSpecs(state, properties) {
  const props = properties ?? {}
  if (state?.multipart) {
    const specs = []
    for (const part of state.multipart) {
      if (!whenMatches(part.when, props)) {
        continue
      }
      const spec = asSpec(part.apply)
      if (spec) {
        specs.push(spec)
      }
    }
    return specs
  }
  const variants = state?.variants
  if (!variants || typeof variants !== 'object') {
    return []
  }
  if (variants['']) {
    const spec = asSpec(variants[''])
    return spec ? [spec] : []
  }
  let best = null
  let bestScore = -1
  for (const [key, value] of Object.entries(variants)) {
    const parts = key.split(',').map((part) => part.trim()).filter(Boolean)
    let score = 0
    let ok = true
    for (const part of parts) {
      const eq = part.indexOf('=')
      const name = eq >= 0 ? part.slice(0, eq) : part
      const want = eq >= 0 ? part.slice(eq + 1) : 'true'
      if (String(props[name] ?? '') !== want) {
        ok = false
        break
      }
      score += 1
    }
    if (ok && score > bestScore) {
      best = asSpec(value)
      bestScore = score
    }
  }
  if (best) {
    return [best]
  }
  const first = asSpec(Object.values(variants)[0])
  return first ? [first] : []
}

function rotateY(minX, minZ, maxX, maxZ, deg) {
  const steps = (((deg % 360) + 360) % 360) / 90
  let a = minX
  let b = minZ
  let c = maxX
  let d = maxZ
  for (let i = 0; i < steps; i += 1) {
    const nextA = 1 - d
    const nextB = a
    const nextC = 1 - b
    const nextD = c
    a = nextA
    b = nextB
    c = nextC
    d = nextD
  }
  return {
    minX: Math.min(a, c),
    minZ: Math.min(b, d),
    maxX: Math.max(a, c),
    maxZ: Math.max(b, d),
  }
}

export function boxesFromElements(elements, rotate = 0) {
  const boxes = []
  for (const el of elements ?? []) {
    if (!Array.isArray(el?.from) || !Array.isArray(el?.to)) {
      continue
    }
    const minX = Math.min(el.from[0], el.to[0]) / 16
    const minY = Math.min(el.from[1], el.to[1]) / 16
    const minZ = Math.min(el.from[2], el.to[2]) / 16
    const maxX = Math.max(el.from[0], el.to[0]) / 16
    const maxY = Math.max(el.from[1], el.to[1]) / 16
    const maxZ = Math.max(el.from[2], el.to[2]) / 16
    const spun = rotateY(minX, minZ, maxX, maxZ, rotate)
    boxes.push({
      minX: spun.minX,
      minY,
      minZ: spun.minZ,
      maxX: spun.maxX,
      maxY,
      maxZ: spun.maxZ,
    })
  }
  return boxes
}

export function collectElements(name, readModel, seen = new Set()) {
  const id = String(name ?? '').replace(/^minecraft:/, '')
  if (!id || seen.has(id)) {
    return []
  }
  seen.add(id)
  const json = readModel(id)
  if (!json) {
    return []
  }
  if (Array.isArray(json.elements) && json.elements.length) {
    return json.elements
  }
  return json.parent ? collectElements(json.parent, readModel, seen) : []
}

export function boxesFromState(state, properties, readModel) {
  const boxes = []
  for (const spec of chooseModelSpecs(state, properties)) {
    const elements = collectElements(spec.model, readModel)
    boxes.push(...boxesFromElements(elements, spec.y ?? 0))
  }
  return boxes
}
