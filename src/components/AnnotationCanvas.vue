<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type {
  Annotation,
  AnnotationMode,
  CalloutLayoutItem,
  DocumentLayout,
  LineStyleId,
  NumberStyleId,
  Point,
  Rect,
  Section,
  ToolMode,
} from '../types/annotation'
import { formatStepNumber } from '../utils/circledNumbers'
import { getMarkerVisualStyle } from '../utils/textVisibility'
import { pointInRect } from '../utils/geometry'
import {
  MARKER_FONT_SIZE,
  MARKER_HIT_RADIUS,
  MARKER_RADIUS,
} from '../utils/markerSize'
import { fontFamilyCss } from '../utils/googleFonts'
import { getLineStyleSpec } from '../utils/lineStyle'
import { buildLeaderPath } from '../utils/calloutLayout'
import { useI18n } from '../i18n'

const MIN_VIEW_ZOOM = 0.25
const MAX_VIEW_ZOOM = 8
const STAGE_INSET = 48

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
  annotationMode: AnnotationMode
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
  labelColor: string
  fontFamily: string
  isDetecting?: boolean
  emptyHint?: boolean
}>()

const emit = defineEmits<{
  clearSelection: []
  selectSection: [id: string, additive: boolean]
  selectAnnotation: [id: string, additive: boolean]
  annotateSection: [sectionId: string]
  addAnnotationAt: [point: Point]
  updateSectionRect: [sectionId: string, rect: Rect]
  updateMarker: [annotationId: string, point: Point]
  updateCalloutPosition: [annotationId: string, point: Point]
  addSection: [rect: Rect]
  commitDescription: [annotationId: string, description: string]
  cropImage: [rect: Rect]
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
      kind: 'marker'
      annotationId: string
      offset: Point
    }
  | {
      kind: 'callout'
      annotationId: string
      offset: Point
    }
  | {
      kind: 'create-section'
      origin: Point
      current: Point
    }

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se'

const viewportRef = ref<HTMLElement | null>(null)
const svgRef = ref<SVGSVGElement | null>(null)
const drag = ref<DragState | null>(null)
const editingId = ref<string | null>(null)
const editDraft = ref('')
const editInputRef = ref<HTMLInputElement | null>(null)
const pointerMoved = ref(false)
/** Ignore blur-to-commit while the editor is still mounting / focusing. */
let suppressEditBlurUntil = 0

/** User zoom relative to fit-to-width (1 = fit canvas area). */
const viewZoom = ref(1)
const viewportWidth = ref(0)

interface PinchSession {
  startDistance: number
  startZoom: number
}

const pinchSession = ref<PinchSession | null>(null)
let gestureStartZoom = 1

const documentWidth = computed(
  () => props.document.marginLeft + props.document.imageWidth + props.document.marginRight,
)
const documentHeight = computed(
  () => props.document.marginTop + props.document.imageHeight + props.document.marginBottom,
)

const fitScale = computed(() => {
  if (viewportWidth.value <= 0 || documentWidth.value <= 0) return 1
  const available = Math.max(120, viewportWidth.value - STAGE_INSET)
  return available / documentWidth.value
})

const stageWidth = computed(
  () => documentWidth.value * fitScale.value * viewZoom.value,
)
const stageHeight = computed(
  () => documentHeight.value * fitScale.value * viewZoom.value,
)

function clampViewZoom(value: number): number {
  return Math.min(MAX_VIEW_ZOOM, Math.max(MIN_VIEW_ZOOM, value))
}

function applyViewZoom(nextRaw: number, clientX: number, clientY: number): void {
  const viewport = viewportRef.value
  const next = clampViewZoom(nextRaw)
  const previous = viewZoom.value
  if (Math.abs(next - previous) < 1e-4) return

  if (!viewport) {
    viewZoom.value = next
    return
  }

  const bounds = viewport.getBoundingClientRect()
  const contentX = viewport.scrollLeft + (clientX - bounds.left)
  const contentY = viewport.scrollTop + (clientY - bounds.top)
  const ratio = next / previous
  viewZoom.value = next

  void nextTick(() => {
    viewport.scrollLeft = contentX * ratio - (clientX - bounds.left)
    viewport.scrollTop = contentY * ratio - (clientY - bounds.top)
  })
}

