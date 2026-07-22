import { computed, reactive, readonly, ref, watch } from 'vue'
import type {
  Annotation,
  ExportOptions,
  LineStyleId,
  NumberStyleId,
  Point,
  ProjectState,
  Rect,
  Section,
  ToolMode,
} from '../types/annotation'
import { createId } from '../utils/id'
import { DEFAULT_NUMBER_STYLE, sortByOrder } from '../utils/circledNumbers'
import { containmentRatio, normalizeRect, rectCenter } from '../utils/geometry'
import { createManualSection, detectSectionsML } from '../utils/mlSectionDetection'
import { recognizeTextFromImage, type OcrLineHit } from '../utils/ocr'
import { useScreenParser } from './useScreenParser'
import {
  layoutCalloutsForImage,
  createDefaultDocumentLayout,
} from '../utils/calloutLayout'
import { downloadBlob, exportScene } from '../utils/export'
import {
  DEFAULT_FONT_FAMILY,
  ensureGoogleFontsLoaded,
  loadGoogleFont,
} from '../utils/googleFonts'
import {
  CALLOUT_BORDER_WIDTH_MAX,
  CALLOUT_BORDER_WIDTH_MIN,
  CALLOUT_FONT_SIZE,
  CALLOUT_FONT_SIZE_MAX,
  CALLOUT_FONT_SIZE_MIN,
  DOT_RADIUS_MAX,
  DOT_RADIUS_MIN,
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
  clearAutosavedProject,
  deleteNamedProject,
  listSavedProjects,
  loadNamedProject,
  loadProject,
  saveNamedProject,
  saveProject,
  type ProjectSnapshot,
  type SavedProjectMeta,
} from '../utils/projectStorage'
import { buildProjectFile, parseProjectFile, suggestProjectFileName } from '../utils/projectFile'
import { t } from '../i18n'

const state = reactive<ProjectState>({
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
  lineHaloWidth: DEFAULT_LINE_HALO_WIDTH,
  lineHaloColor: DEFAULT_LINE_HALO_COLOR,
  calloutFontSize: CALLOUT_FONT_SIZE,
  calloutBorderWidth: 0,
  numberStyle: DEFAULT_NUMBER_STYLE,
  showSections: true,
  calloutLayouts: [],
  document: createDefaultDocumentLayout(0, 0, 0),
})

loadGoogleFont(DEFAULT_FONT_FAMILY)

const isDetecting = ref(false)
const isExporting = ref(false)
const imageElement = ref<HTMLImageElement | null>(null)
const ocrLines = ref<OcrLineHit[]>([])
/** Named browser save that receives periodic overwrite while editing. */
const activeNamedProject = ref<{ id: string; name: string } | null>(null)

interface ImageSnapshot {
  imageUrl: string
  imageElement: HTMLImageElement
  imageWidth: number
  imageHeight: number
  sections: Section[]
  annotations: Annotation[]
  ocrLines: OcrLineHit[]
}

/** Single-level undo snapshot for crop. */
const cropHistory = ref<ImageSnapshot | null>(null)

const screenParser = useScreenParser()
// Prefetch so the first detection does not wait on model load.
void screenParser.loadModel()

function reindexOrders(): void {
  const sorted = sortByOrder(state.annotations)
  sorted.forEach((annotation, annotationIndex) => {
    annotation.order = annotationIndex + 1
  })
}

function sanitizeAnnotation(raw: Annotation): Annotation {
  return {
    id: raw.id,
    sectionId: raw.sectionId,
    order: raw.order,
    description: raw.description,
    markerPosition: { ...raw.markerPosition },
    calloutSide: raw.calloutSide,
    calloutPosition: raw.calloutPosition
      ? { ...raw.calloutPosition }
      : null,
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
    state.numberStyle,
  )
  state.document = document
  state.calloutLayouts = layouts
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Failed to load image'))
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
      sectionId: annotation.sectionId,
      markerPosition: { ...annotation.markerPosition },
      calloutSide: annotation.calloutSide,
      calloutPosition: annotation.calloutPosition
        ? { ...annotation.calloutPosition }
        : null,
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
      state.numberStyle,
    ] as const,
  () => {
    refreshDocumentAndLayouts()
  },
)

