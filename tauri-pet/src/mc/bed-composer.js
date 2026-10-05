import { loadModel, makeModelScene, renderModelScene, resolveModelData } from 'block-model-renderer'

const BED_GUI = {
  rotation: [30, 160, 0],
  translation: [2, 3, 0],
  scale: [0.5325, 0.5325, 0.5325],
}

export function bedColorOf(name) {
  return name === 'bed' ? 'red' : String(name).replace(/_bed$/, '')
}

function withItemGui(model) {
  model.display = { ...(model.display ?? {}), gui: BED_GUI }
  return model
}

export async function renderBedIcon(assets, color, size) {
  const { scene, camera } = await makeModelScene()
  scene.userData.ephemeral = true
  const head = withItemGui(await resolveModelData(assets, {
    model: `block-model-renderer:block/bed/${color}_bed_head`,
    scale: [-1, 1, 1],
  }))
  const foot = withItemGui(await resolveModelData(assets, {
    model: `block-model-renderer:block/bed/${color}_bed_foot`,
    translation: [0, 0, -16],
    scale: [-1, 1, 1],
  }))
  await loadModel(scene, assets, head, { display: 'gui', lighting: 'item' })
  await loadModel(scene, assets, foot, { display: 'gui', lighting: 'item' })
  return renderModelScene(scene, camera, {
    width: size,
    height: size,
    lighting: 'item',
    ignoreAtlases: true,
  })
}
