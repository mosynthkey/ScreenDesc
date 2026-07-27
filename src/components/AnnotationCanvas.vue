<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type {
  Annotation,
  AnchorStyleId,
  CalloutLayoutItem,
  DocumentLayout,
  LineStyleId,
  Point,
  Rect,
  Section,
  ToolMode,
} from '../types/annotation'
import { pointInRect } from '../utils/geometry'
import { fontFamilyCss } from '../utils/googleFonts'
import { getLineStyleSpec } from '../utils/lineStyle'
import {
  buildAnchorArrowGeometry,
  buildAnchorHeadPath,
  dotLeaderAttachPoint,
  isArrowAnchorStyle,
  leaderAttachPoint,
  leaderLeaveUnit,
} from '../utils/anchorStyle'
import {
  buildLeaderPath,
  calloutLabelLineBaselineY,
  calloutLabelPadding,
  calloutLabelTextX,
  leaderAttachOnLabel,
} from '../utils/calloutLayout'
import { measureTextBaselineFromCenter } from '../utils/textMeasure'
import { resolveCalloutFill } from '../utils/commonSettings'
import { useCanvasViewport } from '../composables/useCanvasViewport'
import { useI18n } from '../i18n'

const { t } = useI18n()

const props = defineProps<{
  imageUrl: string
  document: DocumentLayout
  sections: Section[]
  annotations: Annotation[]
  calloutLayouts: CalloutLayoutItem[]
  selectedSectionIds: string[]
  selectedAnnotationIds: string[]
  toolMode: ToolMode
  showSections: boolean
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
  calloutBorderWidth: number
  calloutFillEnabled: boolean
  calloutFillColor: string
  calloutFillOpacity: number
  pageBackgroundColor: string
  fontFamily: string
  isDetecting?: boolean
  emptyHint?: boolean
  /** Figma-style adjustable crop rectangle (image-local coords) while `toolMode` is `'crop'`. */
  cropDraft?: Rect | null
}>()

const emit = defineEmits<{
  clearSelection: []
  selectSection: [id: string, additive: boolean]
  selectAnnotation: [id: string, additive: boolean]
  annotateSection: [sectionId: string]
  addAnnotationAt: [point: Point]
  updateSectionRect: [sectionId: string, rect: Rect]
  updateCalloutPosition: [annotationId: string, point: Point]
  nudgeCalloutPositions: [moves: Array<{ annotationId: string; position: Point }>]
  updateAnchorOffset: [annotationId: string, offset: Point]
  addSection: [rect: Rect]
  commitDescription: [annotationId: string, description: string]
  cropImage: [rect: Rect]
  updateCropDraft: [rect: Rect]
}>()

type DragState =
  | {
      kind: 'section-move'
      sectionId: string
      origin: Point
      startRect: Rect
    }
  | {
      kind: 'section-resize'
      sectionId: string
      handle: ResizeHandle
      origin: Point
      startRect: Rect
    }
  | {
      kind: 'callout'
      annotationId: string
      offset: Point
      /** Document-space start positions when dragging a multi-selection together. */
      groupStarts?: Record<string, Point>
    }
  | {
      kind: 'create-section'
      origin: Point
      current: Point
    }
  | {
      kind: 'anchor'
      annotationId: string
      /** anchorPoint minus current anchorOffset, i.e. the point offset=0 would sit at (image coords). */
      basePoint: Point
    }
  | {
      kind: 'crop-move'
      origin: Point
      startRect: Rect
    }
  | {
      kind: 'crop-resize'
      handle: CropHandle
      startRect: Rect
    }

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se'
type CropHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
const CROP_HANDLES: readonly CropHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const MIN_CROP_SIZE = 8

const viewportRef = ref<HTMLElement | null>(null)
const svgRef = ref<SVGSVGElement | null>(null)
const drag = ref<DragState | null>(null)
const editingId = ref<string | null>(null)
const editDraft = ref('')
const editInputRef = ref<HTMLInputElement | null>(null)
const pointerMoved = ref(false)
/** Ignore blur-to-commit while the editor is still mounting / focusing. */
let suppressEditBlurUntil = 0

// Chrome keeps PointerEvent.detail at 0; Safari may report the click count.
// Detect label double-clicks with a short window instead of relying on detail.
const CALLOUT_DOUBLE_CLICK_MS = 500
const CALLOUT_DOUBLE_CLICK_SLOP_PX = 6
let lastCalloutPointerDown: {
  annotationId: string
  at: number
  clientX: number
  clientY: number
} | null = null

