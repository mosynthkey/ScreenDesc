import type { Annotation, Section } from '../types/annotation'
import type { Rect } from '../types/annotation'
import { normalizeRect, pointInRect, containmentRatio } from '../utils/geometry'
import { createDefaultDocumentLayout } from '../utils/calloutLayout'
import { recognizeTextFromImage } from '../utils/ocr'
import { detectSectionsML } from '../utils/mlSectionDetection'
import { fitImageToExactSize, loadImageFromBlob } from '../utils/fitImageToSize'
import { defaultSectionVisibility } from '../utils/sectionVisibility'
import { t } from '../i18n'
import type { StoreCore } from '../stores/annotationStore'
import {
  clearAutosaveStorage,
  clearNamedSaveSchedule,
  clearSessionSaveSchedule,
  scheduleSave,
} from './projectPersistence'

export async function runSectionDetection(core: StoreCore): Promise<void> {
  const { state, imageElement, isDetecting, screenParser } = core
  if (!imageElement.value) return
  isDetecting.value = true
  try {
    const sections = await detectSectionsML(imageElement.value, screenParser)
    state.sections = sections
    state.sectionVisibility = defaultSectionVisibility()
    state.selectedSectionIds = []
  } finally {
    isDetecting.value = false
    // Only ever loaded for the duration of an analysis — unload right away
    // instead of holding the model (and its worker/WASM memory) in memory.
    screenParser.dispose()
  }
}

export async function rediscoverSectionsAfterReplace(core: StoreCore): Promise<void> {
  const { state, imageElement } = core
  if (!imageElement.value) return
  core.pushEditUndo()
  state.annotations = []
  state.selectedAnnotationIds = []
  await runSectionDetection(core)
  core.refreshDocumentAndLayouts()
}

async function applyImageSource(
  core: StoreCore,
  source: Blob,
  options: {
    revokePrevious?: boolean
    retainedAfterCrop?: { sections: Section[]; annotations: Annotation[] }
  } = {},
): Promise<void> {
  const { state, imageElement, ocrLines, isRecognizingText } = core
  const revokePrevious = options.revokePrevious ?? true
  if (revokePrevious && state.imageUrl) URL.revokeObjectURL(state.imageUrl)

  const url = URL.createObjectURL(source)
  const image = await core.loadImageElement(url)
  imageElement.value = image
  state.imageUrl = url
  state.imageWidth = image.naturalWidth
  state.imageHeight = image.naturalHeight
  state.sections = options.retainedAfterCrop?.sections ?? []
  state.annotations = options.retainedAfterCrop?.annotations ?? []
  state.selectedSectionIds = []
  state.selectedAnnotationIds = []
  state.toolMode = 'select'
  state.sectionVisibility = defaultSectionVisibility()
  ocrLines.value = []
  core.refreshDocumentAndLayouts()

  // Sequential, not parallel: each analysis step loads its own model, runs,
  // and unloads before the next one starts, so at most one model is ever
  // resident in memory at a time.
  await runSectionDetection(core)
  if (options.retainedAfterCrop) {
    state.sections = [...state.sections, ...options.retainedAfterCrop.sections]
    core.refreshDocumentAndLayouts()
  }

  isRecognizingText.value = true
  try {
    const ocrResult = await recognizeTextFromImage(image)
    ocrLines.value = ocrResult.lines
  } finally {
    isRecognizingText.value = false
  }
  core.refreshDocumentAndLayouts()
}

export async function loadImageFile(core: StoreCore, file: File): Promise<void> {
  const { state, cropHistory, activeNamedProject } = core
  if (cropHistory.value) {
    URL.revokeObjectURL(cropHistory.value.imageUrl)
    cropHistory.value = null
  }
  activeNamedProject.value = null
  clearNamedSaveSchedule()
  core.clearEditUndoStack()
  state.variations = []
  state.activeVariation = null
  await applyImageSource(core, file)
}

