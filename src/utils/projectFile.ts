import type {
  Annotation,
  LineStyleId,
  NumberStyleId,
  Section,
} from '../types/annotation'
import type { OcrLineHit } from './ocr'
import { t } from '../i18n'
import { DEFAULT_NUMBER_STYLE, isNumberStyleId } from './circledNumbers'
import {
  DEFAULT_LINE_OPACITY,
  normalizeLineHaloColor,
  normalizeLineHaloWidth,
  normalizeLineOpacity,
  normalizeLineStyle,
} from './lineStyle'

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
  defaultFontFamily: string
  lineStyle: LineStyleId
  lineWidth: number
  lineColor: string
  lineOpacity: number
  dotColor: string
  dotRadius: number
  lineHaloWidth: number
  lineHaloColor: string
  calloutFontSize: number
  calloutBorderWidth: number
  numberStyle: NumberStyleId
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

function sanitizeAnnotation(raw: Annotation): Annotation {
  return {
    id: raw.id,
    sectionId: raw.sectionId,
    order: raw.order,
    description: raw.description,
    markerPosition: raw.markerPosition,
    calloutSide: raw.calloutSide,
    calloutPosition: raw.calloutPosition,
  }
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
    annotations: fields.annotations.map(sanitizeAnnotation),
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
  const project = data as ProjectFileData
  if (!isNumberStyleId(project.numberStyle)) {
    project.numberStyle = DEFAULT_NUMBER_STYLE
  }
  const normalizedLine = normalizeLineStyle(project.lineStyle, (project as { lineWidth?: number }).lineWidth)
  project.lineStyle = normalizedLine.lineStyle
  project.lineWidth = normalizedLine.lineWidth
  project.lineOpacity = normalizeLineOpacity(
    (project as { lineOpacity?: number }).lineOpacity ?? DEFAULT_LINE_OPACITY,
  )
  project.lineHaloWidth = normalizeLineHaloWidth(
    (project as { lineHaloWidth?: number }).lineHaloWidth,
    (project as { lineHalo?: boolean }).lineHalo,
  )
  project.lineHaloColor = normalizeLineHaloColor(
    (project as { lineHaloColor?: string }).lineHaloColor,
  )
  project.annotations = (project.annotations ?? []).map(sanitizeAnnotation)
  return project
}