function isCalloutDoubleClick(annotationId: string, event: PointerEvent): boolean {
  if (event.detail >= 2) return true
  const previous = lastCalloutPointerDown
  if (!previous || previous.annotationId !== annotationId) return false
  if (performance.now() - previous.at > CALLOUT_DOUBLE_CLICK_MS) return false
  const distance = Math.hypot(
    event.clientX - previous.clientX,
    event.clientY - previous.clientY,
  )
  return distance <= CALLOUT_DOUBLE_CLICK_SLOP_PX
}

const documentWidth = computed(
  () => props.document.marginLeft + props.document.imageWidth + props.document.marginRight,
)
const documentHeight = computed(
  () => props.document.marginTop + props.document.imageHeight + props.document.marginBottom,
)
const imageUrlKey = computed(() => props.imageUrl)

const { stageWidth, stageHeight } = useCanvasViewport({
  viewportRef,
  documentWidth,
  documentHeight,
  resetKey: imageUrlKey,
  onPinchStart: () => {
    drag.value = null
  },
})

function clientToDocument(event: PointerEvent): Point {
  const svg = svgRef.value
  if (!svg) return { x: 0, y: 0 }
  const rect = svg.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 }
  const scaleX = documentWidth.value / rect.width
  const scaleY = documentHeight.value / rect.height
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  }
}

function toImagePoint(documentPoint: Point): Point {
  return {
    x: documentPoint.x - props.document.marginLeft,
    y: documentPoint.y - props.document.marginTop,
  }
}

function clampToImage(point: Point): Point {
  return {
    x: Math.min(props.document.imageWidth, Math.max(0, point.x)),
    y: Math.min(props.document.imageHeight, Math.max(0, point.y)),
  }
}

function findSectionAt(imagePoint: Point): Section | undefined {
  const hits = props.sections.filter((section) => pointInRect(imagePoint, section.rect))
  return hits.sort(
    (left, right) => left.rect.width * left.rect.height - right.rect.width * right.rect.height,
  )[0]
}

/** Corner handles sit on the corner; edge handles sit at the midpoint of that edge. */
function cropHandlePosition(rect: Rect, handle: CropHandle): Point {
  const hasN = handle.includes('n')
  const hasS = handle.includes('s')
  const hasE = handle.includes('e')
  const hasW = handle.includes('w')
  return {
    x: hasW ? rect.x : hasE ? rect.x + rect.width : rect.x + rect.width / 2,
    y: hasN ? rect.y : hasS ? rect.y + rect.height : rect.y + rect.height / 2,
  }
}

function cropHandleCursor(handle: CropHandle): string {
  if (handle === 'n' || handle === 's') return 'ns-resize'
  if (handle === 'e' || handle === 'w') return 'ew-resize'
  if (handle === 'nw' || handle === 'se') return 'nwse-resize'
  return 'nesw-resize'
}