export async function replaceImageFile(core: StoreCore, file: File): Promise<void> {
  const { state, cropHistory, imageElement } = core
  if (!state.imageUrl || state.imageWidth <= 0 || state.imageHeight <= 0) {
    throw new Error(t('error.imageReplaceNoProject'))
  }

  const sourceImage = await loadImageFromBlob(file)
  const fitted = await fitImageToExactSize(
    sourceImage,
    state.imageWidth,
    state.imageHeight,
  )

  if (cropHistory.value) {
    URL.revokeObjectURL(cropHistory.value.imageUrl)
    cropHistory.value = null
  }

  if (state.imageUrl) URL.revokeObjectURL(state.imageUrl)
  const url = URL.createObjectURL(fitted.blob)
  const image = await core.loadImageElement(url)
  imageElement.value = image
  state.imageUrl = url
  state.imageWidth = image.naturalWidth
  state.imageHeight = image.naturalHeight
  core.refreshDocumentAndLayouts()
  scheduleSave(core)
}

export async function clearCurrentProject(core: StoreCore): Promise<void> {
  const { state, cropHistory, imageElement, ocrLines, activeNamedProject } = core
  clearSessionSaveSchedule()
  clearNamedSaveSchedule()
  activeNamedProject.value = null
  core.clearEditUndoStack()
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
  state.sectionVisibility = defaultSectionVisibility()
  state.calloutLayouts = []
  state.document = createDefaultDocumentLayout(0, 0, 0)
  state.variations = []
  state.activeVariation = null

  await clearAutosaveStorage()
}

/**
 * Sections/annotations that fall fully inside the crop rect, translated into
 * the cropped image's coordinate space. A section counts as "inside" when
 * (almost) entirely covered by the crop, not just touching it — otherwise a
 * section clipped in half would keep an annotation pointing at a target
 * that no longer fully exists in the new image.
 */
function retainedForCrop(
  sections: Section[],
  annotations: Annotation[],
  cropRect: Rect,
): { sections: Section[]; annotations: Annotation[] } {
  const keptSectionIds = new Set<string>()
  const nextSections: Section[] = []
  for (const section of sections) {
    if (containmentRatio(section.rect, cropRect) < 0.999) continue
    keptSectionIds.add(section.id)
    nextSections.push({
      ...section,
      rect: {
        x: section.rect.x - cropRect.x,
        y: section.rect.y - cropRect.y,
        width: section.rect.width,
        height: section.rect.height,
      },
    })
  }

  const nextAnnotations: Annotation[] = []
  for (const annotation of annotations) {
    if (annotation.sectionId) {
      if (!keptSectionIds.has(annotation.sectionId)) continue
      // Section-relative fields (anchorOffset) don't need shifting; the
      // section itself was already translated above. calloutPosition is a
      // manual override in document coords, which depend on margins that
      // are recomputed for the new image — drop it and let auto-layout
      // place the label again rather than leave it stranded.
      nextAnnotations.push({ ...annotation, calloutPosition: null })
      continue
    }
    if (!pointInRect(annotation.markerPosition, cropRect)) continue
    nextAnnotations.push({
      ...annotation,
      markerPosition: {
        x: annotation.markerPosition.x - cropRect.x,
        y: annotation.markerPosition.y - cropRect.y,
      },
      calloutPosition: null,
    })
  }

  return { sections: nextSections, annotations: nextAnnotations }
}

export async function cropImage(
  core: StoreCore,
  rect: Rect,
  options: { asNewProject?: boolean } = {},
): Promise<void> {
  const { state, imageElement, cropHistory, ocrLines, activeNamedProject } = core
  if (!imageElement.value || !state.imageUrl) return
  const normalized = normalizeRect(rect)
  const x = Math.max(0, Math.round(normalized.x))
  const y = Math.max(0, Math.round(normalized.y))
  const width = Math.max(1, Math.round(Math.min(normalized.width, state.imageWidth - x)))
  const height = Math.max(1, Math.round(Math.min(normalized.height, state.imageHeight - y)))
  const cropRect: Rect = { x, y, width, height }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return
  context.drawImage(imageElement.value, x, y, width, height, 0, 0, width, height)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) return

  if (options.asNewProject) {
    clearNamedSaveSchedule()
    activeNamedProject.value = null
  }

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

  const retained = retainedForCrop(state.sections, state.annotations, cropRect)

  core.clearEditUndoStack()
  await applyImageSource(core, blob, {
    revokePrevious: false,
    retainedAfterCrop: retained,
  })
}

export async function undoCrop(core: StoreCore): Promise<void> {
  const { state, imageElement, cropHistory, ocrLines } = core
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
  core.clearEditUndoStack()

  core.refreshDocumentAndLayouts()
}