function touchDistance(touches: TouchList): number {
  const first = touches.item(0)
  const second = touches.item(1)
  if (!first || !second) return 0
  return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY)
}

function touchCenter(touches: TouchList): Point {
  const first = touches.item(0)
  const second = touches.item(1)
  if (!first || !second) return { x: 0, y: 0 }
  return {
    x: (first.clientX + second.clientX) / 2,
    y: (first.clientY + second.clientY) / 2,
  }
}

function onViewportWheel(event: WheelEvent): void {
  // Trackpad pinch arrives as ctrl+wheel; keep normal scroll otherwise.
  if (!event.ctrlKey && !event.metaKey) return
  event.preventDefault()
  const zoomFactor = Math.exp(-event.deltaY * 0.01)
  applyViewZoom(viewZoom.value * zoomFactor, event.clientX, event.clientY)
}

function onViewportTouchStart(event: TouchEvent): void {
  if (event.touches.length < 2) return
  event.preventDefault()
  drag.value = null
  pinchSession.value = {
    startDistance: Math.max(1, touchDistance(event.touches)),
    startZoom: viewZoom.value,
  }
}

function onViewportTouchMove(event: TouchEvent): void {
  if (!pinchSession.value || event.touches.length < 2) return
  event.preventDefault()
  const distance = Math.max(1, touchDistance(event.touches))
  const center = touchCenter(event.touches)
  const ratio = distance / pinchSession.value.startDistance
  applyViewZoom(pinchSession.value.startZoom * ratio, center.x, center.y)
}

function onViewportTouchEnd(event: TouchEvent): void {
  if (event.touches.length < 2) {
    pinchSession.value = null
  }
}

function onGestureStart(event: Event): void {
  event.preventDefault()
  gestureStartZoom = viewZoom.value
}

function onGestureChange(event: Event): void {
  event.preventDefault()
  const gesture = event as Event & { scale?: number; clientX?: number; clientY?: number }
  const scale = typeof gesture.scale === 'number' ? gesture.scale : 1
  const viewport = viewportRef.value
  const bounds = viewport?.getBoundingClientRect()
  const clientX = gesture.clientX ?? (bounds ? bounds.left + bounds.width / 2 : 0)
  const clientY = gesture.clientY ?? (bounds ? bounds.top + bounds.height / 2 : 0)
  applyViewZoom(gestureStartZoom * scale, clientX, clientY)
}

function onGestureEnd(event: Event): void {
  event.preventDefault()
}

function syncViewportWidth(): void {
  const viewport = viewportRef.value
  if (!viewport) return
  viewportWidth.value = viewport.clientWidth
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  const viewport = viewportRef.value
  if (!viewport) return

  syncViewportWidth()
  resizeObserver = new ResizeObserver(() => syncViewportWidth())
  resizeObserver.observe(viewport)

  viewport.addEventListener('wheel', onViewportWheel, { passive: false })
  viewport.addEventListener('touchstart', onViewportTouchStart, { passive: false })
  viewport.addEventListener('touchmove', onViewportTouchMove, { passive: false })
  viewport.addEventListener('touchend', onViewportTouchEnd)
  viewport.addEventListener('touchcancel', onViewportTouchEnd)
  // Safari trackpad / touch pinch
  viewport.addEventListener('gesturestart', onGestureStart as EventListener)
  viewport.addEventListener('gesturechange', onGestureChange as EventListener)
  viewport.addEventListener('gestureend', onGestureEnd as EventListener)
})

onBeforeUnmount(() => {
  const viewport = viewportRef.value
  resizeObserver?.disconnect()
  resizeObserver = null
  if (!viewport) return
  viewport.removeEventListener('wheel', onViewportWheel)
  viewport.removeEventListener('touchstart', onViewportTouchStart)
  viewport.removeEventListener('touchmove', onViewportTouchMove)
  viewport.removeEventListener('touchend', onViewportTouchEnd)
  viewport.removeEventListener('touchcancel', onViewportTouchEnd)
  viewport.removeEventListener('gesturestart', onGestureStart as EventListener)
  viewport.removeEventListener('gesturechange', onGestureChange as EventListener)
  viewport.removeEventListener('gestureend', onGestureEnd as EventListener)
})

