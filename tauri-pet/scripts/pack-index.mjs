import fs from 'fs'
import path from 'path'
import { packIndexKey } from '../src/mc/pack-key.js'

function inside(base, file) {
  const target = path.resolve(file)
  return target === base || target.startsWith(base + path.sep)
}

export function buildPackIndex(rootDir) {
  const index = {}
  const base = path.resolve(rootDir)

  function walk(abs, rel) {
    let entries
    try {
      entries = fs.readdirSync(abs, { withFileTypes: true })
    } catch {
      return
    }
    const names = []
    const dirs = []
    for (const entry of entries) {
      names.push(entry.name)
      if (entry.isDirectory()) {
        dirs.push(entry.name)
      }
    }
    names.sort()
    dirs.sort()
    index[rel] = names
    for (const name of dirs) {
      const child = path.join(abs, name)
      if (!inside(base, child)) {
        continue
      }
      walk(child, rel ? `${rel}/${name}` : name)
    }
  }

  walk(base, '')
  return index
}

export function listFromIndex(index, dir) {
  const names = index?.[packIndexKey(dir)]
  return Array.isArray(names) ? names.slice() : []
}
