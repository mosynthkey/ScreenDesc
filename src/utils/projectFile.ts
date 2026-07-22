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
  normalizePageBackgroundColor,
} from './commonSettings'
import { normalizeCalloutFontItalic, normalizeCalloutFontWeight } from './googleFonts'
import { clampAnchorOffsetAxis } from './markerSize'
import { computeProjectContentHash, isContentHash } from './contentHash'

const FILE_VERSION = 1
const FILE_EXTENSION = '.screendesc.json'
const BUNDLE_KIND = 'bundle'
const BUNDLE_EXTENSION = '.screendesc-bundle.json'

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
  calloutFontWeight: number
  calloutFontItalic: boolean
  calloutBorderEnabled: boolean
  calloutFillEnabled: boolean
  calloutFillColor: string
  calloutFillOpacity: number
  pageBackgroundColor: string
  numberStyle: NumberStyleId
  showSections: boolean
  /** SHA-256 hex of canonical project bytes (excluding this field). Written on export. */
  contentHash?: string
}

export interface ProjectBundleEntry {
  name: string
  updatedAt: number
  project: ProjectFileData
}

export interface ProjectBundleFileData {
  version: 1
  kind: typeof BUNDLE_KIND
  projects: ProjectBundleEntry[]
}

export type ProjectFileFields = Omit<ProjectFileData, 'version' | 'imageDataUrl' | 'contentHash'>

export type ParsedScreenDescFile =
  | { kind: 'project'; project: ProjectFileData }
  | { kind: 'bundle'; bundle: ProjectBundleFileData }

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

async function buildProjectFileData(
  imageBlob: Blob,
  fields: ProjectFileFields,
): Promise<ProjectFileData> {
  const imageDataUrl = await blobToDataUrl(imageBlob)
  const withoutHash = {
    version: FILE_VERSION,
    imageDataUrl,
    ...fields,
    annotations: fields.annotations.map((annotation) =>
      sanitizeAnnotation(annotation, fields.imageWidth, fields.imageHeight),
    ),
  } as const
  const contentHash = await computeProjectContentHash(withoutHash)
  return { ...withoutHash, contentHash }
}

export async function buildProjectFile(
  imageBlob: Blob,
  fields: ProjectFileFields,
): Promise<Blob> {
  const data = await buildProjectFileData(imageBlob, fields)
  return new Blob([JSON.stringify(data)], { type: 'application/json' })
}

/** Content hash for a browser snapshot (same algorithm as exported .screendesc.json). */
export async function contentHashFromSnapshot(snapshot: {
  imageBlob: Blob
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
  calloutFontWeight: number
  calloutFontItalic: boolean
  calloutBorderEnabled: boolean
  calloutFillEnabled: boolean
  calloutFillColor: string
  calloutFillOpacity: number
  pageBackgroundColor: string
  numberStyle: NumberStyleId
  showSections: boolean
}): Promise<string> {
  const data = await buildProjectFileData(
    snapshot.imageBlob,
    projectFileFieldsFromSnapshot(snapshot),
  )
  return data.contentHash!
}

export async function buildProjectBundleFile(
  entries: Array<{
    name: string
    updatedAt: number
    imageBlob: Blob
    fields: ProjectFileFields
  }>,
): Promise<Blob> {
  const projects: ProjectBundleEntry[] = []
  for (const entry of entries) {
    projects.push({
      name: entry.name,
      updatedAt: entry.updatedAt,
      project: await buildProjectFileData(entry.imageBlob, entry.fields),
    })
  }
  const data: ProjectBundleFileData = {
    version: FILE_VERSION,
    kind: BUNDLE_KIND,
    projects,
  }
  return new Blob([JSON.stringify(data)], { type: 'application/json' })
}

function fileStamp(): string {
  return new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
}

export function suggestProjectFileName(): string {
  return `screendesc-${fileStamp()}${FILE_EXTENSION}`
}

export function suggestProjectBundleFileName(): string {
  return `screendesc-bundle-${fileStamp()}${BUNDLE_EXTENSION}`
}

function normalizeProjectFileData(raw: ProjectFileData): ProjectFileData {
  const project = { ...raw }
  if (!isNumberStyleId(project.numberStyle)) {
    project.numberStyle = DEFAULT_NUMBER_STYLE
  }
  const normalizedLine = normalizeLineStyle(project.lineStyle, project.lineWidth)
  project.lineStyle = normalizedLine.lineStyle
  project.lineWidth = normalizedLine.lineWidth
  project.lineHaloWidth = normalizeLineHaloWidth(project.lineHaloWidth)
  project.lineHaloColor = normalizeLineHaloColor(project.lineHaloColor)
  project.calloutBorderEnabled = normalizeCalloutBorderEnabled(project.calloutBorderEnabled)
  project.calloutFillEnabled = normalizeCalloutFillEnabled(
    (project as { calloutFillEnabled?: unknown }).calloutFillEnabled,
  )
  project.calloutFillColor = normalizeCalloutFillColor(
    (project as { calloutFillColor?: unknown }).calloutFillColor,
  )
  project.calloutFillOpacity = normalizeCalloutFillOpacity(
    (project as { calloutFillOpacity?: unknown }).calloutFillOpacity,
  )
  project.pageBackgroundColor = normalizePageBackgroundColor(
    (project as { pageBackgroundColor?: unknown }).pageBackgroundColor,
  )
  project.anchorStyle = normalizeAnchorStyle(
    (project as { anchorStyle?: unknown }).anchorStyle,
  )
  project.calloutFontWeight = normalizeCalloutFontWeight(
    (project as { calloutFontWeight?: unknown }).calloutFontWeight,
    project.defaultFontFamily,
  )
  project.calloutFontItalic = normalizeCalloutFontItalic(
    (project as { calloutFontItalic?: unknown }).calloutFontItalic,
  )
  project.annotations = (project.annotations ?? []).map((annotation) =>
    sanitizeAnnotation(annotation, project.imageWidth, project.imageHeight),
  )
  return project
}

