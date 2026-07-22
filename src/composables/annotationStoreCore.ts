import { reactive, ref, watch } from 'vue'
import type {
  Annotation,
  AnchorStyleId,
  LineStyleId,
  NumberStyleId,
  Point,
  ProjectState,
  Section,
} from '../types/annotation'
import { DEFAULT_NUMBER_STYLE, sortByOrder } from '../utils/circledNumbers'
import { DEFAULT_ANCHOR_STYLE, normalizeAnchorStyle } from '../utils/anchorStyle'
import { containmentRatio } from '../utils/geometry'
import { type OcrLineHit } from '../utils/ocr'
import { useScreenParser } from './useScreenParser'
import {
  layoutCalloutsForImage,
  createDefaultDocumentLayout,
  normalizeCalloutSide,
} from '../utils/calloutLayout'
import {
  DEFAULT_CALLOUT_FONT_ITALIC,
  DEFAULT_CALLOUT_FONT_WEIGHT,
  DEFAULT_FONT_FAMILY,
  ensureGoogleFontsLoaded,
  loadGoogleFont,
  normalizeCalloutFontItalic,
  normalizeCalloutFontWeight,
} from '../utils/googleFonts'
import {
  CALLOUT_FONT_SIZE,
  clampAnchorOffsetAxis,
} from '../utils/markerSize'
import {
  DEFAULT_LINE_HALO_COLOR,
  DEFAULT_LINE_HALO_WIDTH,
  DEFAULT_LINE_WIDTH,
  normalizeLineHaloColor,
  normalizeLineHaloWidth,
  normalizeLineStyle,
} from '../utils/lineStyle'
import {
  DEFAULT_CALLOUT_FILL_COLOR,
  DEFAULT_CALLOUT_FILL_OPACITY,
  DEFAULT_PAGE_BACKGROUND_COLOR,
  normalizeCalloutBorderEnabled,
  normalizeCalloutFillColor,
  normalizeCalloutFillEnabled,
  normalizeCalloutFillOpacity,
  normalizePageBackgroundColor,
} from '../utils/commonSettings'

export const state = reactive<ProjectState>({
  imageUrl: null,
  imageWidth: 0,
  imageHeight: 0,
  sections: [],
  annotations: [],
  selectedSectionIds: [],
  selectedAnnotationIds: [],
  toolMode: 'select',
  defaultFontFamily: DEFAULT_FONT_FAMILY,
  lineStyle: 'solid',
  lineWidth: DEFAULT_LINE_WIDTH,
  lineColor: '#ffd60a',
  dotColor: '#ffd60a',
  dotRadius: 4.5,
  anchorStyle: DEFAULT_ANCHOR_STYLE,
  lineHaloWidth: DEFAULT_LINE_HALO_WIDTH,
  lineHaloColor: DEFAULT_LINE_HALO_COLOR,
  calloutFontSize: CALLOUT_FONT_SIZE,
  calloutFontWeight: DEFAULT_CALLOUT_FONT_WEIGHT,
  calloutFontItalic: DEFAULT_CALLOUT_FONT_ITALIC,
  calloutBorderEnabled: false,
  calloutFillEnabled: true,
  calloutFillColor: DEFAULT_CALLOUT_FILL_COLOR,
  calloutFillOpacity: DEFAULT_CALLOUT_FILL_OPACITY,
  pageBackgroundColor: DEFAULT_PAGE_BACKGROUND_COLOR,
  numberStyle: DEFAULT_NUMBER_STYLE,
  showSections: true,
  calloutLayouts: [],
  document: createDefaultDocumentLayout(0, 0, 0),
})

loadGoogleFont(DEFAULT_FONT_FAMILY)

export const isDetecting = ref(false)
export const isExporting = ref(false)
export const imageElement = ref<HTMLImageElement | null>(null)
export const ocrLines = ref<OcrLineHit[]>([])
/** Named browser save that receives periodic overwrite while editing. */
export const activeNamedProject = ref<{ id: string; name: string } | null>(null)

export interface ImageSnapshot {
  imageUrl: string
  imageElement: HTMLImageElement
  imageWidth: number
  imageHeight: number
  sections: Section[]
  annotations: Annotation[]
  ocrLines: OcrLineHit[]
}

/** Single-level undo snapshot for crop. */
export const cropHistory = ref<ImageSnapshot | null>(null)

