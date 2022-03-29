import {
  readImageFile,
  readImageDICOMFileSeries,
  readMeshFile,
  FloatTypes,
  getFileExtension,
  meshToPolyData,
} from 'itk-wasm'
// Todo: import from itk-wasm
const extensionToMeshIO = new Map([
  ['vtk', 'VTKPolyDataMeshIO'],
  ['VTK', 'VTKPolyDataMeshIO'],
  ['byu', 'BYUMeshIO'],
  ['BYU', 'BYUMeshIO'],
  ['fsa', 'FreeSurferAsciiMeshIO'],
  ['FSA', 'FreeSurferAsciiMeshIO'],
  ['fsb', 'FreeSurferBinaryMeshIO'],
  ['FSB', 'FreeSurferBinaryMeshIO'],
  ['obj', 'OBJMeshIO'],
  ['OBJ', 'OBJMeshIO'],
  ['off', 'OFFMeshIO'],
  ['OFF', 'OFFMeshIO'],
  ['stl', 'STLMeshIO'],
  ['STL', 'STLMeshIO'],
  ['iwm', 'WASMMeshIO'],
  ['iwm.cbor', 'WASMMeshIO'],
  ['iwm.cbor.zstd', 'WASMZstdMeshIO'],
])
import vtk from 'vtk.js/Sources/vtk'
import vtkXMLPolyDataReader from 'vtk.js/Sources/IO/XML/XMLPolyDataReader'
import vtkXMLImageDataReader from 'vtk.js/Sources/IO/XML/XMLImageDataReader'
import PromiseFileReader from 'promise-file-reader'

import vtkITKHelper from 'vtk.js/Sources/Common/DataModel/ITKHelper'

import UserInterface from '../UserInterface'
import createViewer from '../createViewer'

function typedArrayForBuffer(typedArrayType, buffer) {
  let typedArrayFunction = null
  if (typeof window !== 'undefined') {
    // browser
    typedArrayFunction = window[typedArrayType]
  } else {
    typedArrayFunction = global[typedArrayType]
  }
  return new typedArrayFunction(buffer)
}

export const processFiles = async (
  container,
  { files, image, labelImage, config, labelImageNames, rotate, use2D }
) => {
  UserInterface.emptyContainer(container)
  UserInterface.createLoadingProgress(container)
  const viewerConfig = await readFiles({
    files,
    image,
    labelImage,
    labelImageNames,
    use2D,
  })
  viewerConfig.config = config
  viewerConfig.rotate = rotate
  return createViewer(container, viewerConfig)
}

export const readFiles = async ({
  files,
  image,
  labelImage,
  labelImageNames,
  rotate,
  use2D,
}) => {
  let readDICOMSeries = readImageDICOMFileSeries
  if (files.length < 2 || !!!image) {
    readDICOMSeries = function() {
      return Promise.reject('Skip DICOM series read attempt')
    }
  }
  try {
    const { image: itkImage, webWorkerPool } = await readDICOMSeries(files)
    itkImage.name = files[0].name
    const is3D = itkImage.imageType.dimension === 3 && !use2D
    return {
      image: itkImage,
      labelImage,
      use2D: !is3D,
    }
  } catch (error) {
    const readers = Array.from(files).map(async file => {
      const extension = getFileExtension(file.name)
      if (extension === 'vti') {
        return PromiseFileReader.readAsArrayBuffer(file).then(fileContents => {
          const vtiReader = vtkXMLImageDataReader.newInstance()
          vtiReader.parseAsArrayBuffer(fileContents)
          const vtkImage = vtiReader.getOutputData(0)
          const itkImage = vtkITKHelper.convertVtkToItkImage(vtkImage)
          return Promise.resolve({
            is3D: true,
            data: itkImage,
          })
        })
      } else if (extension === 'vtp') {
        return PromiseFileReader.readAsArrayBuffer(file).then(fileContents => {
          const vtpReader = vtkXMLPolyDataReader.newInstance()
          vtpReader.parseAsArrayBuffer(fileContents)
          const polyData = vtpReader.getOutputData(0)
          return Promise.resolve({
            is3D: true,
            data: polyData,
          })
        })
      } else if (extensionToMeshIO.has(extension)) {
        let is3D = true
        try {
          const read0 = performance.now()
          const { mesh: itkMesh, webWorker } = await readMeshFile(null, file)
          const read1 = performance.now()
          const duration = Number(read1 - read0)
            .toFixed(1)
            .toString()
          const { polyData: itkPolyData } = await meshToPolyData(
            webWorker,
            itkMesh
          )
          console.log('Mesh reading took ' + duration + ' milliseconds.')
          webWorker.terminate()
          const polyData = vtkITKHelper.convertItkToVtkPolyData(itkPolyData)
          return { is3D, data: vtk(polyData) }
        } catch (error) {
          return readImageFile(null, file)
            .then(({ image: itkImage, webWorker }) => {
              webWorker.terminate()
              is3D = itkImage.imageType.dimension === 3 && !use2D
              return Promise.resolve({ is3D, data: itkImage })
            })
            .catch(error => {
              return Promise.reject(error)
            })
        }
      }
      const { image: itkImage, webWorker } = await readImageFile(null, file)
      itkImage.name = file.name
      webWorker.terminate()
      const is3D = itkImage.imageType.dimension === 3 && !use2D
      return { is3D, data: itkImage }
    })
    const dataSets = await Promise.all(readers)
    const images = dataSets
      .filter(({ data }) => !!data && data.imageType !== undefined)
      .map(({ data }) => data)

    let labelImageNameData = null
    if (!!labelImageNames) {
      labelImageNameData = new Map(labelImageNames)
    }
    if (images.length > 0) {
      for (let index = 0; index < images.length; index++) {
        const componentType = images[index].imageType.componentType
        if (!!!labelImage) {
          // Only integer-based pixels considered for label maps
          if (
            componentType === FloatTypes.Float32 ||
            componentType === FloatTypes.Float64
          ) {
            if (!!!image) {
              image = images[index]
            }
            continue
          }
          const data = images[index].data
          const uniqueLabels = new Set(data).size
          // If there are more values than this, it will not be considered a
          // label map
          const maxLabelsInLabelImage = 64
          if (uniqueLabels <= maxLabelsInLabelImage) {
            labelImage = images[index]
          } else {
            image = images[index]
          }
        } else if (!!!image) {
          image = images[index]
        }
      }
    }
    const geometries = dataSets
      .filter(({ data }) => {
        return (
          !!data &&
          data.isA !== undefined &&
          data.isA('vtkPolyData') &&
          !!(
            data.getPolys().getNumberOfValues() ||
            data.getLines().getNumberOfValues() ||
            data.getStrips().getNumberOfValues()
          )
        )
      })
      .map(({ data }) => data)
    const pointSets = dataSets
      .filter(({ data }) => {
        return (
          !!data &&
          data.isA !== undefined &&
          data.isA('vtkPolyData') &&
          !!!(
            data.getPolys().getNumberOfValues() ||
            data.getLines().getNumberOfValues() ||
            data.getStrips().getNumberOfValues()
          )
        )
      })
      .map(({ data }) => data)
    let any3D = !dataSets.map(({ is3D }) => is3D).every(is3D => !is3D)
    any3D = !!image ? any3D || image.imageType.dimension === 3 : any3D
    any3D = !!labelImage ? any3D || labelImage.imageType.dimension === 3 : any3D

    return {
      image,
      labelImage,
      labelImageNames: labelImageNameData,
      geometries,
      pointSets,
      use2D: use2D || !any3D,
    }
  }
}
