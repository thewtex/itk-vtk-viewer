import style from '../ItkVtkViewer.module.css'

import applyContrastSensitiveStyleToElement from '../applyContrastSensitiveStyleToElement'
import {
  visibleIconDataUri,
  invisibleIconDataUri,
  imageIconDataUri,
  labelsIconDataUri,
} from 'itk-viewer-icons'

function createLayerEntry(context, name, layer) {
  const layerEntry = document.createElement('div')
  layerEntry.setAttribute('class', style.layerEntryCommon)
  layerEntry.style.borderWidth = '3px'
  applyContrastSensitiveStyleToElement(context, 'layerEntry', layerEntry)

  const visibleButton = document.createElement('div')
  visibleButton.innerHTML = `<input id="${context.id}-visibleButton" type="checkbox" checked class="${style.toggleInput}"><label itk-vtk-tooltip itk-vtk-tooltip-top-annotations itk-vtk-tooltip-content="Visibility" class="${style.visibleButton} ${style.toggleButton}" for="${context.id}-visibleButton"><img src="${visibleIconDataUri}" alt="visible"/></label>`
  const visibleButtonInput = visibleButton.children[0]
  const visibleLabel = visibleButton.children[1]
  applyContrastSensitiveStyleToElement(
    context,
    'invertibleButton',
    visibleLabel
  )
  layerEntry.appendChild(visibleButton)
  const invisibleButton = document.createElement('div')
  invisibleButton.innerHTML = `<input id="${context.id}-invisibleButton" type="checkbox" class="${style.toggleInput}"><label itk-vtk-tooltip itk-vtk-tooltip-top-annotations itk-vtk-tooltip-content="Visibility" class="${style.visibleButton} ${style.toggleButton}" for="${context.id}-invisibleButton"><img src="${invisibleIconDataUri} alt="invisible""/></label>`
  const invisibleButtonInput = invisibleButton.children[0]
  const invisibleLabel = invisibleButton.children[1]
  applyContrastSensitiveStyleToElement(
    context,
    'invertibleButton',
    invisibleLabel
  )
  layerEntry.appendChild(invisibleButton)

  if (layer.visible) {
    visibleButton.style.display = 'flex'
    invisibleButton.style.display = 'none'
  } else {
    visibleButton.style.display = 'none'
    invisibleButton.style.display = 'flex'
  }

  visibleButton.addEventListener('click', event => {
    event.preventDefault()
    event.stopPropagation()
    context.service.send({ type: 'TOGGLE_LAYER_VISIBILITY', data: name })
    visibleButton.checked = true
  })
  invisibleButton.addEventListener('click', event => {
    event.preventDefault()
    event.stopPropagation()
    context.service.send({ type: 'TOGGLE_LAYER_VISIBILITY', data: name })
    invisibleButton.checked = false
  })

  const layerLabel = document.createElement('label')
  layerLabel.setAttribute('class', `${style.layerLabelCommon}`)
  applyContrastSensitiveStyleToElement(context, 'layerLabel', layerLabel)
  layerLabel.innerText = name
  // Above icon select
  layerLabel.style.zIndex = '2500'
  layerLabel.setAttribute('itk-vtk-tooltip', '')
  layerLabel.setAttribute('itk-vtk-tooltip-bottom', '')
  layerEntry.appendChild(layerLabel)

  function imageDescription() {
    const multiscaleSpatialImage = context.layers.lastAddedData.data
    let result = `Type: ${JSON.stringify(multiscaleSpatialImage.imageType)}`
    return result
  }

  const iconElement = document.createElement('div')
  switch (layer.type) {
    case 'image': {
      iconElement.innerHTML = `<img src="${imageIconDataUri}" alt="image"/>`
      const description = imageDescription()
      layerLabel.setAttribute(
        'itk-vtk-tooltip-content',
        `Image: ${name} ${description}`
      )
      break
    }
    case 'labelImage': {
      iconElement.innerHTML = `<img src="${labelsIconDataUri}" alt="labels"/>`
      const description = imageDescription()
      layerLabel.setAttribute(
        'itk-vtk-tooltip-content',
        `Label image: ${name} ${description}`
      )
      break
    }
    default:
      throw new Error(`Unsupported layer type: ${layer.type}`)
  }
  iconElement.setAttribute('class', style.layerIcon)
  applyContrastSensitiveStyleToElement(context, 'invertibleButton', iconElement)
  layerEntry.appendChild(iconElement)

  layerEntry.addEventListener('click', event => {
    event.preventDefault()
    context.service.send({ type: 'SELECT_LAYER', data: name })
  })

  return layerEntry
}

function createLayerInterface(context, event) {
  const name = context.layers.lastAddedData.name
  const layer = context.layers.actorContext.get(name)
  const layersUIGroup = context.layers.layersUIGroup

  let layerEntry = null
  const numRows = layersUIGroup.children.length
  for (let row = 0; row < numRows; row++) {
    const uiRow = layersUIGroup.children[row]
    if (uiRow.children.length < 2) {
      console.log(context, name, layer)
      layerEntry = createLayerEntry(context, name, layer)
      uiRow.appendChild(layerEntry)
    }
  }
  if (!!!layerEntry) {
    addLayerUIRow(context)
    const uiRow = layersUIGroup[layersUIGroup.children.length - 1]
    layerEntry = createLayerEntry(context, name, layer)
    uiRow.appendChild(layerEntry)
  }

  context.layers.uiLayers.set(name, layerEntry)
}

export default createLayerInterface