export const screenParser = useScreenParser()
// Prefetch so the first detection does not wait on model load.
void screenParser.loadModel()

export function reindexOrders(): void {
  const sorted = sortByOrder(state.annotations)
  sorted.forEach((annotation, annotationIndex) => {
    annotation.order = annotationIndex + 1
  })
}

export function sanitizeAnchorOffset(raw: unknown): Point {
  if (!raw || typeof raw !== 'object') return { x: 0, y: 0 }
  const point = raw as { x?: unknown; y?: unknown }
  const toAxis = (value: unknown, imageSize: number) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 0
    return clampAnchorOffsetAxis(value, imageSize)
  }
  return {
    x: toAxis(point.x, state.imageWidth),
    y: toAxis(point.y, state.imageHeight),
  }
}

export function sanitizeAnnotation(raw: Annotation): Annotation {
  return {
    id: raw.id,
    sectionId: raw.sectionId,
    order: raw.order,
    description: raw.description,
    markerPosition: { ...raw.markerPosition },
    calloutSide: normalizeCalloutSide(raw.calloutSide),
    calloutPosition: raw.calloutPosition
      ? { ...raw.calloutPosition }
      : null,
    anchorOffset: sanitizeAnchorOffset(
      (raw as Annotation & { anchorOffset?: unknown }).anchorOffset,
    ),
  }
}

export function refreshDocumentAndLayouts(): void {
  if (state.annotations.length === 0) {
    state.document = createDefaultDocumentLayout(state.imageWidth, state.imageHeight, 0)
    state.calloutLayouts = []
    return
  }
  const { document, layouts } = layoutCalloutsForImage(
    state.annotations,
    state.sections,
    state.imageWidth,
    state.imageHeight,
    state.calloutFontSize,
    state.defaultFontFamily,
    state.calloutFontWeight,
    state.calloutFontItalic,
    state.numberStyle,
  )
  state.document = document
  state.calloutLayouts = layouts
}

export interface EditSnapshot {
  sections: Section[]
  annotations: Annotation[]
}

const MAX_EDIT_UNDO = 40
export const editUndoStack = ref<EditSnapshot[]>([])
let editUndoCoalesceKey: string | null = null
let editUndoCoalesceUntil = 0

function cloneEditSnapshot(): EditSnapshot {
  return {
    sections: JSON.parse(JSON.stringify(state.sections)) as Section[],
    annotations: JSON.parse(JSON.stringify(state.annotations)) as Annotation[],
  }
}

export function clearEditUndoStack(): void {
  editUndoStack.value = []
  editUndoCoalesceKey = null
  editUndoCoalesceUntil = 0
}

export function resetEditUndoCoalesce(): void {
  editUndoCoalesceKey = null
  editUndoCoalesceUntil = 0
}

/** Snapshot current sections/annotations before a mutating edit. */
export function pushEditUndo(coalesceKey: string | null = null): void {
  const now = performance.now()
  if (
    coalesceKey !== null &&
    coalesceKey === editUndoCoalesceKey &&
    now < editUndoCoalesceUntil
  ) {
    editUndoCoalesceUntil = now + 700
    return
  }

  editUndoStack.value.push(cloneEditSnapshot())
  if (editUndoStack.value.length > MAX_EDIT_UNDO) {
    editUndoStack.value.shift()
  }
  editUndoCoalesceKey = coalesceKey
  editUndoCoalesceUntil = coalesceKey ? now + 700 : 0
}

export function restoreEditSnapshot(snapshot: EditSnapshot): void {
  state.sections = snapshot.sections
  state.annotations = snapshot.annotations.map(sanitizeAnnotation)
  state.selectedSectionIds = []
  state.selectedAnnotationIds = []
  refreshDocumentAndLayouts()
}

export function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Failed to load image'))
    image.src = url
  })
}

export function ocrTextForSection(section: Section): string {
  return ocrLines.value
    .filter((line) => containmentRatio(line.rect, section.rect) >= 0.5)
    .map((line) => line.text)
    .join(' ')
    .trim()
}

export function buildAutoDescription(section: Section): string {
  const ocrText = ocrTextForSection(section)
  if (section.label && ocrText) return `${section.label}: ${ocrText}`
  if (section.label) return section.label
  return ocrText
}