function onPointerDown(event: PointerEvent): void {
  if (event.button !== 0) return
  const target = event.target as Element
  const docPoint = clientToDocument(event)
  const imagePoint = clampToImage(toImagePoint(docPoint))

  if (props.toolMode === 'crop') {
    pointerMoved.value = false
    ;(event.currentTarget as Element).setPointerCapture?.(event.pointerId)
    const cropDraft = props.cropDraft
    if (!cropDraft) return
    const cropHandle = target
      .closest('[data-crop-handle]')
      ?.getAttribute('data-crop-handle') as CropHandle | null
    if (cropHandle) {
      drag.value = { kind: 'crop-resize', handle: cropHandle, startRect: { ...cropDraft } }
      return
    }
    if (pointInRect(imagePoint, cropDraft)) {
      drag.value = { kind: 'crop-move', origin: imagePoint, startRect: { ...cropDraft } }
    }
    return
  }

  const handle = (target.closest('[data-handle]')?.getAttribute('data-handle') ??
    null) as ResizeHandle | null
  const sectionId = target.closest('[data-section]')?.getAttribute('data-section')
  const calloutId = target.closest('[data-callout-label]')?.getAttribute('data-callout-label')
  const anchorId = target.closest('[data-anchor]')?.getAttribute('data-anchor')

  // Second click of a double-click: edit instead of starting a drag.
  if (calloutId && isCalloutDoubleClick(calloutId, event)) {
    lastCalloutPointerDown = null
    event.preventDefault()
    void beginEdit(calloutId)
    return
  }
  if (calloutId) {
    lastCalloutPointerDown = {
      annotationId: calloutId,
      at: performance.now(),
      clientX: event.clientX,
      clientY: event.clientY,
    }
  } else {
    lastCalloutPointerDown = null
  }

  if (editingId.value && !target.closest('.callout-inplace-edit')) {
    commitEdit()
  }

  pointerMoved.value = false
  ;(event.currentTarget as Element).setPointerCapture?.(event.pointerId)

  if (anchorId) {
    const layout = props.calloutLayouts.find((item) => item.annotationId === anchorId)
    const annotation = props.annotations.find((item) => item.id === anchorId)
    if (!layout || !annotation) return
    if (!props.selectedAnnotationIds.includes(anchorId)) {
      emit('selectAnnotation', anchorId, event.shiftKey)
    }
    const anchorImagePoint = toImagePoint(layout.anchorPoint)
    drag.value = {
      kind: 'anchor',
      annotationId: anchorId,
      basePoint: {
        x: anchorImagePoint.x - annotation.anchorOffset.x,
        y: anchorImagePoint.y - annotation.anchorOffset.y,
      },
    }
    return
  }

  if (calloutId) {
    const layout = props.calloutLayouts.find((item) => item.annotationId === calloutId)
    if (!layout) return
    const additive = event.shiftKey
    const alreadySelected = props.selectedAnnotationIds.includes(calloutId)
    const keepGroup =
      !additive && alreadySelected && props.selectedAnnotationIds.length > 1
    if (!keepGroup) {
      emit('selectAnnotation', calloutId, additive)
    }
    if (additive) return

    const movingIds = keepGroup ? [...props.selectedAnnotationIds] : [calloutId]
    const groupStarts: Record<string, Point> = {}
    for (const annotationId of movingIds) {
      const itemLayout = props.calloutLayouts.find((item) => item.annotationId === annotationId)
      if (itemLayout) {
        groupStarts[annotationId] = { ...itemLayout.labelPosition }
      }
    }

    drag.value = {
      kind: 'callout',
      annotationId: calloutId,
      offset: {
        x: layout.labelPosition.x - docPoint.x,
        y: layout.labelPosition.y - docPoint.y,
      },
      groupStarts: Object.keys(groupStarts).length > 1 ? groupStarts : undefined,
    }
    return
  }

  if (handle && sectionId) {
    const section = props.sections.find((item) => item.id === sectionId)
    if (!section) return
    emit('selectSection', sectionId, event.shiftKey)
    drag.value = {
      kind: 'section-resize',
      sectionId,
      handle,
      origin: imagePoint,
      startRect: { ...section.rect },
    }
    return
  }

  if (sectionId && props.toolMode === 'select') {
    const section = props.sections.find((item) => item.id === sectionId)
    if (!section) return
    emit('selectSection', sectionId, event.shiftKey)
    drag.value = {
      kind: 'section-move',
      sectionId,
      origin: imagePoint,
      startRect: { ...section.rect },
    }
    return
  }

  if (props.toolMode === 'add-section') {
    drag.value = {
      kind: 'create-section',
      origin: imagePoint,
      current: imagePoint,
    }
    return
  }

  if (props.toolMode === 'annotate') {
    const section = sectionId
      ? props.sections.find((item) => item.id === sectionId)
      : findSectionAt(imagePoint)

    if (section) {
      emit('annotateSection', section.id)
      return
    }
    emit('addAnnotationAt', imagePoint)
    return
  }

  if (sectionId) {
    emit('selectSection', sectionId, event.shiftKey)
    return
  }
  emit('clearSelection')
}

