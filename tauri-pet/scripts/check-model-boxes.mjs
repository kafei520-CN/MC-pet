import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { boxesFromElements, boxesFromState, collectElements } from '../src/mc/model-shape.js'

function assert(cond, message) {
  if (!cond) {
    throw new Error(message)
  }
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'minecraft')
const models = new Map()

function readModel(name) {
  const id = String(name).replace(/^minecraft:/, '')
  if (models.has(id)) {
    return models.get(id)
  }
  const rel = id.includes('/') ? id : `block/${id}`
  const json = JSON.parse(readFileSync(join(root, 'models', `${rel}.json`), 'utf8'))
  models.set(id, json)
  models.set(rel, json)
  return json
}

function readState(id) {
  return JSON.parse(readFileSync(join(root, 'blockstates', `${id}.json`), 'utf8'))
}

const plate = boxesFromElements(readModel('block/pressure_plate_up').elements)
assert(plate.length === 1, 'pressure plate has one box')
assert(plate[0].maxY === 1 / 16, `pressure plate height ${plate[0].maxY}`)
assert(plate[0].minX === 1 / 16 && plate[0].maxX === 15 / 16, 'pressure plate inset')

const table = boxesFromElements(readModel('block/enchanting_table').elements)
assert(table[0].maxY === 12 / 16, `enchanting table height ${table[0].maxY}`)

const anvil = boxesFromElements(collectElements('block/anvil', readModel))
assert(anvil.length === 4, `anvil parts ${anvil.length}`)
assert(anvil.some((box) => box.minY === 0 && box.maxY === 4 / 16), 'anvil base')
assert(anvil.some((box) => box.maxY === 1), 'anvil top')

const stone = boxesFromState(readState('stone'), {}, readModel)
assert(stone.length === 1 && stone[0].minY === 0 && stone[0].maxY === 1, 'stone is a full cube')

const powered = boxesFromState(readState('stone_pressure_plate'), { powered: 'false' }, readModel)
assert(powered[0].maxY === 1 / 16, 'unpowered plate uses the up model')

console.log('model box checks ok')
