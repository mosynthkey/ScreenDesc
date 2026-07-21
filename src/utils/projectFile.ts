import type {
  Annotation,
  AnnotationMode,
  LineStyleId,
  Section,
  TextStylePreset,
} from '../types/annotation'
import type { OcrLineHit } from './ocr'
import { t } from '../i18n'

const FILE_VERSION = 1
const FILE_EXTENSION = '.screendesc.json'

export interface ProjectFileData {
  version: 1
  imageDataUrl: string
  imageWidth: number
  imageHeight: number
  sections: Section[]
  annotations: Annotation[]
  ocrLines: OcrLineHit[]
  defaultAnnotationMode: AnnotationMode
  defaultTextStyle: TextStylePreset
  defaultFontFamily: string
  lineStyle: LineStyleId
  lineColor: string
  dotColor: string
  dotRadius: number
  lineHalo: boolean
  calloutFontSize: number
  calloutBorderWidth: number
  showSections: boolean
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error(t('error.imageReadFailed')))
    reader.readAsDataURL(blob)
  })
}

export async function buildProjectFile(
  imageBlob: Blob,
  fields: Omit<ProjectFileData, 'version' | 'imageDataUrl'>,
): Promise<Blob> {
  const imageDataUrl = await blobToDataUrl(imageBlob)
  const data: ProjectFileData = {
    version: FILE_VERSION,
    imageDataUrl,
    ...fields,
  }
  return new Blob([JSON.stringify(data)], { type: 'application/json' })
}

export function suggestProjectFileName(): string {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
  return `screendesc-${stamp}${FILE_EXTENSION}`
}

export async function parseProjectFile(file: File): Promise<ProjectFileData> {
  const text = await file.text()
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(t('error.projectFileInvalidJson'))
  }
  if (
    !data ||
    typeof data !== 'object' ||
    (data as ProjectFileData).version !== FILE_VERSION ||
    typeof (data as ProjectFileData).imageDataUrl !== 'string'
  ) {
    throw new Error(t('error.projectFileUnsupported'))
  }
  return data as ProjectFileData
}
