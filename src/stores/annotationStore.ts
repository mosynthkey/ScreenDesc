import { computed, reactive, readonly, ref, watch, type Ref } from 'vue'
import { defineStore } from 'pinia'
import { t } from '../i18n'
import type {
  Annotation,
  AnchorStyleId,
  CalloutSide,
  ExportOptions,
  LineStyleId,
  Point,
  ProjectState,
  Rect,
  Section,
  SectionVisibilityCategory,
  ToolMode,
} from '../types/annotation'
import { createId } from '../utils/id'
import { sortByOrder } from '../utils/circledNumbers'
import { DEFAULT_ANCHOR_STYLE, normalizeAnchorStyle } from '../utils/anchorStyle'
import { containmentRatio, normalizeRect, rectCenter } from '../utils/geometry'
import { type OcrLineHit } from '../utils/ocr'
import { defaultSectionVisibility, normalizeSectionVisibility } from '../utils/sectionVisibility'
import { useScreenParser } from '../composables/useScreenParser'
import { createManualSection } from '../utils/mlSectionDetection'
import { downloadBlob, exportScene } from '../utils/export'
import { blobToPngBlob } from '../utils/export/imageDataUrl'
import {
  layoutCalloutsForImage,
  createDefaultDocumentLayout,
  normalizeCalloutSide,
  estimateAnnotationLabelSize,
  resolveAnnotationDescription,
  resolveAutoSides,
} from '../utils/calloutLayout'
import {
  formatNumberPrefix,
  orderAnnotationsForNumbering,
  type NumberPrefixDirection,
  type NumberPrefixStyle,
} from '../utils/numberPrefix'
import {
  DEFAULT_CALLOUT_FONT_ITALIC,
  DEFAULT_CALLOUT_FONT_WEIGHT,
  DEFAULT_FONT_FAMILY,
  calloutFontWeightForBold,
  ensureGoogleFontsLoaded,
  isCalloutFontBold,
  loadGoogleFont,
  normalizeCalloutFontItalic,
  normalizeCalloutFontWeight,
} from '../utils/googleFonts'
import {
  CALLOUT_FONT_SIZE,
  CALLOUT_FONT_SIZE_MAX,
  CALLOUT_FONT_SIZE_MIN,
  DEFAULT_ANCHOR_OUTSIDE_GAP,
  DEFAULT_CALLOUT_CORNER_RADIUS,
  DEFAULT_HIGHLIGHT_CORNER_RADIUS,
  DEFAULT_HIGHLIGHT_MARGIN,
  DEFAULT_IMAGE_GUTTER,
  DOT_RADIUS_MAX,
  DOT_RADIUS_MIN,
  clampAnchorOffsetAxis,
  normalizeAnchorOutsideGap,
  normalizeCalloutCornerRadius,
  normalizeHighlightCornerRadius,
  normalizeHighlightMargin,
  normalizeImageGutter,
} from '../utils/markerSize'
import {
  DEFAULT_LINE_HALO_COLOR,
  DEFAULT_LINE_HALO_WIDTH,
  DEFAULT_LINE_WIDTH,
  LINE_DASH_GAP_MAX,
  LINE_DASH_GAP_MIN,
  LINE_DASH_LENGTH_MAX,
  LINE_DASH_LENGTH_MIN,
  defaultLineDashGap,
  defaultLineDashLength,
  normalizeLineDashGap,
  normalizeLineDashLength,
  normalizeLineHaloColor,
  normalizeLineHaloWidth,
  normalizeLineStyle,
} from '../utils/lineStyle'
import {
  DEFAULT_CALLOUT_FILL_COLOR,
  DEFAULT_CALLOUT_FILL_OPACITY,
  DEFAULT_HIGHLIGHT_FILL_ENABLED,
  DEFAULT_HIGHLIGHT_FILL_OPACITY,
  DEFAULT_PAGE_BACKGROUND_COLOR,
  deleteCommonSettingsPreset,
  listCommonSettingsPresets,
  loadCommonSettingsPreset,
  normalizeCalloutBorderEnabled,
  normalizeCalloutFillColor,
  normalizeCalloutFillEnabled,
  normalizeCalloutFillOpacity,
  normalizeCommonSettings,
  normalizeHighlightFillEnabled,
  normalizeHighlightFillOpacity,
  normalizePageBackgroundColor,
  resolveCalloutBorderWidth,
  saveCommonSettingsPreset,
  type CommonSettings,
  type CommonSettingsPresetMeta,
} from '../utils/commonSettings'
import {
  clearCurrentProject,
  cropImage,
  loadImageFile,
  rediscoverSectionsAfterReplace,
  replaceImageFile,
  runSectionDetection,
  undoCrop,
} from '../composables/projectImageLifecycle'
import { flushPersistCurrentProject, initializePersistence } from '../composables/projectPersistence'
import {
  downloadAllProjectsBundle,
  fetchSavedProjects,
  loadSavedProject,
  openProjectFile,
  removeSavedProject,
  saveProjectAs,
  saveProjectToFile,
  setProjectName,
} from '../composables/projectFileIO'

export interface ImageSnapshot {
  imageUrl: string
  imageElement: HTMLImageElement
  imageWidth: number
  imageHeight: number
  sections: Section[]
  annotations: Annotation[]
  ocrLines: OcrLineHit[]
}

export interface EditSnapshot {
  sections: Section[]
  annotations: Annotation[]
}

export interface RestorableFields {
  imageWidth: number
  imageHeight: number
  sections: Section[]
  annotations: Annotation[]
  ocrLines: OcrLineHit[]
  defaultFontFamily: string
  lineStyle: LineStyleId
  lineWidth?: number
  lineDashLength?: number
  lineDashGap?: number
  lineColor: string
  dotColor: string
  dotRadius: number
  imageGutter?: number
  highlightMargin?: number
  highlightFillEnabled?: boolean
  highlightFillOpacity?: number
  highlightCornerRadius?: number
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
  calloutCornerRadius?: number
  pageBackgroundColor?: string
  /** @deprecated superseded by `sectionVisibility`, kept for old saves. */
  showSections?: boolean
  sectionVisibility?: unknown
  variations?: string[]
}