function onPointerMove(event: PointerEvent): void {
  if (!drag.value) return
  const docPoint = clientToDocument(event)
  const imagePoint = clampToImage(toImagePoint(docPoint))

  if (
    drag.value.kind === 'section-move' ||
    drag.value.kind === 'section-resize' ||
    drag.value.kind === 'create-section'
  ) {
    const dx = imagePoint.x - drag.value.origin.x
    const dy = imagePoint.y - drag.value.origin.y
    if (Math.hypot(dx, dy) > 3) {
      pointerMoved.value = true
    }
  }

  if (drag.value.kind === 'anchor') {
    emit('updateAnchorOffset', drag.value.annotationId, {
      x: imagePoint.x - drag.value.basePoint.x,
      y: imagePoint.y - drag.value.basePoint.y,
    })
    return
  }

  if (drag.value.kind === 'callout') {
    const nextPrimary = {
      x: docPoint.x + drag.value.offset.x,
      y: docPoint.y + drag.value.offset.y,
    }
    const groupStarts = drag.value.groupStarts
    if (groupStarts) {
      const startPrimary = groupStarts[drag.value.annotationId]
      if (!startPrimary) return
      const deltaX = nextPrimary.x - startPrimary.x
      const deltaY = nextPrimary.y - startPrimary.y
      emit(
        'nudgeCalloutPositions',
        Object.entries(groupStarts).map(([annotationId, start]) => ({
          annotationId,
          position: { x: start.x + deltaX, y: start.y + deltaY },
        })),
      )
      return
    }
    emit('updateCalloutPosition', drag.value.annotationId, nextPrimary)
    return
  }

  if (drag.value.kind === 'create-section') {
    drag.value = {
      ...drag.value,
      current: imagePoint,
    }
    return
  }

  if (drag.value.kind === 'section-move') {
    const dx = imagePoint.x - drag.value.origin.x
    const dy = imagePoint.y - drag.value.origin.y
    const start = drag.value.startRect
    emit('updateSectionRect', drag.value.sectionId, {
      x: Math.min(
        props.document.imageWidth - start.width,
        Math.max(0, start.x + dx),
      ),
      y: Math.min(
        props.document.imageHeight - start.height,
        Math.max(0, start.y + dy),
      ),
      width: start.width,
      height: start.height,
    })
    return
  }

  if (drag.value.kind === 'section-resize') {
    const start = drag.value.startRect
    let x = start.x
    let y = start.y
    let width = start.width
    let height = start.height

    if (drag.value.handle.includes('e')) {
      width = Math.max(12, imagePoint.x - start.x)
    }
    if (drag.value.handle.includes('s')) {
      height = Math.max(12, imagePoint.y - start.y)
    }
    if (drag.value.handle.includes('w')) {
      const right = start.x + start.width
      x = Math.min(imagePoint.x, right - 12)
      width = right - x
    }
    if (drag.value.handle.includes('n')) {
      const bottom = start.y + start.height
      y = Math.min(imagePoint.y, bottom - 12)
      height = bottom - y
    }

    emit('updateSectionRect', drag.value.sectionId, { x, y, width, height })
    return
  }

  if (drag.value.kind === 'crop-move') {
    const dx = imagePoint.x - drag.value.origin.x
    const dy = imagePoint.y - drag.value.origin.y
    const start = drag.value.startRect
    emit('updateCropDraft', {
      x: Math.min(props.document.imageWidth - start.width, Math.max(0, start.x + dx)),
      y: Math.min(props.document.imageHeight - start.height, Math.max(0, start.y + dy)),
      width: start.width,
      height: start.height,
    })
    return
  }

  if (drag.value.kind === 'crop-resize') {
    // imagePoint is already clamped to the image bounds, so these never
    // reach past the edge the way section-resize's unclamped drag can.
    const start = drag.value.startRect
    let x = start.x
    let y = start.y
    let width = start.width
    let height = start.height

    if (drag.value.handle.includes('e')) {
      width = Math.max(MIN_CROP_SIZE, imagePoint.x - start.x)
    }
    if (drag.value.handle.includes('s')) {
      height = Math.max(MIN_CROP_SIZE, imagePoint.y - start.y)
    }
    if (drag.value.handle.includes('w')) {
      const right = start.x + start.width
      x = Math.min(imagePoint.x, right - MIN_CROP_SIZE)
      width = right - x
    }
    if (drag.value.handle.includes('n')) {
      const bottom = start.y + start.height
      y = Math.min(imagePoint.y, bottom - MIN_CROP_SIZE)
      height = bottom - y
    }

    emit('updateCropDraft', { x, y, width, height })
  }
}

function onPointerUp(): void {
  if (drag.value?.kind === 'create-section') {
    const x = Math.min(drag.value.origin.x, drag.value.current.x)
    const y = Math.min(drag.value.origin.y, drag.value.current.y)
    const width = Math.abs(drag.value.current.x - drag.value.origin.x)
    const height = Math.abs(drag.value.current.y - drag.value.origin.y)
    if (width >= 8 && height >= 8) {
      emit('addSection', { x, y, width, height })
    }
  }

  pointerMoved.value = false
  drag.value = null
}

async function beginEdit(annotationId: string): Promise<void> {
  const annotation = props.annotations.find((item) => item.id === annotationId)
  if (!annotation) return
  drag.value = null
  pointerMoved.value = false
  suppressEditBlurUntil = performance.now() + 400
  editingId.value = annotationId
  editDraft.value = annotation.description
  emit('selectAnnotation', annotationId, false)
  await nextTick()
  const input = editInputRef.value
  if (!input) return
  input.focus({ preventScroll: true })
  input.select()
}

function onDblClick(event: MouseEvent): void {
  event.preventDefault()
  const target = event.target as Element
  const annotationId = target.closest('[data-callout-label]')?.getAttribute('data-callout-label')
  if (!annotationId || editingId.value === annotationId) return
  void beginEdit(annotationId)
}

function commitEdit(): void {
  if (!editingId.value) return
  emit('commitDescription', editingId.value, editDraft.value)
  editingId.value = null
}

