import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type ComputedRef,
  type Ref,
} from 'vue'
import type { Point } from '../types/annotation'

const MIN_VIEW_ZOOM = 0.25
const MAX_VIEW_ZOOM = 8
const STAGE_INSET = 48

interface PinchSession {
  startDistance: number
  startZoom: number
}

export function useCanvasViewport(options: {
  viewportRef: Ref<HTMLElement | null>
  documentWidth: ComputedRef<number>
  documentHeight: ComputedRef<number>
  resetKey: ComputedRef<string>
  onPinchStart?: () => void
}) {
  const { viewportRef, documentWidth, documentHeight, resetKey } = options

  const viewZoom = ref(1)
  const viewportWidth = ref(0)
  const pinchSession = ref<PinchSession | null>(null)
  let gestureStartZoom = 1
  let resizeObserver: ResizeObserver | null = null

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
    options.onPinchStart?.()
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

  watch(resetKey, () => {
    viewZoom.value = 1
    pinchSession.value = null
    const viewport = viewportRef.value
    if (viewport) {
      viewport.scrollLeft = 0
      viewport.scrollTop = 0
    }
  })

  return {
    stageWidth,
    stageHeight,
    fitScale,
    viewZoom,
  }
}
