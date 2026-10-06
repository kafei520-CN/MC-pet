import * as THREE from 'three'
import { bareId } from './ids.js'

const PARTICLE_COUNT = 12
const LIFE = 0.62

const COLORS = {
  stone: 0x8b8b8b,
  dirt: 0x8a5a38,
  grass: 0x70a34b,
  wood: 0x9a6a3d,
  sand: 0xd8c080,
  snow: 0xf2f5f5,
  glass: 0xb9e7ee,
  metal: 0xb7b7b7,
  red: 0xb84638,
  purple: 0x8f6db2,
}

function colorFor(id) {
  const name = bareId(id)
  if (name.includes('glass') || name.includes('ice')) return COLORS.glass
  if (name.includes('snow')) return COLORS.snow
  if (name.includes('sand')) return COLORS.sand
  if (name.includes('wood') || name.includes('log') || name.includes('planks') || name.includes('sign')) return COLORS.wood
  if (name.includes('grass') || name.includes('leaves') || name.includes('moss') || name.includes('plant')) return COLORS.grass
  if (name.includes('dirt') || name.includes('mud') || name.includes('clay')) return COLORS.dirt
  if (name.includes('copper') || name.includes('iron') || name.includes('gold') || name.includes('chain')) return COLORS.metal
  if (name.includes('redstone') || name.includes('nether')) return COLORS.red
  if (name.includes('purpur') || name.includes('amethyst')) return COLORS.purple
  return COLORS.stone
}

export function createParticles(root) {
  const group = new THREE.Group()
  group.name = 'mcBreakParticles'
  root.add(group)
  const geometry = new THREE.BoxGeometry(3, 3, 3)
  const active = []

  function burst(id, cells) {
    const color = colorFor(id)
    for (const cell of cells ?? []) {
      const cx = (cell.x + 0.5) * 16
      const cy = (cell.y + 0.5) * 16
      const cz = (cell.z ?? 0) * 16 + 8
      for (let index = 0; index < PARTICLE_COUNT; index += 1) {
        const material = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
        })
        const mesh = new THREE.Mesh(geometry, material)
        mesh.renderOrder = 10
        mesh.position.set(
          cx + (Math.random() - 0.5) * 13,
          cy + (Math.random() - 0.5) * 13,
          cz + (Math.random() - 0.5) * 13,
        )
        mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3)
        group.add(mesh)
        active.push({
          mesh,
          age: Math.random() * 0.08,
          velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 24,
            12 + Math.random() * 34,
            (Math.random() - 0.5) * 24,
          ),
          spin: new THREE.Vector3(
            (Math.random() - 0.5) * 7,
            (Math.random() - 0.5) * 7,
            (Math.random() - 0.5) * 7,
          ),
        })
      }
    }
  }

  function tick(delta) {
    const dt = Math.min(0.05, Math.max(0, Number(delta) || 0))
    for (let index = active.length - 1; index >= 0; index -= 1) {
      const particle = active[index]
      particle.age += dt
      if (particle.age >= LIFE) {
        particle.mesh.removeFromParent()
        particle.mesh.material.dispose()
        active.splice(index, 1)
        continue
      }
      particle.velocity.y -= 58 * dt
      particle.mesh.position.addScaledVector(particle.velocity, dt)
      particle.mesh.rotation.x += particle.spin.x * dt
      particle.mesh.rotation.y += particle.spin.y * dt
      particle.mesh.rotation.z += particle.spin.z * dt
      particle.mesh.material.opacity = 0.9 * (1 - particle.age / LIFE)
    }
  }

  return {
    burst,
    tick,
    dispose() {
      for (const particle of active) {
        particle.mesh.material.dispose()
      }
      geometry.dispose()
      root.remove(group)
      active.length = 0
    },
  }
}