/** Ignore the Enter/Escape used to confirm or cancel an IME conversion candidate. */
function onEditEnterKeydown(event: KeyboardEvent): void {
  if (event.isComposing) return
  event.preventDefault()
  commitEdit()
}

function onEditEscapeKeydown(event: KeyboardEvent): void {
  if (event.isComposing) return
  event.preventDefault()
  cancelEdit()
}

function cancelEdit(): void {
  editingId.value = null
}

function onEditBlur(): void {
  if (performance.now() < suppressEditBlurUntil) {
    requestAnimationFrame(() => {
      editInputRef.value?.focus({ preventScroll: true })
    })
    return
  }
  commitEdit()
}

const screenScale = computed(() =>
  documentWidth.value > 0 ? stageWidth.value / documentWidth.value : 1,
)

const editingCalloutLayout = computed(() => {
  if (!editingId.value) return null
  return props.calloutLayouts.find((item) => item.annotationId === editingId.value) ?? null
})

const draftSection = computed(() => {
  if (drag.value?.kind !== 'create-section') return null
  const x = Math.min(drag.value.origin.x, drag.value.current.x)
  const y = Math.min(drag.value.origin.y, drag.value.current.y)
  return {
    x: props.document.marginLeft + x,
    y: props.document.marginTop + y,
    width: Math.abs(drag.value.current.x - drag.value.origin.x),
    height: Math.abs(drag.value.current.y - drag.value.origin.y),
  }
})

function layoutFor(annotationId: string): CalloutLayoutItem | undefined {
  return props.calloutLayouts.find((item) => item.annotationId === annotationId)
}

const activeFontFamily = computed(() => fontFamilyCss(props.fontFamily))

function calloutTextPadding(): { horizontal: number; vertical: number } {
  return calloutLabelPadding(props.calloutFontSize)
}

function calloutTextX(layout: CalloutLayoutItem): number {
  return calloutLabelTextX(
    layout.labelPosition.x,
    layout.labelWidth,
    layout.lines[0] ?? '',
    props.calloutFontSize,
    activeFontFamily.value,
    props.calloutFontWeight,
    props.calloutFontItalic,
  )
}

function calloutLineY(layout: CalloutLayoutItem, lineIndex: number): number {
  const line = layout.lines[lineIndex] ?? ''
  const baselineFromCenter = measureTextBaselineFromCenter(
    line,
    props.calloutFontSize,
    activeFontFamily.value,
    props.calloutFontWeight,
    props.calloutFontItalic,
  )
  return calloutLabelLineBaselineY(
    layout.labelPosition.y,
    layout.labelHeight,
    layout.lines.length,
    lineIndex,
    props.calloutFontSize,
    baselineFromCenter,
  )
}

const activeLineStyle = computed(() => getLineStyleSpec(props.lineStyle, props.lineWidth))
const effectiveLineColor = computed(() => (props.lineStyle === 'invert' ? '#ffffff' : props.lineColor))
const effectiveDotColor = computed(() => (props.lineStyle === 'invert' ? '#ffffff' : props.dotColor))
const calloutFill = computed(() =>
  resolveCalloutFill(props.calloutFillEnabled, props.calloutFillColor, props.calloutFillOpacity),
)

function leaderEnd(layout: CalloutLayoutItem): Point {
  return leaderAttachOnLabel(layout)
}

function leaderStartFor(layout: CalloutLayoutItem): Point {
  if (isArrowAnchorStyle(props.anchorStyle)) {
    return leaderAttachPoint(
      props.anchorStyle,
      buildAnchorArrowGeometry(layout.anchorPoint, layout.targetCenter, props.dotRadius),
    )
  }
  return dotLeaderAttachPoint(layout.anchorPoint)
}

function leaderPathFor(layout: CalloutLayoutItem): string {
  const end = leaderEnd(layout)
  const leave = leaderLeaveUnit(layout.anchorPoint, layout.targetCenter)
  return buildLeaderPath(leaderStartFor(layout), end.x, end.y, leave)
}

function anchorHeadPathFor(layout: CalloutLayoutItem): string {
  if (!isArrowAnchorStyle(props.anchorStyle)) return ''
  const geometry = buildAnchorArrowGeometry(layout.anchorPoint, layout.targetCenter, props.dotRadius)
  return buildAnchorHeadPath(props.anchorStyle, geometry)
}

</script>