/** Resolve or recompute the content hash after normalize (old files may omit it). */
export async function ensureProjectContentHash(
  project: ProjectFileData,
): Promise<ProjectFileData> {
  if (isContentHash(project.contentHash)) return project
  const { contentHash: _ignored, ...withoutHash } = project
  const contentHash = await computeProjectContentHash(withoutHash)
  return { ...project, contentHash }
}

function isProjectBundleData(data: unknown): data is ProjectBundleFileData {
  if (!data || typeof data !== 'object') return false
  const bundle = data as ProjectBundleFileData
  return (
    bundle.version === FILE_VERSION &&
    bundle.kind === BUNDLE_KIND &&
    Array.isArray(bundle.projects)
  )
}

function isProjectFileData(data: unknown): data is ProjectFileData {
  if (!data || typeof data !== 'object') return false
  const project = data as ProjectFileData
  return (
    project.version === FILE_VERSION &&
    typeof project.imageDataUrl === 'string' &&
    (project as { kind?: unknown }).kind !== BUNDLE_KIND
  )
}

function parseJsonFile(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(t('error.projectFileInvalidJson'))
  }
}

function normalizeBundleFileData(raw: ProjectBundleFileData): ProjectBundleFileData {
  const projects: ProjectBundleEntry[] = []
  for (const entry of raw.projects) {
    if (!entry || typeof entry !== 'object' || !isProjectFileData(entry.project)) {
      throw new Error(t('error.projectBundleInvalid'))
    }
    const name = typeof entry.name === 'string' ? entry.name.trim() : ''
    projects.push({
      name: name || t('header.untitledProject'),
      updatedAt:
        typeof entry.updatedAt === 'number' && Number.isFinite(entry.updatedAt)
          ? entry.updatedAt
          : Date.now(),
      project: normalizeProjectFileData(entry.project),
    })
  }
  return {
    version: FILE_VERSION,
    kind: BUNDLE_KIND,
    projects,
  }
}

export async function parseScreenDescFile(file: File): Promise<ParsedScreenDescFile> {
  const data = parseJsonFile(await file.text())
  if (isProjectBundleData(data)) {
    return { kind: 'bundle', bundle: normalizeBundleFileData(data) }
  }
  if (isProjectFileData(data)) {
    return { kind: 'project', project: normalizeProjectFileData(data) }
  }
  throw new Error(t('error.projectFileUnsupported'))
}

/** Strip session-only fields before writing a portable project file. */
export function projectFileFieldsFromSnapshot(
  snapshot: {
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
    calloutFontWeight: number
    calloutFontItalic: boolean
    calloutBorderEnabled: boolean
    calloutFillEnabled: boolean
    calloutFillColor: string
    calloutFillOpacity: number
    pageBackgroundColor: string
    numberStyle: NumberStyleId
    showSections: boolean
  },
): ProjectFileFields {
  return {
    imageWidth: snapshot.imageWidth,
    imageHeight: snapshot.imageHeight,
    sections: snapshot.sections,
    annotations: snapshot.annotations,
    ocrLines: snapshot.ocrLines,
    defaultFontFamily: snapshot.defaultFontFamily,
    lineStyle: snapshot.lineStyle,
    lineWidth: snapshot.lineWidth,
    lineColor: snapshot.lineColor,
    dotColor: snapshot.dotColor,
    dotRadius: snapshot.dotRadius,
    anchorStyle: snapshot.anchorStyle,
    lineHaloWidth: snapshot.lineHaloWidth,
    lineHaloColor: snapshot.lineHaloColor,
    calloutFontSize: snapshot.calloutFontSize,
    calloutFontWeight: snapshot.calloutFontWeight,
    calloutFontItalic: snapshot.calloutFontItalic,
    calloutBorderEnabled: snapshot.calloutBorderEnabled,
    calloutFillEnabled: snapshot.calloutFillEnabled,
    calloutFillColor: snapshot.calloutFillColor,
    calloutFillOpacity: snapshot.calloutFillOpacity,
    pageBackgroundColor: snapshot.pageBackgroundColor,
    numberStyle: snapshot.numberStyle,
    showSections: snapshot.showSections,
  }
}
