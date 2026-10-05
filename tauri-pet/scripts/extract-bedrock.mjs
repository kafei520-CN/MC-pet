import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const MAGIC = Buffer.from([0x7d, 0x27, 0x25, 0xb1, 0xa0, 0x52, 0x70, 0x26])
const PACKS = 'C:\\XboxGames\\Minecraft for Windows\\Content\\data\\resource_packs'
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/vanilla/bedrock')

function readArchive(file) {
  const buf = fs.readFileSync(file)
  if (buf.length < 16 || !buf.subarray(0, 8).equals(MAGIC)) {
    return []
  }
  const count = buf.readUInt32LE(8)
  const version = buf.readUInt32LE(12)
  if (version !== 1) {
    return []
  }
  const contentBase = 16 + count * 256
  const files = []
  for (let i = 0; i < count; i += 1) {
    const off = 16 + i * 256
    const nameLen = buf[off]
    const name = buf.subarray(off + 1, off + 1 + nameLen).toString('utf8')
    const dataOff = buf.readUInt32LE(off + 248)
    const dataLen = buf.readUInt32LE(off + 252)
    files.push({
      name,
      data: Buffer.from(buf.subarray(contentBase + dataOff, contentBase + dataOff + dataLen)),
    })
  }
  return files
}

function writeArchive(entries) {
  const list = [...entries].sort((a, b) => a.name.localeCompare(b.name))
  const header = Buffer.alloc(16)
  MAGIC.copy(header, 0)
  header.writeUInt32LE(list.length, 8)
  header.writeUInt32LE(1, 12)
  const toc = Buffer.alloc(list.length * 256)
  const chunks = []
  let offset = 0
  list.forEach((entry, index) => {
    const name = Buffer.from(entry.name, 'utf8')
    if (name.length > 247) {
      throw new Error(`name too long ${entry.name}`)
    }
    const off = index * 256
    toc[off] = name.length
    name.copy(toc, off + 1)
    toc.writeUInt32LE(offset, off + 248)
    toc.writeUInt32LE(entry.data.length, off + 252)
    chunks.push(entry.data)
    offset += entry.data.length
  })
  return Buffer.concat([header, toc, ...chunks])
}

function packRank(name) {
  if (name === 'vanilla') {
    return 99999
  }
  const match = name.match(/^vanilla_(\d+)\.(\d+)(?:\.(\d+))?$/)
  if (!match) {
    return -1
  }
  return Number(match[1]) * 10000 + Number(match[2]) * 100 + Number(match[3] || 0)
}

function take(map, file) {
  if (!fs.existsSync(file)) {
    return 0
  }
  const entries = readArchive(file)
  for (const entry of entries) {
    map.set(entry.name, entry.data)
  }
  return entries.length
}

if (!fs.existsSync(PACKS)) {
  throw new Error(`Bedrock packs not found: ${PACKS}`)
}

const packs = fs.readdirSync(PACKS)
  .map((name) => ({ name, rank: packRank(name) }))
  .filter((pack) => pack.rank >= 0)
  .sort((a, b) => a.rank - b.rank)

const merged = {
  entity: new Map(),
  animations: new Map(),
  models: new Map(),
}

for (const pack of packs) {
  const br = path.join(PACKS, pack.name, '__brarchive')
  take(merged.entity, path.join(br, 'entity.brarchive'))
  take(merged.animations, path.join(br, 'animations.brarchive'))
  take(merged.models, path.join(br, 'models', 'entity.brarchive'))
  take(merged.models, path.join(br, 'models.brarchive'))
}

fs.mkdirSync(OUT, { recursive: true })
for (const [kind, map] of Object.entries(merged)) {
  const buf = writeArchive([...map].map(([name, data]) => ({ name, data })))
  fs.writeFileSync(path.join(OUT, `${kind}.brarchive`), buf)
  console.log(kind, map.size, 'files', buf.length, 'bytes')
}