<template>
  <div ref="viewportRef" class="canvas-area">
    <div v-if="emptyHint && !isDetecting" class="canvas-banner">
      {{ t('canvas.emptyHint') }}
    </div>
    <div v-if="isDetecting" class="canvas-banner detecting">{{ t('canvas.detecting') }}</div>
    <div
      class="canvas-stage"
      :style="{ width: `${stageWidth}px`, height: `${stageHeight}px` }"
    >
    <svg
      ref="svgRef"
      class="scene"
      :class="`tool-${toolMode}`"
      :viewBox="`0 0 ${documentWidth} ${documentHeight}`"
      :width="documentWidth"
      :height="documentHeight"
      preserveAspectRatio="xMidYMid meet"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @dblclick="onDblClick"
    >
      <rect
        class="page-bg"
        x="0"
        y="0"
        :width="documentWidth"
        :height="documentHeight"
        :fill="pageBackgroundColor"
      />

      <image
        :href="imageUrl"
        :x="document.marginLeft"
        :y="document.marginTop"
        :width="document.imageWidth"
        :height="document.imageHeight"
        preserveAspectRatio="none"
      />

      <!-- Sections -->
      <g v-if="showSections">
        <g
          v-for="section in sections"
          :key="section.id"
          class="section"
          :class="{ selected: selectedSectionIds.includes(section.id) }"
        >
          <rect
            :data-section="section.id"
            :x="document.marginLeft + section.rect.x"
            :y="document.marginTop + section.rect.y"
            :width="section.rect.width"
            :height="section.rect.height"
            class="section-rect"
          />
          <template v-if="selectedSectionIds.includes(section.id) && toolMode === 'select'">
            <rect
              v-for="handle in ['nw', 'ne', 'sw', 'se']"
              :key="handle"
              class="handle"
              :data-section="section.id"
              :data-handle="handle"
              :x="
                document.marginLeft +
                section.rect.x +
                (handle.includes('e') ? section.rect.width : 0) -
                4
              "
              :y="
                document.marginTop +
                section.rect.y +
                (handle.includes('s') ? section.rect.height : 0) -
                4
              "
              width="8"
              height="8"
            />
          </template>
        </g>
      </g>

      <rect
        v-if="draftSection"
        class="draft-section"
        :x="draftSection.x"
        :y="draftSection.y"
        :width="draftSection.width"
        :height="draftSection.height"
      />

      <g v-for="annotation in annotations" :key="annotation.id">
        <template v-if="layoutFor(annotation.id)">
          <g :style="activeLineStyle.blendMode ? { mixBlendMode: activeLineStyle.blendMode } : undefined">
            <template v-if="isArrowAnchorStyle(anchorStyle)">
              <!-- Separate paths: a filled combined path paints the open cubic as a ribbon. -->
              <path
                v-if="lineHaloWidth > 0 && lineStyle !== 'invert'"
                class="leader-halo"
                :d="leaderPathFor(layoutFor(annotation.id)!)"
                fill="none"
                :style="{
                  stroke: lineHaloColor,
                  strokeWidth: activeLineStyle.strokeWidth + lineHaloWidth,
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                }"
              />
              <path
                v-if="lineHaloWidth > 0 && lineStyle !== 'invert'"
                class="anchor-head-halo"
                :d="anchorHeadPathFor(layoutFor(annotation.id)!)"
                fill="none"
                :style="{
                  stroke: lineHaloColor,
                  strokeWidth: activeLineStyle.strokeWidth + lineHaloWidth,
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                }"
              />
              <path
                class="anchor-head"
                :d="anchorHeadPathFor(layoutFor(annotation.id)!)"
                :fill="anchorStyle === 'arrow' ? effectiveDotColor : 'none'"
                :style="{
                  stroke: effectiveLineColor,
                  strokeWidth: activeLineStyle.strokeWidth,
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                }"
              />
              <path
                class="leader"
                :d="leaderPathFor(layoutFor(annotation.id)!)"
                fill="none"
                :style="{
                  stroke: effectiveLineColor,
                  strokeWidth: activeLineStyle.strokeWidth,
                  strokeDasharray: activeLineStyle.dasharray ?? 'none',
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                }"
              />
            </template>
            <template v-else-if="anchorStyle === 'none'">
              <path
                v-if="lineHaloWidth > 0 && lineStyle !== 'invert'"
                class="leader-halo"
                :d="leaderPathFor(layoutFor(annotation.id)!)"
                fill="none"
                :style="{
                  stroke: lineHaloColor,
                  strokeWidth: activeLineStyle.strokeWidth + lineHaloWidth,
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                }"
              />
              <path
                class="leader"
                :d="leaderPathFor(layoutFor(annotation.id)!)"
                fill="none"
                :style="{
                  stroke: effectiveLineColor,
                  strokeWidth: activeLineStyle.strokeWidth,
                  strokeDasharray: activeLineStyle.dasharray ?? 'none',
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                }"
              />
            </template>
            <template v-else>
              <path
                v-if="lineHaloWidth > 0 && lineStyle !== 'invert'"
                class="leader-halo"
                :d="leaderPathFor(layoutFor(annotation.id)!)"
                fill="none"
                :style="{
                  stroke: lineHaloColor,
                  strokeWidth: activeLineStyle.strokeWidth + lineHaloWidth,
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                }"
              />
              <path
                class="leader"
                :d="leaderPathFor(layoutFor(annotation.id)!)"
                fill="none"
                :style="{
                  stroke: effectiveLineColor,
                  strokeWidth: activeLineStyle.strokeWidth,
                  strokeDasharray: activeLineStyle.dasharray ?? 'none',
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                }"
              />
              <circle
                v-if="lineHaloWidth > 0 && lineStyle !== 'invert'"
                class="anchor-dot-halo"
                :cx="layoutFor(annotation.id)!.anchorPoint.x"
                :cy="layoutFor(annotation.id)!.anchorPoint.y"
                :r="dotRadius"
                fill="none"
                :style="{
                  stroke: lineHaloColor,
                  strokeWidth: activeLineStyle.strokeWidth + lineHaloWidth,
                }"
              />
              <circle
                class="anchor-dot"
                :cx="layoutFor(annotation.id)!.anchorPoint.x"
                :cy="layoutFor(annotation.id)!.anchorPoint.y"
                :r="dotRadius"
                :style="{
                  fill: effectiveDotColor,
                  stroke: effectiveLineColor,
                  strokeWidth: activeLineStyle.strokeWidth,
                }"
              />
            </template>
            <circle
              :data-anchor="annotation.id"
              class="anchor-hit-area"
              :cx="layoutFor(annotation.id)!.anchorPoint.x"
              :cy="layoutFor(annotation.id)!.anchorPoint.y"
              :r="Math.max(14, dotRadius + 8)"
              fill="transparent"
            />
          </g>
          <g
            :data-callout-label="annotation.id"
            :class="{ selected: selectedAnnotationIds.includes(annotation.id) }"
          >
            <rect
              :data-callout-label="annotation.id"
              class="callout-label"
              :x="layoutFor(annotation.id)!.labelPosition.x"
              :y="layoutFor(annotation.id)!.labelPosition.y"
              :width="layoutFor(annotation.id)!.labelWidth"
              :height="layoutFor(annotation.id)!.labelHeight"
              rx="6"
              :style="{
                fill: calloutFill.fill,
                fillOpacity: calloutFill.fillOpacity,
                stroke: effectiveDotColor,
                strokeWidth: selectedAnnotationIds.includes(annotation.id)
                  ? calloutBorderWidth + 0.75
                  : calloutBorderWidth,
              }"
            />
            <text
              v-show="editingId !== annotation.id"
              :data-callout-label="annotation.id"
              class="callout-text"
              :x="calloutTextX(layoutFor(annotation.id)!)"
              :font-size="calloutFontSize"
              :font-weight="calloutFontWeight"
              :font-style="calloutFontItalic ? 'italic' : 'normal'"
              :style="{ fontFamily: activeFontFamily }"
            >
              <tspan
                v-for="(line, lineIndex) in layoutFor(annotation.id)!.lines"
                :key="lineIndex"
                :data-callout-label="annotation.id"
                :x="calloutTextX(layoutFor(annotation.id)!)"
                :y="calloutLineY(layoutFor(annotation.id)!, lineIndex)"
              >{{ line }}</tspan>
            </text>
          </g>
        </template>
      </g>

      <g v-if="toolMode === 'crop' && cropDraft" class="crop-overlay">
        <rect
          class="crop-dim"
          :x="document.marginLeft"
          :y="document.marginTop"
          :width="document.imageWidth"
          :height="cropDraft.y"
        />
        <rect
          class="crop-dim"
          :x="document.marginLeft"
          :y="document.marginTop + cropDraft.y + cropDraft.height"
          :width="document.imageWidth"
          :height="Math.max(0, document.imageHeight - cropDraft.y - cropDraft.height)"
        />
        <rect
          class="crop-dim"
          :x="document.marginLeft"
          :y="document.marginTop + cropDraft.y"
          :width="cropDraft.x"
          :height="cropDraft.height"
        />
        <rect
          class="crop-dim"
          :x="document.marginLeft + cropDraft.x + cropDraft.width"
          :y="document.marginTop + cropDraft.y"
          :width="Math.max(0, document.imageWidth - cropDraft.x - cropDraft.width)"
          :height="cropDraft.height"
        />
        <rect
          class="crop-outline"
          fill="transparent"
          :x="document.marginLeft + cropDraft.x"
          :y="document.marginTop + cropDraft.y"
          :width="cropDraft.width"
          :height="cropDraft.height"
        />
        <rect
          v-for="handle in CROP_HANDLES"
          :key="handle"
          class="crop-handle"
          :data-crop-handle="handle"
          :x="document.marginLeft + cropHandlePosition(cropDraft, handle).x - 6"
          :y="document.marginTop + cropHandlePosition(cropDraft, handle).y - 6"
          width="12"
          height="12"
          :style="{ cursor: cropHandleCursor(handle) }"
        />
      </g>
    </svg>

      <div
        v-if="editingId && editingCalloutLayout"
        class="callout-inplace-edit"
        :style="{
          left: `${editingCalloutLayout.labelPosition.x * screenScale}px`,
          top: `${editingCalloutLayout.labelPosition.y * screenScale}px`,
          width: `${editingCalloutLayout.labelWidth * screenScale}px`,
          minHeight: `${editingCalloutLayout.labelHeight * screenScale}px`,
          fontFamily: activeFontFamily,
          fontSize: `${calloutFontSize * screenScale}px`,
          fontWeight: calloutFontWeight,
          fontStyle: calloutFontItalic ? 'italic' : 'normal',
          padding: `0 ${calloutTextPadding().horizontal * screenScale}px`,
        }"
        @pointerdown.stop
      >
        <input
          ref="editInputRef"
          v-model="editDraft"
          type="text"
          @keydown.enter="onEditEnterKeydown"
          @keydown.escape="onEditEscapeKeydown"
          @blur="onEditBlur"
        />
      </div>
    </div>

  </div>
