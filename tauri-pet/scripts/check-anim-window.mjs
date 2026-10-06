import { animWindow, pingPong, walkClipTime, walkPhase, walkSpeed } from '../src/mc/anim-window.js'

function near(value, expected, message) {
  if (Math.abs(value - expected) > 1e-4) {
    throw new Error(`${message}: ${value} != ${expected}`)
  }
}

near(animWindow(0), 0, 'idle window is 0')
near(animWindow(1), 1, 'full speed uses the whole clip')
near(animWindow(0.5), 0.5, 'window length is proportional to speed')
near(walkSpeed(1.4), 1.4 / 8, 'current walk speed uses a short center slice')
near(walkPhase(0, 0), 0, 'idle pose is the midline rest')
near(walkClipTime(0, 0, 2), 1, 'idle samples the clip midpoint')
near(pingPong(0), 0, 'ping pong starts at 0')
near(pingPong(0.5), 1, 'ping pong peaks at half loop')
near(pingPong(1 - 1e-9), 0, 'ping pong returns to 0')

const half = Math.PI * 0.5
near(walkClipTime(0, 0.5, 1), 0.25, 'half speed starts at the left of the center slice')
near(walkPhase(0, 0.5), -half, 'half speed phase starts equally left of the midline')

let min = Infinity
let max = -Infinity
for (let i = 0; i < 80; i += 1) {
  const phase = walkPhase(i * 0.2, 0.5)
  min = Math.min(min, phase)
  max = Math.max(max, phase)
}
if (Math.abs(min + half) > 0.12 || Math.abs(max - half) > 0.12) {
  throw new Error(`half-speed phase span ${min}..${max}, want ${-half}..${half}`)
}

let peak = 0
const crawl = walkSpeed(1.4)
for (let i = 0; i < 80; i += 1) {
  peak = Math.max(peak, Math.abs(Math.sin(walkPhase(i * 0.2, crawl))))
}
if (peak > 0.6) {
  throw new Error(`slow walk still reaches run lift: ${peak}`)
}

console.log('anim window ok')
