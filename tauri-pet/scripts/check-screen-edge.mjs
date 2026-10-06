import { resolveEdgeX, rimClimbFace, stepScreenRim } from '../src/mc/screen-edge.js'

function assert(ok, message) {
  if (!ok) {
    throw new Error(message)
  }
}

const screenW = 1912

assert(resolveEdgeX(-200, screenW) === 8, 'past the left stays on the left bezel')
assert(resolveEdgeX(screenW + 200, screenW) === screenW - 8, 'past the right stays on the right bezel')
assert(resolveEdgeX(900, screenW) === 900, 'an on-screen x is unchanged')

const outLeft = stepScreenRim({ x: 8, screenW, keys: { a: true } })
assert(outLeft.climb === 'left' && outLeft.x === 8, `A at the left bezel climbs, got ${JSON.stringify(outLeft)}`)
assert(rimClimbFace('left') === -1, 'the left bezel climb faces the left wall')

const backLeft = stepScreenRim({ x: 8, screenW, keys: { d: true } })
assert(backLeft.climb == null, `D at the left bezel walks inward, got ${JSON.stringify(backLeft)}`)

const outRight = stepScreenRim({ x: screenW - 8, screenW, keys: { d: true } })
assert(outRight.climb === 'right' && outRight.x === screenW - 8, `D at the right bezel climbs, got ${JSON.stringify(outRight)}`)
assert(rimClimbFace('right') === 1, 'the right bezel climb faces the right wall')

const backRight = stepScreenRim({ x: screenW - 8, screenW, keys: { a: true } })
assert(backRight.climb == null, `A at the right bezel walks inward, got ${JSON.stringify(backRight)}`)

const mid = stepScreenRim({ x: 900, screenW, keys: { a: true } })
assert(mid.climb == null, 'A in the middle of the screen does not climb')

console.log('screen-edge ok')