interface RestorableFields {
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
  lineHaloWidth?: number
  lineHaloColor?: string
  /** @deprecated Prefer `lineHaloWidth`. */
  lineHalo?: boolean
  calloutFontSize: number
  calloutBorderWidth: number
  numberStyle?: NumberStyleId
  showSections: boolean
}

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
  state.lineColor = fields.lineColor
  state.dotColor = fields.lineColor
  state.dotRadius = fields.dotRadius
  state.lineHaloWidth = normalizeLineHaloWidth(fields.lineHaloWidth, fields.lineHalo)
  state.lineHaloColor = normalizeLineHaloColor(fields.lineHaloColor)
  state.calloutFontSize = fields.calloutFontSize
  state.calloutBorderWidth = fields.calloutBorderWidth
  state.numberStyle = fields.numberStyle ?? DEFAULT_NUMBER_STYLE
  state.showSections = fields.showSections
  state.selectedSectionIds = []
  state.selectedAnnotationIds = []
  ocrLines.value = fields.ocrLines
  await ensureGoogleFontsLoaded([state.defaultFontFamily])
  refreshDocumentAndLayouts()
}

let restored = false
let saveTimer: ReturnType<typeof setTimeout> | null = null
let namedSaveTimer: ReturnType<typeof setTimeout> | null = null
let namedSaveDirty = false
const SESSION_SAVE_DEBOUNCE_MS = 600
const NAMED_SAVE_DEBOUNCE_MS = 2500
const NAMED_SAVE_INTERVAL_MS = 30_000

async function restorePersistedProject(): Promise<void> {
  try {
    const snapshot = await loadProject()
    if (!snapshot) return
    await applyRestoredSnapshot(snapshot.imageBlob, snapshot)
    if (snapshot.activeNamedProjectId && snapshot.activeNamedProjectName) {
      activeNamedProject.value = {
        id: snapshot.activeNamedProjectId,
        name: snapshot.activeNamedProjectName,
      }
    }
  } catch (err) {
    console.warn('[ScreenDesc] failed to restore persisted project', err)
  } finally {
    restored = true
  }
}

async function buildCurrentSnapshot(): Promise<ProjectSnapshot | null> {
  if (!state.imageUrl) return null
  const imageBlob = await fetch(state.imageUrl).then((res) => res.blob())
  return {
    imageBlob,
    imageWidth: state.imageWidth,
    imageHeight: state.imageHeight,
    sections: state.sections,
    annotations: state.annotations.map(sanitizeAnnotation),
    ocrLines: ocrLines.value,
    defaultFontFamily: state.defaultFontFamily,
    lineStyle: state.lineStyle,
    lineWidth: state.lineWidth,
    lineColor: state.lineColor,
    dotColor: state.lineColor,
    dotRadius: state.dotRadius,
    lineHaloWidth: state.lineHaloWidth,
    lineHaloColor: state.lineHaloColor,
    calloutFontSize: state.calloutFontSize,
    calloutBorderWidth: state.calloutBorderWidth,
    numberStyle: state.numberStyle,
    showSections: state.showSections,
    activeNamedProjectId: activeNamedProject.value?.id ?? null,
    activeNamedProjectName: activeNamedProject.value?.name ?? null,
  }
}

async function persistCurrentProject(): Promise<void> {
  try {
    const snapshot = await buildCurrentSnapshot()
    if (!snapshot) return
    await saveProject(snapshot)
  } catch (err) {
    console.warn('[ScreenDesc] failed to persist project', err)
  }
}

async function persistActiveNamedProject(): Promise<void> {
  const active = activeNamedProject.value
  if (!active || !state.imageUrl) return
  try {
    const snapshot = await buildCurrentSnapshot()
    if (!snapshot) return
    await saveNamedProject(active.name, snapshot, active.id)
    namedSaveDirty = false
  } catch (err) {
    console.warn('[ScreenDesc] failed to auto-overwrite named project', err)
  }
}

