import type {
  Annotation,
  AnchorStyleId,
  LineStyleId,
  NumberStyleId,
  Section,
} from '../types/annotation'
import type { OcrLineHit } from './ocr'
import { t } from '../i18n'
import { DEFAULT_NUMBER_STYLE, isNumberStyleId } from './circledNumbers'
import { normalizeAnchorStyle } from './anchorStyle'
import {
  normalizeLineHaloColor,
  normalizeLineHaloWidth,
  normalizeLineStyle,
} from './lineStyle'
import {
  normalizeCalloutBorderEnabled,
  normalizeCalloutFillColor,
  normalizeCalloutFillEnabled,
  normalizeCalloutFillOpacity,
} from './commonSettings'
import { clampAnchorOffsetAxis } from './markerSize'

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
  dotColor: string
  dotRadius: number
  anchorStyle: AnchorStyleId
  lineHaloWidth: number
  lineHaloColor: string
  calloutFontSize: number
  calloutBorderEnabled: boolean
  /** @deprecated Prefer `calloutBorderEnabled`. */
  calloutBorderWidth?: number
  calloutFillEnabled: boolean
  calloutFillColor: string
  calloutFillOpacity: number
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

function sanitizeAnchorOffset(
  raw: unknown,
  imageWidth: number,
  imageHeight: number,
): { x: number; y: number } {
  if (!raw || typeof raw !== 'object') return { x: 0, y: 0 }
  const point = raw as { x?: unknown; y?: unknown }
  const toAxis = (value: unknown, imageSize: number) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 0
    return clampAnchorOffsetAxis(value, imageSize)
  }
  return {
    x: toAxis(point.x, imageWidth),
    y: toAxis(point.y, imageHeight),
  }
}

function sanitizeAnnotation(
  raw: Annotation,
  imageWidth: number,
  imageHeight: number,
): Annotation {
  return {
    id: raw.id,
    sectionId: raw.sectionId,
    order: raw.order,
    description: raw.description,
    markerPosition: raw.markerPosition,
    calloutSide: raw.calloutSide,
    calloutPosition: raw.calloutPosition,
    anchorOffset: sanitizeAnchorOffset(
      (raw as Annotation & { anchorOffset?: unknown }).anchorOffset,
      imageWidth,
      imageHeight,
    ),
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
    annotations: fields.annotations.map((annotation) =>
      sanitizeAnnotation(annotation, fields.imageWidth, fields.imageHeight),
    ),
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
  project.lineHaloWidth = normalizeLineHaloWidth(
    (project as { lineHaloWidth?: number }).lineHaloWidth,
    (project as { lineHalo?: boolean }).lineHalo,
  )
  project.lineHaloColor = normalizeLineHaloColor(
    (project as { lineHaloColor?: string }).lineHaloColor,
  )
  project.calloutBorderEnabled = normalizeCalloutBorderEnabled(
    (project as { calloutBorderEnabled?: boolean }).calloutBorderEnabled,
    (project as { calloutBorderWidth?: number }).calloutBorderWidth,
  )
  project.calloutFillEnabled = normalizeCalloutFillEnabled(
    (project as { calloutFillEnabled?: unknown }).calloutFillEnabled,
  )
  project.calloutFillColor = normalizeCalloutFillColor(
    (project as { calloutFillColor?: unknown }).calloutFillColor,
  )
  project.calloutFillOpacity = normalizeCalloutFillOpacity(
    (project as { calloutFillOpacity?: unknown }).calloutFillOpacity,
  )
  project.anchorStyle = normalizeAnchorStyle(
    (project as { anchorStyle?: unknown }).anchorStyle,
  )
  project.annotations = (project.annotations ?? []).map((annotation) =>
    sanitizeAnnotation(annotation, project.imageWidth, project.imageHeight),
  )
  return project
}
