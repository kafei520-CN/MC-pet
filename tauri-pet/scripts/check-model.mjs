import { BedrockModel } from '@bedrock-viewer/model-viewer'
import fs from 'node:fs'

function parseMinecraftJson(text) {
  return JSON.parse(text.replace(/^\s*\/\/.*$/gm, ''))
}

const geometry = parseMinecraftJson(fs.readFileSync('public/vanilla/humanoid.custom.geo.json', 'utf8'))
const anim = parseMinecraftJson(fs.readFileSync('public/vanilla/player.animation.json', 'utf8'))
console.log(BedrockModel.listGeometryNames(geometry).join(','))
const clip = BedrockModel.loadAnimationClip(anim, 'animation.player.move.legs')
console.log(clip.name)
console.log([...clip.bones.keys()].join(','))
