import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Object3D, Vector3 } from 'three'
import { BedrockModel } from '@bedrock-viewer/model-viewer'
import colors from '../src/mc/data/spawn-egg-colors-1.20.1.json' with { type: 'json' }
import {
  applyEntityMolang,
  geometryFile,
  geometryId,
  indexFromArchives,
  pickClips,
  resolveEntity,
} from '../src/mc/bedrock-pack.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/vanilla/bedrock')
const pack = indexFromArchives({
  entity: fs.readFileSync(path.join(root, 'entity.brarchive')),
  animations: fs.readFileSync(path.join(root, 'animations.brarchive')),
  models: fs.readFileSync(path.join(root, 'models.brarchive')),
})

function must(ok, message) {
  if (!ok) {
    throw new Error(message)
  }
}

const creeper = geometryFile(pack, 'geometry.creeper.v1.8')
must(creeper, 'creeper geo')
must(BedrockModel.listGeometryNames(creeper).includes('geometry.creeper.v1.8'), 'creeper name')
must(creeper['minecraft:geometry'][0].bones.length === 6, 'creeper bones')
const creeperCube = creeper['minecraft:geometry'][0].bones[0].cubes[0]
must(Array.isArray(creeperCube.uv) && creeperCube.uv[0] === 16 && creeperCube.uv[1] === 16, 'creeper vanilla UV')

const chicken = geometryFile(pack, 'geometry.chicken.v1.12')
must(chicken, 'chicken geo')
must(chicken['minecraft:geometry'][0].bones.some((bone) => bone.cubes?.[0]?.uv), 'chicken UV')

const witch = geometryFile(pack, 'geometry.villager.witch.v1.8')
must(witch, 'witch geo')
must(witch['minecraft:geometry'][0].bones.length > 5, `witch inherited bones ${witch['minecraft:geometry'][0].bones.length}`)

const legs = pack.clips.get('animation.creeper.legs')
must(legs, 'creeper legs json')
const clip = BedrockModel.loadAnimationClip(legs, 'animation.creeper.legs')
must(clip.name === 'animation.creeper.legs', 'clip name')
must([...clip.bones.keys()].join(',') === 'leg0,leg1,leg2,leg3', 'clip bones')

const model = await BedrockModel.load({
  geometry: creeper,
  geometryName: 'geometry.creeper.v1.8',
})
model.playAnimation(clip)
applyEntityMolang(model, [
  'variable.leg_rot = Math.cos(query.modified_distance_moved * 38.17326) * 80.22 * query.modified_move_speed;',
], {
  modified_distance_moved: 1.2,
  modified_move_speed: 1,
}, { gliding_speed_value: 1 })
model.update(0.05)
must(model.bones.has('head'), 'head bone')
must(model.object3D.scale.x === -1, 'vanilla x-flip')
must(pickClips(resolveEntity(pack, 'creeper')).includes('animation.creeper.legs'), 'creeper walk clip')
const facing = new Object3D()
const front = new Vector3()
facing.rotation.y = Math.atan2(-1, 0)
front.set(0, 0, -1).applyQuaternion(facing.quaternion)
must(front.x > 0.9, `face +x ${front.x}`)
facing.rotation.y = Math.atan2(1, 0)
front.set(0, 0, -1).applyQuaternion(facing.quaternion)
must(front.x < -0.9, `face -x ${front.x}`)
model.dispose()

const missing = []
const noGeo = []
const noClip = []
for (const id of Object.keys(colors)) {
  const type = id.replace(/_spawn_egg$/, '')
  const desc = resolveEntity(pack, type)
  if (!desc) {
    missing.push(type)
    continue
  }
  const geoName = geometryId(desc)
  if (!geometryFile(pack, geoName)) {
    noGeo.push(`${type}:${geoName}`)
    continue
  }
  if (!pickClips(desc).length) {
    noClip.push(type)
  }
}

must(!missing.length, `no entity ${missing.join(',')}`)
must(!noGeo.length, `no geo ${noGeo.join(',')}`)
console.log(`ok geos=${pack.geos.size} entities=${pack.entities.size} clips=${pack.clips.size} eggs=${Object.keys(colors).length} noWalk=${noClip.join(',') || 'none'}`)