/**
 * The slice of store internals that satellite composables (project
 * persistence, image lifecycle, file IO, thumbnails) need to read and
 * mutate directly. Passed explicitly as a parameter rather than obtained via
 * `useAnnotationStore()` from those files, since some of them run during the
 * store's own setup() — calling the store hook re-entrantly there would
 * recurse into an instance that doesn't exist yet.
 */
export interface StoreCore {
  state: ProjectState
  imageElement: Ref<HTMLImageElement | null>
  ocrLines: Ref<OcrLineHit[]>
  activeNamedProject: Ref<{ id: string; name: string } | null>
  cropHistory: Ref<ImageSnapshot | null>
  isDetecting: Ref<boolean>
  isRecognizingText: Ref<boolean>
  screenParser: ReturnType<typeof useScreenParser>
  sanitizeAnnotation: (raw: Annotation) => Annotation
  refreshDocumentAndLayouts: () => void
  pushEditUndo: (coalesceKey?: string | null) => void
  clearEditUndoStack: () => void
  loadImageElement: (url: string) => Promise<HTMLImageElement>
  applyRestoredSnapshot: (imageBlob: Blob, fields: RestorableFields) => Promise<void>
}

export const useAnnotationStore = defineStore('annotation', () => {
  const state = reactive<ProjectState>({
    imageUrl: null,
    imageWidth: 0,
    imageHeight: 0,
    sections: [],
    annotations: [],
    selectedSectionIds: [],
    selectedAnnotationIds: [],
    toolMode: 'select',
    cropDraft: null,
    defaultFontFamily: DEFAULT_FONT_FAMILY,
    lineStyle: 'solid',
    lineWidth: DEFAULT_LINE_WIDTH,
    lineDashLength: defaultLineDashLength(DEFAULT_LINE_WIDTH),
    lineDashGap: defaultLineDashGap(DEFAULT_LINE_WIDTH),
    lineColor: '#ffd60a',
    dotColor: '#ffd60a',
    dotRadius: 4.5,
    imageGutter: DEFAULT_IMAGE_GUTTER,
    highlightMargin: DEFAULT_HIGHLIGHT_MARGIN,
    highlightFillEnabled: DEFAULT_HIGHLIGHT_FILL_ENABLED,
    highlightFillOpacity: DEFAULT_HIGHLIGHT_FILL_OPACITY,
    highlightCornerRadius: DEFAULT_HIGHLIGHT_CORNER_RADIUS,
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
    calloutCornerRadius: DEFAULT_CALLOUT_CORNER_RADIUS,
    pageBackgroundColor: DEFAULT_PAGE_BACKGROUND_COLOR,
    sectionVisibility: defaultSectionVisibility(),
    calloutLayouts: [],
    document: createDefaultDocumentLayout(0, 0, 0),
    variations: [],
    activeVariation: null,
  })

  loadGoogleFont(DEFAULT_FONT_FAMILY)

  const isDetecting = ref(false)
  const isRecognizingText = ref(false)
  const isExporting = ref(false)
  const imageElement = ref<HTMLImageElement | null>(null)
  const ocrLines = ref<OcrLineHit[]>([])
  /** Named saved-project that receives periodic overwrite while editing. */
  const activeNamedProject = ref<{ id: string; name: string } | null>(null)
  /** Single-level undo snapshot for crop. */
  const cropHistory = ref<ImageSnapshot | null>(null)

  const screenParser = useScreenParser()

  function reindexOrders(): void {
    const sorted = sortByOrder(state.annotations)
    sorted.forEach((annotation, annotationIndex) => {
      annotation.order = annotationIndex + 1
    })
  }

  function sanitizeAnchorOffset(raw: unknown): Point {
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

  function sanitizeVariationText(raw: unknown): Record<string, string> {
    if (!raw || typeof raw !== 'object') return {}
    const result: Record<string, string> = {}
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof value === 'string') result[key] = value
    }
    return result
  }

  function sanitizeAnnotation(raw: Annotation): Annotation {
    return {
      id: raw.id,
      sectionId: raw.sectionId,
      order: raw.order,
      description: raw.description,
      variationText: sanitizeVariationText(
        (raw as Annotation & { variationText?: unknown }).variationText,
      ),
      numberPrefix:
        typeof (raw as Annotation & { numberPrefix?: unknown }).numberPrefix === 'string'
          ? raw.numberPrefix
          : '',
      markerPosition: { ...raw.markerPosition },
      calloutSide: normalizeCalloutSide(raw.calloutSide),
      calloutPosition: raw.calloutPosition
        ? { ...raw.calloutPosition }
        : null,
      anchorOffset: sanitizeAnchorOffset(
        (raw as Annotation & { anchorOffset?: unknown }).anchorOffset,
      ),
      anchorOutsideGap: normalizeAnchorOutsideGap(
        (raw as Annotation & { anchorOutsideGap?: unknown }).anchorOutsideGap,
      ),
    }
  }

  function refreshDocumentAndLayouts(): void {
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
      state.anchorStyle,
      state.dotRadius,
      state.lineWidth,
      state.imageGutter,
      state.highlightMargin,
      state.activeVariation,
    )
    state.document = document
    state.calloutLayouts = layouts
  }

  const MAX_EDIT_UNDO = 40
  const editUndoStack = ref<EditSnapshot[]>([])
  let editUndoCoalesceKey: string | null = null
  let editUndoCoalesceUntil = 0

  function cloneEditSnapshot(): EditSnapshot {
    return {
      sections: JSON.parse(JSON.stringify(state.sections)) as Section[],
      annotations: JSON.parse(JSON.stringify(state.annotations)) as Annotation[],
    }
  }

  function clearEditUndoStack(): void {
    editUndoStack.value = []
    editUndoCoalesceKey = null
    editUndoCoalesceUntil = 0
  }

  function resetEditUndoCoalesce(): void {
    editUndoCoalesceKey = null
    editUndoCoalesceUntil = 0
  }

  /** Snapshot current sections/annotations before a mutating edit. */
  function pushEditUndo(coalesceKey: string | null = null): void {
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

  function restoreEditSnapshot(snapshot: EditSnapshot): void {
    state.sections = snapshot.sections
    state.annotations = snapshot.annotations.map(sanitizeAnnotation)
    state.selectedSectionIds = []
    state.selectedAnnotationIds = []
    refreshDocumentAndLayouts()
  }

  function loadImageElement(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error(t('error.imageReadFailed')))
      image.src = url
    })
  }

  function ocrTextForSection(section: Section): string {
    return ocrLines.value
      .filter((line) => containmentRatio(line.rect, section.rect) >= 0.5)
      .map((line) => line.text)
      .join(' ')
      .trim()
  }

  function buildAutoDescription(section: Section): string {
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
        variationText: { ...annotation.variationText },
        numberPrefix: annotation.numberPrefix,
        sectionId: annotation.sectionId,
        markerPosition: { ...annotation.markerPosition },
        calloutSide: annotation.calloutSide,
        calloutPosition: annotation.calloutPosition
          ? { ...annotation.calloutPosition }
          : null,
        anchorOffset: { ...annotation.anchorOffset },
        anchorOutsideGap: annotation.anchorOutsideGap,
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
        outlineEnabled: section.outlineEnabled === true,
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
        state.anchorStyle,
        state.dotRadius,
        state.lineWidth,
        state.imageGutter,
        state.highlightMargin,
        state.activeVariation,
      ] as const,
    () => {
      refreshDocumentAndLayouts()
    },
  )

  /** Restore state from a saved image + fields without re-running detection/OCR. */
  async function applyRestoredSnapshot(imageBlob: Blob, fields: RestorableFields): Promise<void> {
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
    state.lineDashLength = normalizeLineDashLength(fields.lineDashLength, state.lineWidth)
    state.lineDashGap = normalizeLineDashGap(fields.lineDashGap, state.lineWidth)
    state.lineColor = fields.lineColor
    state.dotColor = fields.lineColor
    state.dotRadius = fields.dotRadius
    state.imageGutter = normalizeImageGutter(fields.imageGutter)
    state.highlightMargin = normalizeHighlightMargin(fields.highlightMargin)
    state.highlightFillEnabled = normalizeHighlightFillEnabled(fields.highlightFillEnabled)
    state.highlightFillOpacity = normalizeHighlightFillOpacity(fields.highlightFillOpacity)
    state.highlightCornerRadius = normalizeHighlightCornerRadius(fields.highlightCornerRadius)
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
    state.calloutCornerRadius = normalizeCalloutCornerRadius(fields.calloutCornerRadius)
    state.pageBackgroundColor = normalizePageBackgroundColor(fields.pageBackgroundColor)
    state.sectionVisibility = normalizeSectionVisibility(
      fields.sectionVisibility,
      fields.showSections ?? true,
    )
    state.variations = Array.isArray(fields.variations)
      ? fields.variations.filter((name): name is string => typeof name === 'string')
      : []
    state.activeVariation = null
    state.selectedSectionIds = []
    state.selectedAnnotationIds = []
    ocrLines.value = fields.ocrLines
    clearEditUndoStack()
    await ensureGoogleFontsLoaded([state.defaultFontFamily], {
      italic: state.calloutFontItalic,
    })
    refreshDocumentAndLayouts()
  }

  /** Bundled hand-off for the satellite composables — see `StoreCore`. */
  const core: StoreCore = {
    state,
    imageElement,
    ocrLines,
    activeNamedProject,
    cropHistory,
    isDetecting,
    isRecognizingText,
    screenParser,
    sanitizeAnnotation,
    refreshDocumentAndLayouts,
    pushEditUndo,
    clearEditUndoStack,
    loadImageElement,
    applyRestoredSnapshot,
  }

  const hasImage = computed(() => Boolean(state.imageUrl))
  const sortedAnnotations = computed(() => sortByOrder(state.annotations))
  const canUndoCrop = computed(() => cropHistory.value !== null)
  const selectedAnnotations = computed(() =>
    state.selectedAnnotationIds
      .map((annotationId) => state.annotations.find((item) => item.id === annotationId))
      .filter((item): item is Annotation => Boolean(item)),
  )
  const documentWidth = computed(
    () => state.document.marginLeft + state.document.imageWidth + state.document.marginRight,
  )
  const documentHeight = computed(
    () => state.document.marginTop + state.document.imageHeight + state.document.marginBottom,
  )
  const labelPositions = computed(() => {
    const positions: Record<string, Point> = {}
    for (const layout of state.calloutLayouts) {
      positions[layout.annotationId] = { ...layout.labelPosition }
    }
    return positions
  })

  function setToolMode(mode: ToolMode): void {
    state.toolMode = mode
    state.cropDraft =
      mode === 'crop'
        ? { x: 0, y: 0, width: state.imageWidth, height: state.imageHeight }
        : null
  }

  function setCropDraft(rect: Rect): void {
    state.cropDraft = rect
  }

  function setLineStyle(style: LineStyleId): void {
    state.lineStyle = style
  }

  function setLineWidth(width: number): void {
    state.lineWidth = width
  }

  function setLineDashLength(length: number): void {
    state.lineDashLength = Math.min(LINE_DASH_LENGTH_MAX, Math.max(LINE_DASH_LENGTH_MIN, length))
  }

  function setLineDashGap(gap: number): void {
    state.lineDashGap = Math.min(LINE_DASH_GAP_MAX, Math.max(LINE_DASH_GAP_MIN, gap))
  }

  function setLineColor(color: string): void {
    state.lineColor = color
    state.dotColor = color
  }

  function setDotRadius(radius: number): void {
    state.dotRadius = Math.min(DOT_RADIUS_MAX, Math.max(DOT_RADIUS_MIN, radius))
  }

  function setImageGutter(gutter: number): void {
    state.imageGutter = normalizeImageGutter(gutter)
  }

  function setHighlightMargin(margin: number): void {
    state.highlightMargin = normalizeHighlightMargin(margin)
  }

  function setHighlightFillEnabled(enabled: boolean): void {
    state.highlightFillEnabled = enabled
  }

  function setHighlightFillOpacity(opacity: number): void {
    state.highlightFillOpacity = normalizeHighlightFillOpacity(opacity)
  }

  function setHighlightCornerRadius(radius: number): void {
    state.highlightCornerRadius = normalizeHighlightCornerRadius(radius)
  }

  function setAnchorStyle(style: AnchorStyleId): void {
    state.anchorStyle = style
  }

  function setLineHaloWidth(width: number): void {
    state.lineHaloWidth = normalizeLineHaloWidth(width)
  }

  function setLineHaloColor(color: string): void {
    state.lineHaloColor = normalizeLineHaloColor(color)
  }

  function setCalloutFontSize(size: number): void {
    state.calloutFontSize = Math.min(
      CALLOUT_FONT_SIZE_MAX,
      Math.max(CALLOUT_FONT_SIZE_MIN, size),
    )
    for (const annotation of state.annotations) {
      annotation.calloutPosition = null
    }
  }

  function setCalloutFontWeight(weight: number): void {
    state.calloutFontWeight = normalizeCalloutFontWeight(weight, state.defaultFontFamily)
    for (const annotation of state.annotations) {
      annotation.calloutPosition = null
    }
  }

  function setCalloutFontItalic(italic: boolean): void {
    state.calloutFontItalic = italic
    void ensureGoogleFontsLoaded([state.defaultFontFamily], { italic })
    for (const annotation of state.annotations) {
      annotation.calloutPosition = null
    }
  }

  function setCalloutBorderEnabled(enabled: boolean): void {
    state.calloutBorderEnabled = enabled
  }

  function setCalloutFillEnabled(enabled: boolean): void {
    state.calloutFillEnabled = enabled
  }

  function setCalloutFillColor(color: string): void {
    state.calloutFillColor = normalizeCalloutFillColor(color)
  }

  function setCalloutFillOpacity(opacity: number): void {
    state.calloutFillOpacity = normalizeCalloutFillOpacity(opacity)
  }

  function setCalloutCornerRadius(radius: number): void {
    state.calloutCornerRadius = normalizeCalloutCornerRadius(radius)
  }

  function setPageBackgroundColor(color: string): void {
    state.pageBackgroundColor = normalizePageBackgroundColor(color)
  }

  function toggleSectionVisibility(category: SectionVisibilityCategory): void {
    const current = state.sectionVisibility[category] !== false
    state.sectionVisibility = { ...state.sectionVisibility, [category]: !current }
  }

  function clearSelection(): void {
    state.selectedSectionIds = []
    state.selectedAnnotationIds = []
  }

  function selectSection(sectionId: string, additive: boolean): void {
    if (additive) {
      if (state.selectedSectionIds.includes(sectionId)) {
        state.selectedSectionIds = state.selectedSectionIds.filter((id) => id !== sectionId)
      } else {
        state.selectedSectionIds = [...state.selectedSectionIds, sectionId]
      }
    } else {
      state.selectedSectionIds = [sectionId]
      state.selectedAnnotationIds = []
    }
  }

  function selectAnnotation(annotationId: string, additive: boolean): void {
    if (additive) {
      state.selectedSectionIds = []
      if (state.selectedAnnotationIds.includes(annotationId)) {
        state.selectedAnnotationIds = state.selectedAnnotationIds.filter(
          (id) => id !== annotationId,
        )
      } else {
        state.selectedAnnotationIds = [...state.selectedAnnotationIds, annotationId]
      }
    } else {
      state.selectedAnnotationIds = [annotationId]
      state.selectedSectionIds = []
    }
  }

  function selectAllAnnotations(): void {
    state.selectedSectionIds = []
    state.selectedAnnotationIds = state.annotations.map((annotation) => annotation.id)
  }

  function addSection(rect: Rect): Section {
    const normalized = normalizeRect(rect)
    if (normalized.width < 8 || normalized.height < 8) {
      throw new Error('Section too small')
    }
    pushEditUndo()
    const section = createManualSection(normalized)
    state.sections.push(section)
    state.selectedSectionIds = [section.id]
    return section
  }

  function updateSectionRect(sectionId: string, rect: Rect): void {
    const section = state.sections.find((item) => item.id === sectionId)
    if (!section) return
    pushEditUndo(`section-rect:${sectionId}`)
    section.rect = normalizeRect(rect)
  }

  /** Toggle the margin-expanded outline on the given sections (see `Section.outlineEnabled`). */
  function setSectionOutlineEnabled(sectionIds: string[], enabled: boolean): void {
    if (sectionIds.length === 0) return
    pushEditUndo()
    const idSet = new Set(sectionIds)
    for (const section of state.sections) {
      if (idSet.has(section.id)) section.outlineEnabled = enabled
    }
  }

  /** Toggle the halo edging on the given sections' outlines (see `Section.outlineHaloEnabled`). */
  function setSectionOutlineHaloEnabled(sectionIds: string[], enabled: boolean): void {
    if (sectionIds.length === 0) return
    pushEditUndo()
    const idSet = new Set(sectionIds)
    for (const section of state.sections) {
      if (idSet.has(section.id)) section.outlineHaloEnabled = enabled
    }
  }

  /** Sections behind the current selection: directly selected, or via a selected annotation. */
  function targetSectionIdsForOutlineToggle(): string[] {
    const sectionIds = new Set<string>(state.selectedSectionIds)
    for (const annotation of selectedAnnotations.value) {
      if (annotation.sectionId) sectionIds.add(annotation.sectionId)
    }
    return [...sectionIds]
  }

  function toggleSectionOutline(enabled: boolean): void {
    setSectionOutlineEnabled(targetSectionIdsForOutlineToggle(), enabled)
  }

  function toggleSectionOutlineHalo(enabled: boolean): void {
    setSectionOutlineHaloEnabled(targetSectionIdsForOutlineToggle(), enabled)
  }

  function removeSections(sectionIds: string[]): void {
    if (sectionIds.length === 0) return
    pushEditUndo()
    const idSet = new Set(sectionIds)
    state.sections = state.sections.filter((section) => !idSet.has(section.id))
    for (const annotation of state.annotations) {
      if (annotation.sectionId && idSet.has(annotation.sectionId)) {
        annotation.sectionId = null
      }
    }
    state.selectedSectionIds = state.selectedSectionIds.filter((id) => !idSet.has(id))
  }

  /**
   * Resolve the auto-placement side for a freshly created annotation, weighing
   * edge distance against how crowded each side already is from existing
   * annotations, and logging the decision.
   */
  function resolveInitialSide(annotation: Annotation): CalloutSide {
    const sizeArgs = [
      state.defaultFontFamily,
      state.calloutFontSize,
      state.calloutFontWeight,
      state.calloutFontItalic,
      state.activeVariation,
    ] as const
    const sizeById = new Map<string, { width: number; height: number }>()
    for (const existing of state.annotations) {
      sizeById.set(existing.id, estimateAnnotationLabelSize(existing, ...sizeArgs))
    }
    sizeById.set(annotation.id, estimateAnnotationLabelSize(annotation, ...sizeArgs))

    const resolved = resolveAutoSides(
      [...state.annotations, annotation],
      sizeById,
      state.sections,
      state.imageWidth,
      state.imageHeight,
      (decision) => {
        if (decision.annotationId !== annotation.id) return
        console.log('[calloutSide] auto-placement', decision)
      },
    )
    return resolved.get(annotation.id) ?? 'top'
  }

  function createAnnotationForSection(section: Section): Annotation {
    pushEditUndo()
    const center = rectCenter(section.rect)
    const annotation: Annotation = {
      id: createId('ann'),
      sectionId: section.id,
      order: state.annotations.length + 1,
      description: buildAutoDescription(section),
      variationText: {},
      numberPrefix: '',
      markerPosition: { ...center },
      calloutSide: 'auto',
      calloutPosition: null,
      anchorOffset: { x: 0, y: 0 },
      anchorOutsideGap: DEFAULT_ANCHOR_OUTSIDE_GAP,
    }
    annotation.calloutSide = resolveInitialSide(annotation)
    state.annotations.push(annotation)
    reindexOrders()
    state.selectedAnnotationIds = [annotation.id]
    state.selectedSectionIds = [section.id]
    return annotation
  }

  function addAnnotationAtPoint(point: Point, sectionId: string | null = null): Annotation {
    pushEditUndo()
    const annotation: Annotation = {
      id: createId('ann'),
      sectionId,
      order: state.annotations.length + 1,
      description: '',
      variationText: {},
      numberPrefix: '',
      markerPosition: { ...point },
      calloutSide: 'auto',
      calloutPosition: null,
      anchorOffset: { x: 0, y: 0 },
      anchorOutsideGap: DEFAULT_ANCHOR_OUTSIDE_GAP,
    }
    annotation.calloutSide = resolveInitialSide(annotation)
    state.annotations.push(annotation)
    reindexOrders()
    state.selectedAnnotationIds = [annotation.id]
    return annotation
  }

  async function setDefaultFontFamily(fontFamily: string): Promise<void> {
    state.defaultFontFamily = fontFamily
    state.calloutFontWeight = calloutFontWeightForBold(
      fontFamily,
      isCalloutFontBold(state.calloutFontWeight),
    )
    await ensureGoogleFontsLoaded([fontFamily], { italic: state.calloutFontItalic })
    for (const annotation of state.annotations) {
      annotation.calloutPosition = null
    }
    refreshDocumentAndLayouts()
  }

  function getCommonSettings(): CommonSettings {
    return {
      defaultFontFamily: state.defaultFontFamily,
      lineStyle: state.lineStyle,
      lineWidth: state.lineWidth,
      lineDashLength: state.lineDashLength,
      lineDashGap: state.lineDashGap,
      lineColor: state.lineColor,
      dotRadius: state.dotRadius,
      imageGutter: state.imageGutter,
      highlightMargin: state.highlightMargin,
      highlightFillEnabled: state.highlightFillEnabled,
      highlightFillOpacity: state.highlightFillOpacity,
      highlightCornerRadius: state.highlightCornerRadius,
      anchorStyle: state.anchorStyle,
      lineHaloWidth: state.lineHaloWidth,
      lineHaloColor: state.lineHaloColor,
      calloutFontSize: state.calloutFontSize,
      calloutFontWeight: state.calloutFontWeight,
      calloutFontItalic: state.calloutFontItalic,
      calloutBorderEnabled: state.calloutBorderEnabled,
      calloutFillEnabled: state.calloutFillEnabled,
      calloutFillColor: state.calloutFillColor,
      calloutFillOpacity: state.calloutFillOpacity,
      calloutCornerRadius: state.calloutCornerRadius,
      pageBackgroundColor: state.pageBackgroundColor,
    }
  }

  async function applyCommonSettings(raw: CommonSettings): Promise<void> {
    const settings = normalizeCommonSettings(raw)
    if (!settings) return

    const fontChanged = settings.defaultFontFamily !== state.defaultFontFamily
    const layoutAffecting =
      fontChanged ||
      settings.calloutFontSize !== state.calloutFontSize ||
      settings.calloutFontWeight !== state.calloutFontWeight ||
      settings.calloutFontItalic !== state.calloutFontItalic

    state.defaultFontFamily = settings.defaultFontFamily
    state.lineStyle = settings.lineStyle
    state.lineWidth = settings.lineWidth
    state.lineDashLength = settings.lineDashLength
    state.lineDashGap = settings.lineDashGap
    state.lineColor = settings.lineColor
    state.dotColor = settings.lineColor
    state.dotRadius = settings.dotRadius
    state.imageGutter = settings.imageGutter
    state.highlightMargin = settings.highlightMargin
    state.highlightFillEnabled = settings.highlightFillEnabled
    state.highlightFillOpacity = settings.highlightFillOpacity
    state.highlightCornerRadius = settings.highlightCornerRadius
    state.anchorStyle = settings.anchorStyle
    state.lineHaloWidth = settings.lineHaloWidth
    state.lineHaloColor = settings.lineHaloColor
    state.calloutFontSize = settings.calloutFontSize
    state.calloutFontWeight = settings.calloutFontWeight
    state.calloutFontItalic = settings.calloutFontItalic
    state.calloutBorderEnabled = settings.calloutBorderEnabled
    state.calloutFillEnabled = settings.calloutFillEnabled
    state.calloutFillColor = settings.calloutFillColor
    state.calloutFillOpacity = settings.calloutFillOpacity
    state.calloutCornerRadius = settings.calloutCornerRadius
    state.pageBackgroundColor = settings.pageBackgroundColor

    await ensureGoogleFontsLoaded([state.defaultFontFamily], {
      italic: state.calloutFontItalic,
    })
    if (layoutAffecting) {
      for (const annotation of state.annotations) {
        annotation.calloutPosition = null
      }
    }
    refreshDocumentAndLayouts()
  }

  function fetchCommonSettingsPresets(): CommonSettingsPresetMeta[] {
    return listCommonSettingsPresets()
  }

  function saveCommonSettingsAs(name: string, overwriteId?: string): string {
    return saveCommonSettingsPreset(name, getCommonSettings(), overwriteId)
  }

  async function applyCommonSettingsPreset(id: string): Promise<boolean> {
    const preset = loadCommonSettingsPreset(id)
    if (!preset) return false
    await applyCommonSettings(preset.settings)
    return true
  }

  function removeCommonSettingsPreset(id: string): void {
    deleteCommonSettingsPreset(id)
  }

  type AnnotationPatch = Partial<
    Omit<
      Pick<
        Annotation,
        | 'description'
        | 'markerPosition'
        | 'calloutSide'
        | 'calloutPosition'
        | 'anchorOffset'
        | 'anchorOutsideGap'
        | 'sectionId'
      >,
      'calloutPosition'
    >
  > & {
    calloutPosition?: Point | null
    /** Set one axis on many annotations without forcing the other axis equal. */
    anchorOffsetX?: number
    anchorOffsetY?: number
    calloutPositionX?: number
    calloutPositionY?: number
  }

  function isCalloutPositionPatch(patch: AnnotationPatch): boolean {
    return (
      'calloutPosition' in patch ||
      patch.calloutPositionX !== undefined ||
      patch.calloutPositionY !== undefined
    )
  }

  function applyAnnotationPatch(annotation: Annotation, patch: AnnotationPatch): void {
    if (patch.anchorOffset) {
      annotation.anchorOffset = sanitizeAnchorOffset(patch.anchorOffset)
    }
    if (patch.anchorOffsetX !== undefined || patch.anchorOffsetY !== undefined) {
      annotation.anchorOffset = sanitizeAnchorOffset({
        x: patch.anchorOffsetX ?? annotation.anchorOffset.x,
        y: patch.anchorOffsetY ?? annotation.anchorOffset.y,
      })
    }
    if (patch.anchorOutsideGap !== undefined) {
      annotation.anchorOutsideGap = normalizeAnchorOutsideGap(patch.anchorOutsideGap)
    }
    if ('calloutPosition' in patch) {
      annotation.calloutPosition = patch.calloutPosition
        ? { ...patch.calloutPosition }
        : null
    }
    if (patch.calloutPositionX !== undefined || patch.calloutPositionY !== undefined) {
      const layout = state.calloutLayouts.find((item) => item.annotationId === annotation.id)
      const base = annotation.calloutPosition ?? layout?.labelPosition ?? { x: 0, y: 0 }
      annotation.calloutPosition = {
        x: patch.calloutPositionX ?? base.x,
        y: patch.calloutPositionY ?? base.y,
      }
    }
    const {
      anchorOffset: _ignoredOffset,
      anchorOffsetX: _ignoredX,
      anchorOffsetY: _ignoredY,
      anchorOutsideGap: _ignoredGap,
      calloutPosition: _ignoredCallout,
      calloutPositionX: _ignoredCalloutX,
      calloutPositionY: _ignoredCalloutY,
      ...rest
    } = patch
    Object.assign(annotation, rest)
  }

  function updateAnnotation(annotationId: string, patch: AnnotationPatch): void {
    const annotation = state.annotations.find((item) => item.id === annotationId)
    if (!annotation) return
    const coalesceKey = isCalloutPositionPatch(patch)
      ? `callout-pos:${annotationId}`
      : patch.anchorOffset ||
          patch.anchorOffsetX !== undefined ||
          patch.anchorOffsetY !== undefined
        ? `anchor-offset:${annotationId}`
        : patch.anchorOutsideGap !== undefined
          ? `anchor-outside-gap:${annotationId}`
          : patch.description !== undefined
            ? `description:${annotationId}`
            : null
    pushEditUndo(coalesceKey)
    applyAnnotationPatch(annotation, patch)
  }

  function updateAnnotationVariationText(
    annotationId: string,
    variation: string,
    text: string,
  ): void {
    const annotation = state.annotations.find((item) => item.id === annotationId)
    if (!annotation) return
    pushEditUndo(`variation-text:${annotationId}:${variation}`)
    annotation.variationText = { ...annotation.variationText, [variation]: text }
  }

  /**
   * Add a variation (free-text name) if new, seeded with a copy of the
   * previously active variation's text (a starting point to translate from,
   * rather than a blank "needs writing" state), and switch to it.
   */
  function addVariation(name: string): void {
    const trimmed = name.trim()
    if (!trimmed) return
    if (!state.variations.includes(trimmed)) {
      pushEditUndo()
      state.variations = [...state.variations, trimmed]
      const sourceVariation = state.activeVariation
      for (const annotation of state.annotations) {
        const sourceText = resolveAnnotationDescription(annotation, sourceVariation)
        annotation.variationText = { ...annotation.variationText, [trimmed]: sourceText }
      }
    }
    state.activeVariation = trimmed
  }

  function setActiveVariation(variation: string | null): void {
    state.activeVariation = variation !== null && state.variations.includes(variation) ? variation : null
  }

  function updateAnnotations(annotationIds: string[], patch: AnnotationPatch): void {
    if (annotationIds.length === 0) return
    if (annotationIds.length === 1) {
      updateAnnotation(annotationIds[0]!, patch)
      return
    }
    const idKey = [...annotationIds].sort().join(',')
    const coalesceKey = isCalloutPositionPatch(patch)
      ? `callout-pos-multi:${idKey}`
      : patch.anchorOffset ||
          patch.anchorOffsetX !== undefined ||
          patch.anchorOffsetY !== undefined
        ? `anchor-offset-multi:${idKey}`
        : patch.anchorOutsideGap !== undefined
          ? `anchor-outside-gap-multi:${idKey}`
          : null
    pushEditUndo(coalesceKey)
    for (const annotationId of annotationIds) {
      const annotation = state.annotations.find((item) => item.id === annotationId)
      if (!annotation) continue
      applyAnnotationPatch(annotation, patch)
    }
  }

  function updateCalloutPosition(annotationId: string, point: Point): void {
    updateAnnotation(annotationId, { calloutPosition: point })
  }

  function updateAnchorOffset(annotationId: string, offset: Point): void {
    updateAnnotation(annotationId, { anchorOffset: offset })
  }

  function patchSelectedAnnotations(
    patch: Partial<{
      calloutSide: CalloutSide
      anchorOffset: Point
      anchorOffsetX: number
      anchorOffsetY: number
      anchorOutsideGap: number
      calloutPosition: Point | null
      calloutPositionX: number
      calloutPositionY: number
    }>,
  ): void {
    const ids = state.selectedAnnotationIds
    if (ids.length === 0) return
    updateAnnotations([...ids], patch)
  }

  /** Commit edited description text, routed to the base description or the active variation. */
  function commitDescription(annotationId: string, description: string): void {
    if (state.activeVariation) {
      updateAnnotationVariationText(annotationId, state.activeVariation, description)
    } else {
      updateAnnotation(annotationId, { description })
    }
  }

  /** Move several callouts by the same document-space delta (multi-drag). */
  function nudgeCalloutPositions(
    moves: Array<{ annotationId: string; position: Point }>,
  ): void {
    if (moves.length === 0) return
    const idKey = moves
      .map((move) => move.annotationId)
      .sort()
      .join(',')
    pushEditUndo(`callout-pos-multi:${idKey}`)
    for (const move of moves) {
      const annotation = state.annotations.find((item) => item.id === move.annotationId)
      if (!annotation) continue
      annotation.calloutPosition = { ...move.position }
    }
  }

  function removeAnnotations(annotationIds: string[]): void {
    if (annotationIds.length === 0) return
    pushEditUndo()
    const idSet = new Set(annotationIds)
    state.annotations = state.annotations.filter((annotation) => !idSet.has(annotation.id))
    state.selectedAnnotationIds = state.selectedAnnotationIds.filter((id) => !idSet.has(id))
    reindexOrders()
  }

  function reorderAnnotations(orderedIds: string[]): void {
    pushEditUndo()
    orderedIds.forEach((annotationId, annotationIndex) => {
      const annotation = state.annotations.find((item) => item.id === annotationId)
      if (annotation) annotation.order = annotationIndex + 1
    })
  }

  /** Set each annotation's number prefix, in the given reading direction. */
  function assignNumberPrefixes(
    direction: NumberPrefixDirection,
    style: NumberPrefixStyle,
  ): void {
    if (state.annotations.length === 0) return
    pushEditUndo()
    const ordered = orderAnnotationsForNumbering(state.annotations, state.sections, direction)
    ordered.forEach((annotation, index) => {
      annotation.numberPrefix = formatNumberPrefix(index + 1, style)
    })
  }

  function clearNumberPrefixes(): void {
    if (state.annotations.every((annotation) => !annotation.numberPrefix)) return
    pushEditUndo()
    for (const annotation of state.annotations) {
      annotation.numberPrefix = ''
    }
  }

  function undoEdit(): boolean {
    const snapshot = editUndoStack.value.pop()
    if (!snapshot) return false
    resetEditUndoCoalesce()
    restoreEditSnapshot(snapshot)
    return true
  }

  const canUndoEdit = computed(() => editUndoStack.value.length > 0)

  async function renderExportBlob(options: ExportOptions): Promise<Blob | null> {
    if (!imageElement.value) return null
    refreshDocumentAndLayouts()
    await ensureGoogleFontsLoaded([state.defaultFontFamily], {
      italic: state.calloutFontItalic,
    })
    return exportScene({
      image: imageElement.value,
      sections: state.sections,
      annotations: state.annotations,
      calloutLayouts: state.calloutLayouts,
      document: state.document,
      options,
      lineStyle: state.lineStyle,
      lineWidth: state.lineWidth,
      lineDashLength: state.lineDashLength,
      lineDashGap: state.lineDashGap,
      lineColor: state.lineColor,
      dotColor: state.lineColor,
      dotRadius: state.dotRadius,
      anchorStyle: state.anchorStyle,
      lineHaloWidth: state.lineHaloWidth,
      lineHaloColor: state.lineHaloColor,
      highlightMargin: state.highlightMargin,
      highlightFillEnabled: state.highlightFillEnabled,
      highlightFillOpacity: state.highlightFillOpacity,
      highlightCornerRadius: state.highlightCornerRadius,
      calloutFontSize: state.calloutFontSize,
      calloutFontWeight: state.calloutFontWeight,
      calloutFontItalic: state.calloutFontItalic,
      calloutBorderWidth: resolveCalloutBorderWidth(
        state.calloutBorderEnabled,
        state.lineWidth,
      ),
      calloutFillEnabled: state.calloutFillEnabled,
      calloutFillColor: state.calloutFillColor,
      calloutFillOpacity: state.calloutFillOpacity,
      calloutCornerRadius: state.calloutCornerRadius,
      pageBackgroundColor: state.pageBackgroundColor,
      fontFamily: state.defaultFontFamily,
    })
  }

  async function exportProject(options: ExportOptions): Promise<void> {
    if (!imageElement.value) return
    isExporting.value = true
    try {
      const blob = await renderExportBlob(options)
      if (!blob) return
      await downloadBlob(blob, `${options.filename}.${options.format}`)
    } finally {
      isExporting.value = false
    }
  }

  async function copyAnnotatedImageToClipboard(): Promise<void> {
    if (!imageElement.value) return
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
      throw new Error('Clipboard write is not supported in this browser')
    }

    isExporting.value = true
    try {
      // Safari/WKWebView revoke the clipboard-write permission granted by the
      // user gesture as soon as this async function awaits anything, so the
      // PNG must be produced by a promise handed to ClipboardItem rather than
      // awaited before clipboard.write() is called.
      const pngPromise = (async () => {
        const blob = await renderExportBlob({
          format: 'png',
          includeSectionGuides: false,
          scale: 2,
          filename: 'clipboard',
        })
        if (!blob) throw new Error('Failed to render image for clipboard')
        return blobToPngBlob(blob)
      })()

      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': pngPromise,
        }),
      ])
    } finally {
      isExporting.value = false
    }
  }

  function deleteSelection(): void {
    if (state.selectedAnnotationIds.length > 0) {
      removeAnnotations([...state.selectedAnnotationIds])
      return
    }
    if (state.selectedSectionIds.length > 0) {
      removeSections([...state.selectedSectionIds])
    }
  }

  // One-time boot: restore the last autosaved project and start watching for
  // edits to persist. Runs once per store instance (this setup() function
  // itself only runs once, Pinia caches the created store after that).
  initializePersistence(core)

  return {
    state: readonly(state),
    isDetecting: readonly(isDetecting),
    isRecognizingText: readonly(isRecognizingText),
    isExporting: readonly(isExporting),
    ocrLines: readonly(ocrLines),
    modelStatus: screenParser.status,
    modelDownloadProgress: screenParser.downloadProgress,
    modelError: screenParser.error,
    modelAwaitingUse: screenParser.awaitingUse,
    loadModel: screenParser.loadModel,
    awaitModelForUse: screenParser.awaitModelForUse,
    hasImage,
    activeNamedProject: readonly(activeNamedProject),
    sortedAnnotations,
    selectedAnnotations,
    documentWidth,
    documentHeight,
    labelPositions,
    canUndoCrop,
    undoEdit,
    canUndoEdit,
    imageElement: readonly(imageElement),
    loadImageFile: (file: File) => loadImageFile(core, file),
    replaceImageFile: (file: File) => replaceImageFile(core, file),
    flushPersistCurrentProject: () => flushPersistCurrentProject(core),
    clearCurrentProject: () => clearCurrentProject(core),
    cropImage: (rect: Rect, options?: { asNewProject?: boolean }) => cropImage(core, rect, options),
    undoCrop: () => undoCrop(core),
    runSectionDetection: () => runSectionDetection(core),
    rediscoverSectionsAfterReplace: () => rediscoverSectionsAfterReplace(core),
    setToolMode,
    setCropDraft,
    setDefaultFontFamily,
    getCommonSettings,
    applyCommonSettings,
    fetchCommonSettingsPresets,
    saveCommonSettingsAs,
    applyCommonSettingsPreset,
    removeCommonSettingsPreset,
    setLineStyle,
    setLineWidth,
    setLineDashLength,
    setLineDashGap,
    setLineColor,
    setDotRadius,
    setImageGutter,
    setHighlightMargin,
    setHighlightFillEnabled,
    setHighlightFillOpacity,
    setHighlightCornerRadius,
    setAnchorStyle,
    setLineHaloWidth,
    setLineHaloColor,
    setCalloutFontSize,
    setCalloutFontWeight,
    setCalloutFontItalic,
    setCalloutBorderEnabled,
    setCalloutFillEnabled,
    setCalloutFillColor,
    setCalloutFillOpacity,
    setCalloutCornerRadius,
    setPageBackgroundColor,
    toggleSectionVisibility,
    clearSelection,
    selectSection,
    selectAnnotation,
    selectAllAnnotations,
    addSection,
    updateSectionRect,
    removeSections,
    setSectionOutlineEnabled,
    setSectionOutlineHaloEnabled,
    toggleSectionOutline,
    toggleSectionOutlineHalo,
    createAnnotationForSection,
    addAnnotationAtPoint,
    updateAnnotation,
    updateAnnotations,
    updateAnnotationVariationText,
    updateCalloutPosition,
    updateAnchorOffset,
    patchSelectedAnnotations,
    commitDescription,
    addVariation,
    setActiveVariation,
    nudgeCalloutPositions,
    removeAnnotations,
    reorderAnnotations,
    assignNumberPrefixes,
    clearNumberPrefixes,
    exportProject,
    copyAnnotatedImageToClipboard,
    saveProjectToFile: () => saveProjectToFile(core),
    downloadAllProjectsBundle: () => downloadAllProjectsBundle(core),
    openProjectFile: (file: File) => openProjectFile(core, file),
    saveProjectAs: (name: string, overwriteId?: string) => saveProjectAs(core, name, overwriteId),
    setProjectName: (rawName: string) => setProjectName(core, rawName),
    fetchSavedProjects,
    loadSavedProject: (id: string) => loadSavedProject(core, id),
    removeSavedProject: (id: string) => removeSavedProject(core, id),
    deleteSelection,
    refreshDocumentAndLayouts,
  }
})
