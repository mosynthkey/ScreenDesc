import { computed, readonly } from 'vue'
import type {
  Annotation,
  AnchorStyleId,
  ExportOptions,
  LineStyleId,
  NumberStyleId,
  Point,
  Rect,
  Section,
  ToolMode,
} from '../types/annotation'
import { createId } from '../utils/id'
import { sortByOrder } from '../utils/circledNumbers'
import { normalizeRect, rectCenter } from '../utils/geometry'
import { createManualSection } from '../utils/mlSectionDetection'
import { downloadBlob, exportScene } from '../utils/export'
import { blobToPngBlob } from '../utils/export/imageDataUrl'
import { ensureGoogleFontsLoaded } from '../utils/googleFonts'
import {
  CALLOUT_FONT_SIZE_MAX,
  CALLOUT_FONT_SIZE_MIN,
  DOT_RADIUS_MAX,
  DOT_RADIUS_MIN,
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
import './projectPersistence'
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

  function setNumberStyle(style: NumberStyleId): void {
    state.numberStyle = style
    for (const annotation of state.annotations) {
      annotation.calloutPosition = null
    }
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

  function createAnnotationForSection(section: Section): Annotation {
    pushEditUndo()
    const center = rectCenter(section.rect)
    const annotation: Annotation = {
      id: createId('ann'),
      sectionId: section.id,
      order: state.annotations.length + 1,
      description: buildAutoDescription(section),
      markerPosition: { ...center },
      calloutSide: 'auto',
      calloutPosition: null,
      anchorOffset: { x: 0, y: 0 },
    }
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
      markerPosition: { ...point },
      calloutSide: 'auto',
      calloutPosition: null,
      anchorOffset: { x: 0, y: 0 },
    }
    state.annotations.push(annotation)
    reindexOrders()
    state.selectedAnnotationIds = [annotation.id]
    return annotation
  }

  async function setDefaultFontFamily(fontFamily: string): Promise<void> {
    state.defaultFontFamily = fontFamily
    await ensureGoogleFontsLoaded([fontFamily])
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
      anchorStyle: state.anchorStyle,
      lineHaloWidth: state.lineHaloWidth,
      lineHaloColor: state.lineHaloColor,
      calloutFontSize: state.calloutFontSize,
      calloutBorderEnabled: state.calloutBorderEnabled,
      calloutFillEnabled: state.calloutFillEnabled,
      calloutFillColor: state.calloutFillColor,
      calloutFillOpacity: state.calloutFillOpacity,
      pageBackgroundColor: state.pageBackgroundColor,
      numberStyle: state.numberStyle,
    }
  }

  async function applyCommonSettings(raw: CommonSettings): Promise<void> {
    const settings = normalizeCommonSettings(raw)
    if (!settings) return

    const fontChanged = settings.defaultFontFamily !== state.defaultFontFamily
    const layoutAffecting =
      fontChanged ||
      settings.calloutFontSize !== state.calloutFontSize ||
      settings.numberStyle !== state.numberStyle

    state.defaultFontFamily = settings.defaultFontFamily
    state.lineStyle = settings.lineStyle
    state.lineWidth = settings.lineWidth
    state.lineColor = settings.lineColor
    state.dotColor = settings.lineColor
    state.dotRadius = settings.dotRadius
    state.anchorStyle = settings.anchorStyle
    state.lineHaloWidth = settings.lineHaloWidth
    state.lineHaloColor = settings.lineHaloColor
    state.calloutFontSize = settings.calloutFontSize
    state.calloutBorderEnabled = settings.calloutBorderEnabled
    state.calloutFillEnabled = settings.calloutFillEnabled
    state.calloutFillColor = settings.calloutFillColor
    state.calloutFillOpacity = settings.calloutFillOpacity
    state.pageBackgroundColor = settings.pageBackgroundColor
    state.numberStyle = settings.numberStyle

    await ensureGoogleFontsLoaded([state.defaultFontFamily])
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
        : patch.description !== undefined
          ? `description:${annotationId}`
          : null
    pushEditUndo(coalesceKey)
    applyAnnotationPatch(annotation, patch)
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
    await ensureGoogleFontsLoaded([state.defaultFontFamily])
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
      calloutFontSize: state.calloutFontSize,
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
      downloadBlob(blob, `${options.filename}.${options.format}`)

      if (options.includeOriginal && state.imageUrl) {
        const originalBlob = await fetch(state.imageUrl).then((res) => res.blob())
        const ext = originalBlob.type.split('/')[1] ?? 'png'
        downloadBlob(originalBlob, `${options.filename}-original.${ext}`)
      }
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
      const blob = await renderExportBlob({
        format: 'png',
        includeSectionGuides: false,
        includeOriginal: false,
        scale: 2,
        filename: 'clipboard',
      })
      if (!blob) return

      const annotatedPng = await blobToPngBlob(blob)
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': annotatedPng,
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
    hasImage,
    activeNamedProject: readonly(activeNamedProject),
    sortedAnnotations,
    canUndoCrop,
    undoEdit,
    canUndoEdit,
    imageElement: readonly(imageElement),
    loadImageFile,
    replaceImageFile,
    clearCurrentProject,
    cropImage,
    undoCrop,
    runSectionDetection,
    rediscoverSectionsAfterReplace,
    setToolMode,
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
    setAnchorStyle,
    setLineHaloWidth,
    setLineHaloColor,
    setCalloutFontSize,
    setCalloutBorderEnabled,
    setCalloutFillEnabled,
    setCalloutFillColor,
    setCalloutFillOpacity,
    setPageBackgroundColor,
    setNumberStyle,
    toggleShowSections,
    clearSelection,
    selectSection,
    selectAnnotation,
    addSection,
    updateSectionRect,
    removeSections,
    createAnnotationForSection,
    addAnnotationAtPoint,
    updateAnnotation,
    updateAnnotations,
    nudgeCalloutPositions,
    removeAnnotations,
    reorderAnnotations,
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