watch(
  () => props.imageUrl,
  () => {
    viewZoom.value = 1
    pinchSession.value = null
    const viewport = viewportRef.value
    if (viewport) {
      viewport.scrollLeft = 0
      viewport.scrollTop = 0
    }
  },
)

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
  // Prefer smallest containing section
  const hits = props.sections.filter((section) => pointInRect(imagePoint, section.rect))
  return hits.sort(
    (left, right) => left.rect.width * left.rect.height - right.rect.width * right.rect.height,
  )[0]
}

function onPointerDown(event: PointerEvent): void {
  if (event.button !== 0) return
  const target = event.target as Element
  const docPoint = clientToDocument(event)
  const imagePoint = clampToImage(toImagePoint(docPoint))

  const handle = (target.closest('[data-handle]')?.getAttribute('data-handle') ??
    null) as ResizeHandle | null
  const sectionId = target.closest('[data-section]')?.getAttribute('data-section')
  const markerId = target.closest('[data-marker]')?.getAttribute('data-marker')
  const calloutId = target.closest('[data-callout-label]')?.getAttribute('data-callout-label')

  // Second click of a double-click: edit instead of starting a drag.
  if (event.detail >= 2 && (calloutId || markerId)) {
    event.preventDefault()
    void beginEdit((calloutId || markerId)!)
    return
  }

  if (editingId.value && !target.closest('.callout-inplace-edit') && !target.closest('.inline-edit')) {
    commitEdit()
  }

  pointerMoved.value = false
  ;(event.currentTarget as Element).setPointerCapture?.(event.pointerId)

  if (markerId) {
    const annotation = props.annotations.find((item) => item.id === markerId)
    if (!annotation) return
    emit('selectAnnotation', markerId, event.shiftKey)
    drag.value = {
      kind: 'marker',
      annotationId: markerId,
      offset: {
        x: annotation.markerPosition.x - imagePoint.x,
        y: annotation.markerPosition.y - imagePoint.y,
      },
    }
    return
  }

  if (calloutId) {
    const layout = props.calloutLayouts.find((item) => item.annotationId === calloutId)
    if (!layout) return
    emit('selectAnnotation', calloutId, event.shiftKey)
    drag.value = {
      kind: 'callout',
      annotationId: calloutId,
      offset: {
        x: layout.labelPosition.x - docPoint.x,
        y: layout.labelPosition.y - docPoint.y,
      },
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

  if (props.toolMode === 'add-section' || props.toolMode === 'crop') {
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

  // Select mode empty click
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

  if (drag.value.kind === 'marker') {
    emit('updateMarker', drag.value.annotationId, {
      x: imagePoint.x + drag.value.offset.x,
      y: imagePoint.y + drag.value.offset.y,
    })
    return
  }

  if (drag.value.kind === 'callout') {
    emit('updateCalloutPosition', drag.value.annotationId, {
      x: docPoint.x + drag.value.offset.x,
      y: docPoint.y + drag.value.offset.y,
    })
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
  }
}

function onPointerUp(): void {
  if (drag.value?.kind === 'create-section') {
    const x = Math.min(drag.value.origin.x, drag.value.current.x)
    const y = Math.min(drag.value.origin.y, drag.value.current.y)
    const width = Math.abs(drag.value.current.x - drag.value.origin.x)
    const height = Math.abs(drag.value.current.y - drag.value.origin.y)
    if (width >= 8 && height >= 8) {
      if (props.toolMode === 'crop') {
        emit('cropImage', { x, y, width, height })
      } else {
        emit('addSection', { x, y, width, height })
      }
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
  // Backup path; primary edit trigger is pointerdown with detail >= 2.
  event.preventDefault()
  const target = event.target as Element
  const annotationId =
    target.closest('[data-callout-label]')?.getAttribute('data-callout-label') ??
    target.closest('[data-marker]')?.getAttribute('data-marker')
  if (!annotationId || editingId.value === annotationId) return
  void beginEdit(annotationId)
}

function commitEdit(): void {
  if (!editingId.value) return
  emit('commitDescription', editingId.value, editDraft.value)
  editingId.value = null
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
  if (!editingId.value || props.annotationMode !== 'callout') return null
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

function calloutLineY(layout: CalloutLayoutItem, lineIndex: number): number {
  const lineHeight = Math.round(props.calloutFontSize * 1.375)
  const blockHeight = layout.lines.length * lineHeight
  const blockTop = layout.labelPosition.y + (layout.labelHeight - blockHeight) / 2
  return blockTop + lineHeight * lineIndex + lineHeight / 2
}

const activeLineStyle = computed(() => getLineStyleSpec(props.lineStyle, props.lineWidth))
const effectiveLineColor = computed(() => (props.lineStyle === 'invert' ? '#ffffff' : props.lineColor))
const effectiveDotColor = computed(() => (props.lineStyle === 'invert' ? '#ffffff' : props.dotColor))

function leaderEndX(layout: CalloutLayoutItem): number {
  return layout.side === 'left' ? layout.labelPosition.x + layout.labelWidth : layout.labelPosition.x
}

function leaderPathFor(layout: CalloutLayoutItem): string {
  return buildLeaderPath(layout.anchorPoint, leaderEndX(layout), layout.elbowPoint.y)
}

function markerStyle(annotation: Annotation) {
  return getMarkerVisualStyle(annotation.resolvedStyle, props.labelColor)
}

const activeFontFamily = computed(() => fontFamilyCss(props.fontFamily))
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
        fill="#f4f6f8"
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

      <!-- Callouts -->
      <template v-if="annotationMode === 'callout'">
      <g v-for="annotation in annotations" :key="annotation.id">
        <template v-if="layoutFor(annotation.id)">
          <path
            v-if="lineHaloWidth > 0 && lineStyle !== 'invert'"
            class="leader-halo"
            :d="leaderPathFor(layoutFor(annotation.id)!)"
            :style="{
              stroke: lineHaloColor,
              strokeWidth: activeLineStyle.strokeWidth + lineHaloWidth,
              strokeOpacity: lineOpacity,
            }"
          />
          <g :style="activeLineStyle.blendMode ? { mixBlendMode: activeLineStyle.blendMode } : undefined">
            <path
              class="leader"
              :d="leaderPathFor(layoutFor(annotation.id)!)"
              :style="{
                stroke: effectiveLineColor,
                strokeWidth: activeLineStyle.strokeWidth,
                strokeDasharray: activeLineStyle.dasharray ?? 'none',
                strokeOpacity: lineOpacity,
              }"
            />
            <circle
              v-if="lineHaloWidth > 0 && lineStyle !== 'invert'"
              class="anchor-dot-halo"
              :cx="layoutFor(annotation.id)!.anchorPoint.x"
              :cy="layoutFor(annotation.id)!.anchorPoint.y"
              :r="dotRadius + lineHaloWidth / 2"
              :style="{ fill: lineHaloColor, fillOpacity: lineOpacity }"
            />
            <circle
              class="anchor-dot"
              :cx="layoutFor(annotation.id)!.anchorPoint.x"
              :cy="layoutFor(annotation.id)!.anchorPoint.y"
              :r="dotRadius"
              :style="{ fill: effectiveDotColor }"
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
                strokeWidth: selectedAnnotationIds.includes(annotation.id)
                  ? calloutBorderWidth + 0.75
                  : calloutBorderWidth,
              }"
            />
            <text
              v-show="editingId !== annotation.id"
              :data-callout-label="annotation.id"
              class="callout-text"
              :x="layoutFor(annotation.id)!.labelPosition.x + 10"
              :style="{ fontFamily: activeFontFamily, fontSize: `${calloutFontSize}px` }"
            >
              <tspan
                v-for="(line, lineIndex) in layoutFor(annotation.id)!.lines"
                :key="lineIndex"
                :data-callout-label="annotation.id"
                :x="layoutFor(annotation.id)!.labelPosition.x + 10"
                :y="calloutLineY(layoutFor(annotation.id)!, lineIndex)"
              >{{ line }}</tspan>
            </text>
          </g>
        </template>
      </g>
      </template>

      <!-- Inline markers -->
      <template v-if="annotationMode === 'inline'">
      <g
        v-for="annotation in annotations"
        :key="annotation.id"
        class="marker"
        :class="{ selected: selectedAnnotationIds.includes(annotation.id) }"
      >
        <circle
          :data-marker="annotation.id"
          class="marker-hit"
          :cx="document.marginLeft + annotation.markerPosition.x"
          :cy="document.marginTop + annotation.markerPosition.y"
          :r="MARKER_HIT_RADIUS"
        />
        <circle
          v-if="markerStyle(annotation).background || markerStyle(annotation).useInvert"
          :data-marker="annotation.id"
          :cx="document.marginLeft + annotation.markerPosition.x"
          :cy="document.marginTop + annotation.markerPosition.y"
          :r="MARKER_RADIUS"
          :fill="markerStyle(annotation).background || '#000'"
          :fill-opacity="
            markerStyle(annotation).useInvert
              ? 0.45
              : markerStyle(annotation).backgroundOpacity
          "
        />
        <rect
          v-if="markerStyle(annotation).shape === 'label'"
          :data-marker="annotation.id"
          :x="document.marginLeft + annotation.markerPosition.x - MARKER_RADIUS"
          :y="document.marginTop + annotation.markerPosition.y - MARKER_RADIUS + 2"
          :width="MARKER_RADIUS * 2"
          :height="MARKER_RADIUS * 2 - 4"
          rx="6"
          :fill="markerStyle(annotation).background || '#0b6e4f'"
        />
        <text
          v-if="formatStepNumber(annotation.order, numberStyle)"
          :data-marker="annotation.id"
          class="marker-text"
          :x="document.marginLeft + annotation.markerPosition.x"
          :y="document.marginTop + annotation.markerPosition.y + 2"
          :font-size="MARKER_FONT_SIZE"
          :fill="markerStyle(annotation).fill"
          :stroke="markerStyle(annotation).stroke === 'none' ? 'none' : markerStyle(annotation).stroke"
          :stroke-width="markerStyle(annotation).strokeWidth"
          :style="{ fontFamily: activeFontFamily }"
        >
          {{ formatStepNumber(annotation.order, numberStyle) }}
        </text>
      </g>
      </template>
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
        }"
        @pointerdown.stop
      >
        <input
          ref="editInputRef"
          v-model="editDraft"
          type="text"
          :placeholder="t('canvas.descriptionPlaceholder')"
          @keydown.enter.prevent="commitEdit"
          @keydown.escape.prevent="cancelEdit"
          @blur="onEditBlur"
        />
      </div>
    </div>

    <div
      v-if="editingId && !editingCalloutLayout"
      class="inline-edit"
      @pointerdown.stop
    >
      <input
        ref="editInputRef"
        v-model="editDraft"
        type="text"
        :placeholder="t('canvas.descriptionPlaceholder')"
        @keydown.enter.prevent="commitEdit"
        @keydown.escape.prevent="cancelEdit"
        @blur="onEditBlur"
      />
      <button class="btn btn-primary" type="button" @click="commitEdit">{{ t('canvas.commit') }}</button>
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
  padding: 0 10px;
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
  font-weight: 700;
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
.scene.tool-add-section,
.scene.tool-crop {
  cursor: crosshair;
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

.leader {
  fill: none;
  pointer-events: none;
}

.leader-halo {
  fill: none;
  pointer-events: none;
}

.anchor-dot,
.anchor-dot-halo {
  pointer-events: none;
}

.callout-label {
  fill: #fff;
  stroke: #1f2933;
  cursor: text;
}

.selected .callout-label {
  stroke: #2563eb;
}

.callout-text {
  font-size: 16px;
  font-weight: 700;
  fill: #111;
  dominant-baseline: middle;
  pointer-events: none;
  user-select: none;
}

.marker {
  cursor: grab;
}

.marker-hit {
  fill: transparent;
}

.marker.selected .marker-hit {
  stroke: #2563eb;
  stroke-width: 2;
  stroke-dasharray: 4 3;
}

.marker-text {
  font-weight: 800;
  text-anchor: middle;
  dominant-baseline: middle;
  paint-order: stroke;
  stroke-linejoin: round;
  pointer-events: none;
}

.inline-edit {
  position: sticky;
  bottom: 16px;
  left: 50%;
  display: flex;
  gap: 8px;
  width: min(420px, calc(100% - 32px));
  margin: 0 auto 16px;
  padding: 10px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 10px;
  box-shadow: var(--shadow);
}

.inline-edit input {
  flex: 1;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 8px 10px;
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
