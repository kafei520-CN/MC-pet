import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

function assert(ok, message) {
  if (!ok) {
    throw new Error(message)
  }
}

const chestTop = 14 / 16
const fullTop = 1
const lip = fullTop - chestTop
const stepHeight = 0.5
const minStep = 0.04

assert(lip > minStep, `chest lip ${lip} is a step, not a crack`)
assert(lip <= stepHeight, `chest lip ${lip} is within step height`)
assert(lip <= 0.2, 'the old 0.2 gate ignored chest-to-full-block steps')

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/mc/move.js'), 'utf8')
assert(src.includes('rise > 0.04'), 'findClimbWall accepts a short lip')
assert(!src.includes('rise > 0.2 &&'), 'findClimbWall no longer ignores lips under 0.2')
assert(src.includes('stepOnto'), 'x-hits retry a step onto the full block')

console.log('step ok')
