const TAGS = {
  'minecraft:planks': [
    'oak_planks', 'spruce_planks', 'birch_planks', 'jungle_planks', 'acacia_planks',
    'dark_oak_planks', 'mangrove_planks', 'cherry_planks', 'bamboo_planks', 'crimson_planks', 'warped_planks',
  ],
  'minecraft:logs': [
    'oak_log', 'spruce_log', 'birch_log', 'jungle_log', 'acacia_log', 'dark_oak_log',
    'mangrove_log', 'cherry_log', 'crimson_stem', 'warped_stem',
  ],
  'minecraft:coals': ['coal', 'charcoal'],
}

function bare(value) {
  return String(value ?? '').replace(/^minecraft:/, '')
}

function options(entry) {
  if (!entry) {
    return []
  }
  if (typeof entry === 'string') {
    return [bare(entry)]
  }
  if (Array.isArray(entry)) {
    return entry.flatMap(options)
  }
  if (entry.tag) {
    return TAGS[entry.tag] ?? TAGS[`minecraft:${bare(entry.tag)}`] ?? []
  }
  if (entry.item || entry.id) {
    return [bare(entry.item || entry.id)]
  }
  return []
}

function accepts(entry, id) {
  if (!id) {
    return false
  }
  return options(entry).includes(bare(id))
}

function resultOf(recipe) {
  const result = recipe.result
  if (!result) {
    return null
  }
  if (typeof result === 'string') {
    return { id: bare(result), count: recipe.count ?? 1 }
  }
  const id = bare(result.item || result.id)
  if (!id) {
    return null
  }
  return { id, count: result.count ?? 1 }
}

let recipes = []
let loading = null

async function walk(dir) {
  const response = await fetch(`/resource-pack/__list?dir=${encodeURIComponent(dir)}`)
  if (!response.ok) {
    return []
  }
  const names = await response.json()
  const found = []
  for (const name of names) {
    if (name.endsWith('.json')) {
      const file = await fetch(`/resource-pack/${dir}/${name}`)
      if (file.ok) {
        found.push(await file.json())
      }
      continue
    }
    if (!name.includes('.')) {
      found.push(...await walk(`${dir}/${name}`))
    }
  }
  return found
}

export function loadRecipes() {
  if (!loading) {
    loading = walk('minecraft/recipes').then((list) => {
      recipes = list.filter((recipe) => recipe && recipe.type)
      return recipes
    }).catch(() => {
      recipes = []
      return recipes
    })
  }
  return loading
}

function patternAt(grid, recipe, ox, oy) {
  const pattern = recipe.pattern ?? []
  const height = pattern.length
  const width = Math.max(...pattern.map((row) => row.length))
  if (ox + width > 3 || oy + height > 3) {
    return null
  }
  const used = []
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const id = grid[row * 3 + col]
      const inside = row >= oy && row < oy + height && col >= ox && col < ox + width
      const symbol = inside ? (pattern[row - oy][col - ox] ?? ' ') : ' '
      if (symbol === ' ') {
        if (id) {
          return null
        }
        continue
      }
      if (!accepts(recipe.key?.[symbol], id)) {
        return null
      }
      used.push(row * 3 + col)
    }
  }
  return used
}

export function matchCraft(grid) {
  for (const recipe of recipes) {
    if (recipe.type !== 'minecraft:crafting_shaped') {
      continue
    }
    const height = recipe.pattern?.length ?? 0
    const width = Math.max(0, ...((recipe.pattern ?? []).map((row) => row.length)))
    for (let oy = 0; oy <= 3 - height; oy += 1) {
      for (let ox = 0; ox <= 3 - width; ox += 1) {
        const used = patternAt(grid, recipe, ox, oy)
        if (used) {
          return { result: resultOf(recipe), used }
        }
      }
    }
  }
  const filled = grid.map((id, index) => (id ? index : -1)).filter((index) => index >= 0)
  for (const recipe of recipes) {
    if (recipe.type !== 'minecraft:crafting_shapeless') {
      continue
    }
    const needs = recipe.ingredients ?? []
    if (needs.length !== filled.length) {
      continue
    }
    const pool = filled.map((index) => grid[index])
    const used = []
    let ok = true
    for (const need of needs) {
      const found = pool.findIndex((id, index) => !used.includes(index) && accepts(need, id))
      if (found < 0) {
        ok = false
        break
      }
      used.push(found)
    }
    if (ok) {
      return { result: resultOf(recipe), used: used.map((index) => filled[index]) }
    }
  }
  return null
}

export function matchCook(kind, id) {
  const types = {
    furnace: 'minecraft:smelting',
    blast_furnace: 'minecraft:blasting',
    smoker: 'minecraft:smoking',
  }
  const type = types[kind]
  if (!type || !id) {
    return null
  }
  const recipe = recipes.find((entry) => entry.type === type && accepts(entry.ingredient, id))
  if (!recipe) {
    return null
  }
  return {
    result: resultOf(recipe),
    time: recipe.cookingtime ?? (kind === 'furnace' ? 200 : 100),
  }
}

export function matchSmithing(template, base, addition) {
  const recipe = recipes.find((entry) => entry.type === 'minecraft:smithing_transform'
    && accepts(entry.template, template)
    && accepts(entry.base, base)
    && accepts(entry.addition, addition))
  return recipe ? resultOf(recipe) : null
}

export function fuelTime(id) {
  const name = bare(id)
  if (name === 'coal' || name === 'charcoal' || name === 'coal_block') {
    return name === 'coal_block' ? 16000 : 1600
  }
  if (name.endsWith('_planks') || name === 'bamboo_planks') {
    return 300
  }
  if (name.endsWith('_log') || name.endsWith('_wood') || name.endsWith('_stem')) {
    return 300
  }
  if (name === 'stick') {
    return 100
  }
  return 0
}