</template>

<style scoped>
.canvas-area {
  /* Pan via scroll; pinch is handled in JS so chrome stays unscaled */
  touch-action: pan-x pan-y;
  overscroll-behavior: contain;
}

.canvas-stage {
  position: relative;
  margin: 24px;
  flex: 0 0 auto;
}

.callout-inplace-edit {
  position: absolute;
  z-index: 4;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  border-radius: 6px;
  background: #fff;
  border: 1.5px solid var(--selection);
  box-shadow: var(--shadow);
}

.callout-inplace-edit input {
  width: 100%;
  min-width: 0;
  margin: 0;
  border: none;
  outline: none;
  background: transparent;
  font: inherit;
  color: #111;
  line-height: 1.375;
}

.scene {
  display: block;
  width: 100%;
  height: 100%;
  max-width: none;
  cursor: default;
  touch-action: none;
  user-select: none;
}

.scene.tool-annotate,
.scene.tool-add-section {
  cursor: crosshair;
}

.scene.tool-crop {
  cursor: default;
}

.scene.tool-select {
  cursor: default;
}

.section-rect {
  fill: rgba(0, 122, 255, 0.06);
  stroke: #007aff;
  stroke-width: 1.5;
  stroke-dasharray: 5 3;
}

.section.selected .section-rect {
  fill: rgba(0, 122, 255, 0.1);
  stroke: #007aff;
  stroke-dasharray: none;
}