function scheduleSave(): void {
  if (!restored || !state.imageUrl) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    void persistCurrentProject()
  }, SESSION_SAVE_DEBOUNCE_MS)

  if (!activeNamedProject.value) return
  namedSaveDirty = true
  if (namedSaveTimer) clearTimeout(namedSaveTimer)
  namedSaveTimer = setTimeout(() => {
    void persistActiveNamedProject()
  }, NAMED_SAVE_DEBOUNCE_MS)
}

function clearNamedSaveSchedule(): void {
  if (namedSaveTimer) {
    clearTimeout(namedSaveTimer)
    namedSaveTimer = null
  }
  namedSaveDirty = false
}

void restorePersistedProject()

watch(
  () => [
    state.imageUrl,
    state.sections,
    state.annotations,
    state.defaultFontFamily,
    state.lineStyle,
    state.lineWidth,
    state.lineColor,
    state.dotColor,
    state.dotRadius,
    state.lineHaloWidth,
    state.lineHaloColor,
    state.calloutFontSize,
    state.calloutBorderWidth,
    state.numberStyle,
    state.showSections,
  ],
  () => scheduleSave(),
  { deep: true },
)

if (typeof window !== 'undefined') {
  window.setInterval(() => {
    if (!namedSaveDirty || !activeNamedProject.value || !state.imageUrl) return
    void persistActiveNamedProject()
  }, NAMED_SAVE_INTERVAL_MS)
}