watch(
  () =>
    state.annotations.map((annotation) => ({
      id: annotation.id,
      order: annotation.order,
      description: annotation.description,
      sectionId: annotation.sectionId,
      markerPosition: { ...annotation.markerPosition },
      calloutSide: annotation.calloutSide,
      calloutPosition: annotation.calloutPosition
        ? { ...annotation.calloutPosition }
        : null,
      anchorOffset: { ...annotation.anchorOffset },
    })),
  () => {
    refreshDocumentAndLayouts()
  },
  { deep: true },
)

watch(
  () =>
    state.sections.map((section) => ({
      id: section.id,
      rect: { ...section.rect },
    })),
  () => {
    refreshDocumentAndLayouts()
  },
  { deep: true },
)

watch(
  () =>
    [
      state.imageWidth,
      state.imageHeight,
      state.calloutFontSize,
      state.calloutFontWeight,
      state.calloutFontItalic,
      state.defaultFontFamily,
      state.numberStyle,
    ] as const,
  () => {
    refreshDocumentAndLayouts()
  },
)

export interface RestorableFields {
  imageWidth: number
  imageHeight: number
  sections: Section[]
  annotations: Annotation[]
  ocrLines: OcrLineHit[]
  defaultFontFamily: string
  lineStyle: LineStyleId
  lineWidth?: number
  lineColor: string
  dotColor: string
  dotRadius: number
  anchorStyle?: AnchorStyleId
  lineHaloWidth?: number
  lineHaloColor?: string
  calloutFontSize: number
  calloutFontWeight?: number
  calloutFontItalic?: boolean
  calloutBorderEnabled?: boolean
  calloutFillEnabled?: boolean
  calloutFillColor?: string
  calloutFillOpacity?: number
  pageBackgroundColor?: string
  numberStyle?: NumberStyleId
  showSections: boolean
}

/** Restore state from a saved image + fields without re-running detection/OCR. */
export async function applyRestoredSnapshot(imageBlob: Blob, fields: RestorableFields): Promise<void> {
  if (state.imageUrl) URL.revokeObjectURL(state.imageUrl)

  const url = URL.createObjectURL(imageBlob)
  const image = await loadImageElement(url)
  imageElement.value = image
  state.imageUrl = url
  state.imageWidth = fields.imageWidth
  state.imageHeight = fields.imageHeight
  state.sections = fields.sections
  state.annotations = fields.annotations.map(sanitizeAnnotation)
  state.defaultFontFamily = fields.defaultFontFamily
  {
    const normalizedLine = normalizeLineStyle(fields.lineStyle, fields.lineWidth)
    state.lineStyle = normalizedLine.lineStyle
    state.lineWidth = normalizedLine.lineWidth
  }
  state.lineColor = fields.lineColor
  state.dotColor = fields.lineColor
  state.dotRadius = fields.dotRadius
  state.anchorStyle = normalizeAnchorStyle(fields.anchorStyle)
  state.lineHaloWidth = normalizeLineHaloWidth(fields.lineHaloWidth)
  state.lineHaloColor = normalizeLineHaloColor(fields.lineHaloColor)
  state.calloutFontSize = fields.calloutFontSize
  state.calloutFontWeight = normalizeCalloutFontWeight(
    fields.calloutFontWeight,
    fields.defaultFontFamily,
  )
  state.calloutFontItalic = normalizeCalloutFontItalic(fields.calloutFontItalic)
  state.calloutBorderEnabled = normalizeCalloutBorderEnabled(fields.calloutBorderEnabled)
  state.calloutFillEnabled = normalizeCalloutFillEnabled(fields.calloutFillEnabled)
  state.calloutFillColor = normalizeCalloutFillColor(fields.calloutFillColor)
  state.calloutFillOpacity = normalizeCalloutFillOpacity(fields.calloutFillOpacity)
  state.pageBackgroundColor = normalizePageBackgroundColor(fields.pageBackgroundColor)
  state.numberStyle = fields.numberStyle ?? DEFAULT_NUMBER_STYLE
  state.showSections = fields.showSections
  state.selectedSectionIds = []
  state.selectedAnnotationIds = []
  ocrLines.value = fields.ocrLines
  clearEditUndoStack()
  await ensureGoogleFontsLoaded([state.defaultFontFamily], {
    italic: state.calloutFontItalic,
  })
  refreshDocumentAndLayouts()
}