.handle {
  fill: #fff;
  stroke: #007aff;
  stroke-width: 1.5;
  cursor: nwse-resize;
}

.draft-section {
  fill: rgba(0, 122, 255, 0.12);
  stroke: #007aff;
  stroke-width: 1.75;
  stroke-dasharray: 4 2;
}

.crop-dim {
  fill: rgba(0, 0, 0, 0.55);
}

.crop-outline {
  stroke: #fff;
  stroke-width: 1.5;
  cursor: move;
}

.crop-handle {
  fill: #fff;
  stroke: #007aff;
  stroke-width: 1.5;
}

.leader {
  fill: none;
  pointer-events: none;
}

.leader-halo {
  fill: none;
  pointer-events: none;
}

.anchor-dot,
.anchor-dot-halo,
.anchor-head,
.anchor-leader {
  pointer-events: none;
}

.callout-label {
  cursor: text;
}

.anchor-hit-area {
  cursor: move;
}

.callout-text {
  fill: #111;
  pointer-events: none;
  user-select: none;
}

.canvas-banner {
  position: sticky;
  top: 14px;
  z-index: 2;
  width: fit-content;
  max-width: calc(100% - 32px);
  margin: 14px auto 0;
  padding: 11px 16px;
  border-radius: 980px;
  background: rgba(30, 30, 32, 0.72);
  color: #f5f5f7;
  font-size: 0.84rem;
  font-weight: 590;
  letter-spacing: -0.01em;
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: var(--shadow);
  pointer-events: none;
}

.canvas-banner.detecting {
  background: rgba(0, 122, 255, 0.88);
  border-color: rgba(255, 255, 255, 0.2);
}
</style>
