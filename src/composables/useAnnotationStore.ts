import { computed, readonly } from 'vue'
import type {
  Annotation,
  AnchorStyleId,
  CalloutSide,
  ExportOptions,
  LineStyleId,
  Point,
  Rect,
  Section,
  ToolMode,
} from '../types/annotation'
import { createId } from '../utils/id'
import { sortByOrder } from '../utils/circledNumbers'
import {
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
import { normalizeRect, rectCenter } from '../utils/geometry'
import { createManualSection } from '../utils/mlSectionDetection'
import { downloadBlob, exportScene } from '../utils/export'
import { blobToPngBlob } from '../utils/export/imageDataUrl'
import {
  calloutFontWeightForBold,
  ensureGoogleFontsLoaded,
  isCalloutFontBold,
  normalizeCalloutFontWeight,
} from '../utils/googleFonts'
import {
  CALLOUT_FONT_SIZE_MAX,
  CALLOUT_FONT_SIZE_MIN,
  DEFAULT_ANCHOR_OUTSIDE_GAP,
  DOT_RADIUS_MAX,
  DOT_RADIUS_MIN,
  normalizeAnchorOutsideGap,
  normalizeHighlightMargin,
  normalizeImageGutter,
} from '../utils/markerSize'
import {
  normalizeLineHaloColor,
  normalizeLineHaloWidth,
} from '../utils/lineStyle'
import {
  deleteCommonSettingsPreset,
  listCommonSettingsPresets,
  loadCommonSettingsPreset,
  normalizeCalloutFillColor,
  normalizeCalloutFillOpacity,
  normalizeCommonSettings,
  normalizeHighlightFillOpacity,
  normalizePageBackgroundColor,
  resolveCalloutBorderWidth,
  saveCommonSettingsPreset,
  type CommonSettings,
  type CommonSettingsPresetMeta,
} from '../utils/commonSettings'
import {
  activeNamedProject,
  buildAutoDescription,
  cropHistory,
  editUndoStack,
  imageElement,
  isDetecting,
  isExporting,
  pushEditUndo,
  reindexOrders,
  refreshDocumentAndLayouts,
  resetEditUndoCoalesce,
  restoreEditSnapshot,
  sanitizeAnchorOffset,
  screenParser,
  state,
} from './annotationStoreCore'
import { flushPersistCurrentProject } from './projectPersistence'
import {
  clearCurrentProject,
  cropImage,
  loadImageFile,
  rediscoverSectionsAfterReplace,
  replaceImageFile,
  runSectionDetection,
  undoCrop,
} from './projectImageLifecycle'
import {
  downloadAllProjectsBundle,
  fetchSavedProjects,
  loadSavedProject,
  openProjectFile,
  removeSavedProject,
  saveProjectAs,
  saveProjectToFile,
  setProjectName,
} from './projectFileIO'

export function useAnnotationStore() {
  const hasImage = computed(() => Boolean(state.imageUrl))
  const sortedAnnotations = computed(() => sortByOrder(state.annotations))
  const canUndoCrop = computed(() => cropHistory.value !== null)

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

  function setPageBackgroundColor(color: string): void {
    state.pageBackgroundColor = normalizePageBackgroundColor(color)
  }

  function toggleShowSections(): void {
    state.showSections = !state.showSections
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
      lineColor: state.lineColor,
      dotRadius: state.dotRadius,
      imageGutter: state.imageGutter,
      highlightMargin: state.highlightMargin,
      highlightFillEnabled: state.highlightFillEnabled,
      highlightFillOpacity: state.highlightFillOpacity,
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
    state.lineColor = settings.lineColor
    state.dotColor = settings.lineColor
    state.dotRadius = settings.dotRadius
    state.imageGutter = settings.imageGutter
    state.highlightMargin = settings.highlightMargin
    state.highlightFillEnabled = settings.highlightFillEnabled
    state.highlightFillOpacity = settings.highlightFillOpacity
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
      lineColor: state.lineColor,
      dotColor: state.lineColor,
      dotRadius: state.dotRadius,
      anchorStyle: state.anchorStyle,
      lineHaloWidth: state.lineHaloWidth,
      lineHaloColor: state.lineHaloColor,
      highlightMargin: state.highlightMargin,
      highlightFillEnabled: state.highlightFillEnabled,
      highlightFillOpacity: state.highlightFillOpacity,
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

  return {
    state: readonly(state),
    mutableState: state,
    isDetecting: readonly(isDetecting),
    isExporting: readonly(isExporting),
    modelStatus: screenParser.status,
    modelDownloadProgress: screenParser.downloadProgress,
    modelError: screenParser.error,
    modelAwaitingUse: screenParser.awaitingUse,
    loadModel: screenParser.loadModel,
    awaitModelForUse: screenParser.awaitModelForUse,
    hasImage,
    activeNamedProject: readonly(activeNamedProject),
    sortedAnnotations,
    canUndoCrop,
    undoEdit,
    canUndoEdit,
    imageElement: readonly(imageElement),
    loadImageFile,
    replaceImageFile,
    flushPersistCurrentProject,
    clearCurrentProject,
    cropImage,
    undoCrop,
    runSectionDetection,
    rediscoverSectionsAfterReplace,
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
    setLineColor,
    setDotRadius,
    setImageGutter,
    setHighlightMargin,
    setHighlightFillEnabled,
    setHighlightFillOpacity,
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
    setPageBackgroundColor,
    toggleShowSections,
    clearSelection,
    selectSection,
    selectAnnotation,
    selectAllAnnotations,
    addSection,
    updateSectionRect,
    removeSections,
    setSectionOutlineEnabled,
    setSectionOutlineHaloEnabled,
    createAnnotationForSection,
    addAnnotationAtPoint,
    updateAnnotation,
    updateAnnotations,
    updateAnnotationVariationText,
    addVariation,
    setActiveVariation,
    nudgeCalloutPositions,
    removeAnnotations,
    reorderAnnotations,
    assignNumberPrefixes,
    clearNumberPrefixes,
    exportProject,
    copyAnnotatedImageToClipboard,
    saveProjectToFile,
    downloadAllProjectsBundle,
    openProjectFile,
    saveProjectAs,
    setProjectName,
    fetchSavedProjects,
    loadSavedProject,
    removeSavedProject,
    deleteSelection,
    refreshDocumentAndLayouts,
  }
}
