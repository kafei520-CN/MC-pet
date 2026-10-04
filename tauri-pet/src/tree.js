function selector(nodes) {
  return (ctx) => {
    for (const node of nodes) {
      const result = node(ctx)
      if (result) {
        return result
      }
    }
    return null
  }
}

const petTree = selector([
  (ctx) => (ctx.holding ? 'dragging' : null),
  (ctx) => (ctx.phase === 'ragdoll' ? 'ragdoll' : null),
  (ctx) => (ctx.phase === 'glance' ? 'glance' : null),
  (ctx) => (ctx.windowGone ? 'window-gone' : null),
  (ctx) => (ctx.falling ? 'fall' : null),
  (ctx) => (ctx.phase === 'leap' ? 'leap' : null),
  (ctx) => (ctx.phase === 'look' ? 'look' : null),
  (ctx) => (ctx.locked ? 'menu' : null),
  (ctx) => (ctx.menuSleep && !ctx.sitting ? 'sleep' : null),
  (ctx) => {
    if (!ctx.sitting) {
      return null
    }
    if (ctx.windowGone) {
      return 'window-gone'
    }
    if (ctx.sitCalm > ctx.sitWait) {
      return 'sit-bored'
    }
    return 'sit'
  },
  (ctx) => (ctx.wander ? 'walk' : null),
  (ctx) => (ctx.calm > ctx.idleWait ? 'wander' : null),
  () => 'idle',
])

export function choosePetAction(ctx) {
  return petTree(ctx)
}
