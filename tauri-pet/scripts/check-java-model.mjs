import {
  degreeVec,
  entityCube,
  faceCorner,
  missingFaceUv,
  posVec,
  readBlockModel,
  sampleAnimation,
  scaleVec,
} from '../src/mc/java-model.js'

function assert(ok, message) {
  if (!ok) {
    throw new Error(message)
  }
}

function near(value, expected, message) {
  if (Math.abs(value - expected) > 1e-4) {
    throw new Error(`${message}: ${value} != ${expected}`)
  }
}

const cube = readBlockModel({
  textures: { particle: 'minecraft:block/stone', all: '#particle' },
  elements: [{
    from: [0, 0, 0],
    to: [16, 16, 16],
    faces: {
      down: { texture: '#all' },
      up: { texture: '#all', uv: [0, 0, 8, 8], rotation: 90 },
    },
  }],
})
assert(cube.elements[0].faces.down.uv.join() === missingFaceUv([0, 0, 0], [16, 16, 16], 'down').join(), 'down uv filled from the element box')
assert(faceCorner(cube.elements[0].faces.up.uv, 90, 0).join() === '0,8', 'uv rotation 90 moves corner 0')

let failed = false
try {
  readBlockModel({ elements: [{ from: [0, 0, 0], to: [16, 16, 16], faces: { north: { texture: '#a', rotation: 45 } } }] })
} catch (error) {
  failed = String(error.message).includes('only 0/90/180/270')
}
assert(failed, 'face uv rotation rejects 45')

const box = entityCube({ x: 0, y: 0, z: 0, width: 8, height: 8, depth: 8, u: 0, v: 0, texWidth: 64, texHeight: 32 })
const down = box.faces.find((face) => face.face === 'down')
near(down.vertices[0].u, 16 / 64, 'down u0')
near(down.vertices[1].u, 8 / 64, 'down u1')
near(down.vertices[0].v, 0, 'down v0')
near(down.vertices[2].v, 8 / 32, 'down v2')

const pose = sampleAnimation({
  length: 1,
  loop: true,
  bones: {
    head: [{
      target: 'rotation',
      keyframes: [
        { time: 0, ...Object.fromEntries(['x', 'y', 'z'].map((key, index) => [key, degreeVec(0, 0, 0)[index]])) },
        { time: 1, x: degreeVec(0, 90, 0)[0], y: degreeVec(0, 90, 0)[1], z: degreeVec(0, 90, 0)[2], interpolation: 'linear' },
      ],
    }],
  },
}, 0.5)
near(pose.head.rotation[1], (Math.PI / 2) * 0.5, 'linear yaw at halfway')
near(posVec(1, 2, 3)[1], -2, 'position keyframes negate Y')
near(scaleVec(1, 2, 1)[1], 1, 'scale keyframes are stored relative to 1')

console.log('java model reader ok')