export function useAnnotationStore() {
  const hasImage = computed(() => Boolean(state.imageUrl))
  const sortedAnnotations = computed(() => sortByOrder(state.annotations))
  const canUndoCrop = computed(() => cropHistory.value !== null)

  async function runSectionDetection(): Promise<void> {
    if (!imageElement.value) return
    isDetecting.value = true
    try {
      const sections = await detectSectionsML(imageElement.value, screenParser)
      state.sections = sections
      state.showSections = true
      state.selectedSectionIds = []
    } finally {
      isDetecting.value = false
    }
  }

  async function applyImageSource(
    source: Blob,
    options: { revokePrevious?: boolean } = {},
  ): Promise<void> {
    const revokePrevious = options.revokePrevious ?? true
    if (revokePrevious && state.imageUrl) URL.revokeObjectURL(state.imageUrl)

    const url = URL.createObjectURL(source)
    const image = await loadImageElement(url)
    imageElement.value = image
    state.imageUrl = url
    state.imageWidth = image.naturalWidth
    state.imageHeight = image.naturalHeight
    state.sections = []
    state.annotations = []
    state.selectedSectionIds = []
    state.selectedAnnotationIds = []
    state.toolMode = 'select'
    state.showSections = true
    ocrLines.value = []

    const [, ocrResult] = await Promise.all([
      runSectionDetection(),
      recognizeTextFromImage(image),
    ])
    ocrLines.value = ocrResult.lines
    refreshDocumentAndLayouts()
  }

  async function loadImageFile(file: File): Promise<void> {
    if (cropHistory.value) {
      URL.revokeObjectURL(cropHistory.value.imageUrl)
      cropHistory.value = null
    }
    activeNamedProject.value = null
    clearNamedSaveSchedule()
    await applyImageSource(file)
  }

  async function clearCurrentProject(): Promise<void> {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    clearNamedSaveSchedule()
    activeNamedProject.value = null
    if (cropHistory.value) {
      URL.revokeObjectURL(cropHistory.value.imageUrl)
      cropHistory.value = null
    }
    if (state.imageUrl) URL.revokeObjectURL(state.imageUrl)

    imageElement.value = null
    ocrLines.value = []
    state.imageUrl = null
    state.imageWidth = 0
    state.imageHeight = 0
    state.sections = []
    state.annotations = []
    state.selectedSectionIds = []
    state.selectedAnnotationIds = []
    state.toolMode = 'select'
    state.showSections = true
    state.calloutLayouts = []
    state.document = createDefaultDocumentLayout(0, 0, 0)

    try {
      await clearAutosavedProject()
    } catch (err) {
      console.warn('[ScreenDesc] failed to clear autosaved project', err)
    }
  }

  async function cropImage(rect: Rect): Promise<void> {
    if (!imageElement.value || !state.imageUrl) return
    const normalized = normalizeRect(rect)
    const x = Math.max(0, Math.round(normalized.x))
    const y = Math.max(0, Math.round(normalized.y))
    const width = Math.max(1, Math.round(Math.min(normalized.width, state.imageWidth - x)))
    const height = Math.max(1, Math.round(Math.min(normalized.height, state.imageHeight - y)))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return
    context.drawImage(imageElement.value, x, y, width, height, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) return

    if (cropHistory.value) URL.revokeObjectURL(cropHistory.value.imageUrl)
    cropHistory.value = {
      imageUrl: state.imageUrl,
      imageElement: imageElement.value,
      imageWidth: state.imageWidth,
      imageHeight: state.imageHeight,
      sections: state.sections,
      annotations: state.annotations,
      ocrLines: ocrLines.value,
    }

    await applyImageSource(blob, { revokePrevious: false })
  }

  async function undoCrop(): Promise<void> {
    const snapshot = cropHistory.value
    if (!snapshot) return
    if (state.imageUrl) URL.revokeObjectURL(state.imageUrl)

    imageElement.value = snapshot.imageElement
    state.imageUrl = snapshot.imageUrl
    state.imageWidth = snapshot.imageWidth
    state.imageHeight = snapshot.imageHeight
    state.sections = snapshot.sections
    state.annotations = snapshot.annotations
    state.selectedSectionIds = []
    state.selectedAnnotationIds = []
    ocrLines.value = snapshot.ocrLines
    cropHistory.value = null

    refreshDocumentAndLayouts()
  }

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

  function setCalloutBorderWidth(width: number): void {
    state.calloutBorderWidth = Math.min(
      CALLOUT_BORDER_WIDTH_MAX,
      Math.max(CALLOUT_BORDER_WIDTH_MIN, width),
    )
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
    const section = createManualSection(normalized)
    state.sections.push(section)
    state.selectedSectionIds = [section.id]
    return section
  }

  function updateSectionRect(sectionId: string, rect: Rect): void {
    const section = state.sections.find((item) => item.id === sectionId)
    if (!section) return
    section.rect = normalizeRect(rect)
  }

  function removeSections(sectionIds: string[]): void {
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
    const center = rectCenter(section.rect)
    const annotation: Annotation = {
      id: createId('ann'),
      sectionId: section.id,
      order: state.annotations.length + 1,
      description: buildAutoDescription(section),
      markerPosition: { ...center },
      calloutSide: 'auto',
      calloutPosition: null,
    }
    state.annotations.push(annotation)
    reindexOrders()
    state.selectedAnnotationIds = [annotation.id]
    state.selectedSectionIds = [section.id]
    return annotation
  }

  function addAnnotationAtPoint(point: Point, sectionId: string | null = null): Annotation {
    const annotation: Annotation = {
      id: createId('ann'),
      sectionId,
      order: state.annotations.length + 1,
      description: '',
      markerPosition: { ...point },
      calloutSide: 'auto',
      calloutPosition: null,
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

  function updateAnnotation(
    annotationId: string,
    patch: Partial<
      Pick<
        Annotation,
        | 'description'
        | 'markerPosition'
        | 'calloutSide'
        | 'calloutPosition'
        | 'sectionId'
      >
    >,
  ): void {
    const annotation = state.annotations.find((item) => item.id === annotationId)
    if (!annotation) return
    Object.assign(annotation, patch)
  }

  function removeAnnotations(annotationIds: string[]): void {
    const idSet = new Set(annotationIds)
    state.annotations = state.annotations.filter((annotation) => !idSet.has(annotation.id))
    state.selectedAnnotationIds = state.selectedAnnotationIds.filter((id) => !idSet.has(id))
    reindexOrders()
  }

  function reorderAnnotations(orderedIds: string[]): void {
    orderedIds.forEach((annotationId, annotationIndex) => {
      const annotation = state.annotations.find((item) => item.id === annotationId)
      if (annotation) annotation.order = annotationIndex + 1
    })
  }

  async function exportProject(options: ExportOptions): Promise<void> {
    if (!imageElement.value) return
    isExporting.value = true
    try {
      refreshDocumentAndLayouts()
      await ensureGoogleFontsLoaded([state.defaultFontFamily])
      const blob = await exportScene({
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
        lineHaloWidth: state.lineHaloWidth,
        lineHaloColor: state.lineHaloColor,
        calloutFontSize: state.calloutFontSize,
        calloutBorderWidth: state.calloutBorderWidth,
        fontFamily: state.defaultFontFamily,
      })
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

  async function saveProjectToFile(): Promise<void> {
    const snapshot = await buildCurrentSnapshot()
    if (!snapshot) return
    const { imageBlob, ...fields } = snapshot
    const fileBlob = await buildProjectFile(imageBlob, fields)
    downloadBlob(fileBlob, suggestProjectFileName())
  }

  async function saveProjectAs(name: string, overwriteId?: string): Promise<string | null> {
    const snapshot = await buildCurrentSnapshot()
    if (!snapshot) return null
    const projectId = await saveNamedProject(name, snapshot, overwriteId)
    activeNamedProject.value = { id: projectId, name }
    namedSaveDirty = false
    if (namedSaveTimer) {
      clearTimeout(namedSaveTimer)
      namedSaveTimer = null
    }
    await persistCurrentProject()
    return projectId
  }

  async function fetchSavedProjects(): Promise<SavedProjectMeta[]> {
    return listSavedProjects()
  }

  async function loadSavedProject(id: string): Promise<void> {
    const snapshot = await loadNamedProject(id)
    if (!snapshot) throw new Error(t('error.savedProjectNotFound'))
    const metas = await listSavedProjects()
    const meta = metas.find((item) => item.id === id)
    if (cropHistory.value) {
      URL.revokeObjectURL(cropHistory.value.imageUrl)
      cropHistory.value = null
    }
    clearNamedSaveSchedule()
    await applyRestoredSnapshot(snapshot.imageBlob, snapshot)
    activeNamedProject.value = { id, name: meta?.name ?? 'Project' }
    await persistCurrentProject()
  }

  async function removeSavedProject(id: string): Promise<void> {
    await deleteNamedProject(id)
    if (activeNamedProject.value?.id === id) {
      activeNamedProject.value = null
      clearNamedSaveSchedule()
      await persistCurrentProject()
    }
  }

  async function loadProjectFromFile(file: File): Promise<void> {
    const data = await parseProjectFile(file)
    const imageBlob = await fetch(data.imageDataUrl).then((res) => res.blob())
    if (cropHistory.value) {
      URL.revokeObjectURL(cropHistory.value.imageUrl)
      cropHistory.value = null
    }
    activeNamedProject.value = null
    clearNamedSaveSchedule()
    await applyRestoredSnapshot(imageBlob, data)
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
    imageElement: readonly(imageElement),
    loadImageFile,
    clearCurrentProject,
    cropImage,
    undoCrop,
    runSectionDetection,
    setToolMode,
    setDefaultFontFamily,
    setLineStyle,
    setLineWidth,
    setLineColor,
    setDotRadius,
    setLineHaloWidth,
    setLineHaloColor,
    setCalloutFontSize,
    setCalloutBorderWidth,
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
    removeAnnotations,
    reorderAnnotations,
    exportProject,
    saveProjectToFile,
    loadProjectFromFile,
    saveProjectAs,
    fetchSavedProjects,
    loadSavedProject,
    removeSavedProject,
    deleteSelection,
    refreshDocumentAndLayouts,
  }
}
