<script setup lang="ts">
import { computed } from 'vue'
import type {
  Annotation,
  CalloutSide,
  Point,
} from '../types/annotation'
import { useI18n } from '../i18n'
import {
  ANCHOR_OFFSET_STEP,
  anchorOffsetExtent,
  clampAnchorOffsetAxis,
} from '../utils/markerSize'

const props = withDefaults(
  defineProps<{
    selectedAnnotations?: Annotation[]
    imageWidth?: number
    imageHeight?: number
    documentWidth?: number
    documentHeight?: number
    labelPositions?: Record<string, Point>
  }>(),
  {
    selectedAnnotations: () => [],
    imageWidth: 0,
    imageHeight: 0,
    documentWidth: 0,
    documentHeight: 0,
    labelPositions: () => ({}),
  },
)

const emit = defineEmits<{
  patch: [
    patch: Partial<{
      calloutSide: CalloutSide
      description: string
      anchorOffset: { x: number; y: number }
      anchorOffsetX: number
      anchorOffsetY: number
      calloutPosition: Point | null
      calloutPositionX: number
      calloutPositionY: number
    }>,
  ]
  close: []
}>()

const { t } = useI18n()

const activeAnnotations = computed(() => props.selectedAnnotations)
const selectionCount = computed(() => activeAnnotations.value.length)
const isMultiSelection = computed(() => selectionCount.value > 1)
const primaryAnnotation = computed(() => activeAnnotations.value[0] ?? null)

const sharedCalloutSide = computed<CalloutSide | null>(() => {
  const first = activeAnnotations.value[0]
  if (!first) return null
  return activeAnnotations.value.every((item) => item.calloutSide === first.calloutSide)
    ? first.calloutSide
    : null
})

const calloutSideOptions = computed(() => [
  {
    value: 'top' as const,
    label: t('style.calloutSide.top'),
    title: t('style.calloutSide.top'),
    area: 'top' as const,
  },
  {
    value: 'left' as const,
    label: t('style.calloutSide.left'),
    title: t('style.calloutSide.left'),
    area: 'left' as const,
  },
  {
    value: 'auto' as const,
    label: t('style.calloutSide.auto'),
    title: t('style.calloutSide.autoTitle'),
    area: 'auto' as const,
  },
  {
    value: 'right' as const,
    label: t('style.calloutSide.right'),
    title: t('style.calloutSide.right'),
    area: 'right' as const,
  },
  {
    value: 'bottom' as const,
    label: t('style.calloutSide.bottom'),
    title: t('style.calloutSide.bottom'),
    area: 'bottom' as const,
  },
])

const sharedAnchorOffsetX = computed<number | null>(() => {
  const first = activeAnnotations.value[0]
  if (!first) return null
  return activeAnnotations.value.every(
    (item) => item.anchorOffset.x === first.anchorOffset.x,
  )
    ? first.anchorOffset.x
    : null
})

const sharedAnchorOffsetY = computed<number | null>(() => {
  const first = activeAnnotations.value[0]
  if (!first) return null
  return activeAnnotations.value.every(
    (item) => item.anchorOffset.y === first.anchorOffset.y,
  )
    ? first.anchorOffset.y
    : null
})

function resolvedLabelPosition(annotation: Annotation): Point {
  if (annotation.calloutPosition) return annotation.calloutPosition
  return props.labelPositions[annotation.id] ?? { x: 0, y: 0 }
}

const sharedLabelPositionX = computed<number | null>(() => {
  const first = activeAnnotations.value[0]
  if (!first) return null
  const firstX = resolvedLabelPosition(first).x
  return activeAnnotations.value.every(
    (item) => resolvedLabelPosition(item).x === firstX,
  )
    ? firstX
    : null
})

const sharedLabelPositionY = computed<number | null>(() => {
  const first = activeAnnotations.value[0]
  if (!first) return null
  const firstY = resolvedLabelPosition(first).y
  return activeAnnotations.value.every(
    (item) => resolvedLabelPosition(item).y === firstY,
  )
    ? firstY
    : null
})

const hasManualLabelPosition = computed(() =>
  activeAnnotations.value.some((item) => item.calloutPosition !== null),
)

const selectionTitle = computed(() =>
  isMultiSelection.value
    ? t('style.selectedAnnotationsTitle', { count: selectionCount.value })
    : t('style.selectedAnnotationTitle'),
)

const anchorOffsetXExtent = computed(() => anchorOffsetExtent(props.imageWidth))
const anchorOffsetYExtent = computed(() => anchorOffsetExtent(props.imageHeight))
const labelPositionXMax = computed(() => Math.max(0, props.documentWidth - 8))
const labelPositionYMax = computed(() => Math.max(0, props.documentHeight - 8))

function parseAnchorOffsetPx(axis: 'x' | 'y', raw: string): number | null {
  const trimmed = raw.trim().replace(/px$/i, '')
  if (trimmed === '' || trimmed === '-' || trimmed === '+') return null
  const value = Number(trimmed)
  if (!Number.isFinite(value)) return null
  const imageSize = axis === 'x' ? props.imageWidth : props.imageHeight
  return clampAnchorOffsetAxis(value, imageSize)
}

function emitAnchorOffset(axis: 'x' | 'y', raw: string): void {
  if (selectionCount.value === 0) return
  const parsed = parseAnchorOffsetPx(axis, raw)
  if (parsed === null) return
  if (isMultiSelection.value) {
    emit('patch', axis === 'x' ? { anchorOffsetX: parsed } : { anchorOffsetY: parsed })
    return
  }
  const annotation = primaryAnnotation.value
  if (!annotation) return
  emit('patch', {
    anchorOffset: {
      x: axis === 'x' ? parsed : annotation.anchorOffset.x,
      y: axis === 'y' ? parsed : annotation.anchorOffset.y,
    },
  })
}

function onAnchorOffsetChange(axis: 'x' | 'y', event: Event): void {
  const input = event.target as HTMLInputElement
  const parsed = parseAnchorOffsetPx(axis, input.value)
  if (parsed === null) {
    const shared = axis === 'x' ? sharedAnchorOffsetX.value : sharedAnchorOffsetY.value
    input.value = shared === null ? '' : String(shared)
    return
  }
  input.value = String(parsed)
  emitAnchorOffset(axis, String(parsed))
}

function onAnchorOffsetSlider(axis: 'x' | 'y', event: Event): void {
  emitAnchorOffset(axis, (event.target as HTMLInputElement).value)
}

function displayOffset(axis: 'x' | 'y'): string {
  const shared = axis === 'x' ? sharedAnchorOffsetX.value : sharedAnchorOffsetY.value
  return shared === null ? '' : String(shared)
}

function sliderOffset(axis: 'x' | 'y'): number {
  const shared = axis === 'x' ? sharedAnchorOffsetX.value : sharedAnchorOffsetY.value
  if (shared !== null) return shared
  return primaryAnnotation.value?.anchorOffset[axis] ?? 0
}

function parseLabelPositionPx(raw: string): number | null {
  const trimmed = raw.trim().replace(/px$/i, '')
  if (trimmed === '' || trimmed === '-' || trimmed === '+') return null
  const value = Number(trimmed)
  if (!Number.isFinite(value)) return null
  return value
}

function clampLabelCoord(axis: 'x' | 'y', value: number): number {
  const max = axis === 'x' ? labelPositionXMax.value : labelPositionYMax.value
  return Math.min(max, Math.max(0, Math.round(value)))
}

function emitLabelPosition(axis: 'x' | 'y', raw: string): void {
  if (selectionCount.value === 0) return
  const parsed = parseLabelPositionPx(raw)
  if (parsed === null) return
  const value = clampLabelCoord(axis, parsed)
  if (isMultiSelection.value) {
    emit('patch', axis === 'x' ? { calloutPositionX: value } : { calloutPositionY: value })
    return
  }
  const annotation = primaryAnnotation.value
  if (!annotation) return
  const current = resolvedLabelPosition(annotation)
  emit('patch', {
    calloutPosition: {
      x: axis === 'x' ? value : current.x,
      y: axis === 'y' ? value : current.y,
    },
  })
}

function onLabelPositionChange(axis: 'x' | 'y', event: Event): void {
  const input = event.target as HTMLInputElement
  const parsed = parseLabelPositionPx(input.value)
  if (parsed === null) {
    const shared = axis === 'x' ? sharedLabelPositionX.value : sharedLabelPositionY.value
    input.value = shared === null ? '' : String(Math.round(shared))
    return
  }
  const value = clampLabelCoord(axis, parsed)
  input.value = String(value)
  emitLabelPosition(axis, String(value))
}

function onLabelPositionSlider(axis: 'x' | 'y', event: Event): void {
  emitLabelPosition(axis, (event.target as HTMLInputElement).value)
}

function displayLabelPosition(axis: 'x' | 'y'): string {
  const shared = axis === 'x' ? sharedLabelPositionX.value : sharedLabelPositionY.value
  return shared === null ? '' : String(Math.round(shared))
}

function sliderLabelPosition(axis: 'x' | 'y'): number {
  const shared = axis === 'x' ? sharedLabelPositionX.value : sharedLabelPositionY.value
  if (shared !== null) return shared
  const annotation = primaryAnnotation.value
  return annotation ? resolvedLabelPosition(annotation)[axis] : 0
}

function resetLabelPosition(): void {
  emit('patch', { calloutPosition: null })
}
</script>

<template>
  <div>
    <div
      v-if="selectionCount > 0"
      class="settings-stack settings-stack-annotation"
    >
      <div class="settings-stack-header">
        <h3 class="panel-heading settings-stack-title">
          <svg
            class="panel-heading-icon"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            aria-hidden="true"
          >
            <path
              d="M4 20l4.5-1.2L19 8.3a2.1 2.1 0 0 0 0-3l-.3-.3a2.1 2.1 0 0 0-3 0L5.2 15.5 4 20z"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linejoin="round"
            />
            <path
              d="M14.5 6.5l3 3"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
          {{ selectionTitle }}
        </h3>
        <button
          class="close-editor-btn"
          type="button"
          :title="t('style.closeEditor')"
          :aria-label="t('style.closeEditor')"
          @click="emit('close')"
        >
          ×
        </button>
      </div>
      <p v-if="isMultiSelection" class="hint multi-hint">{{ t('style.multiSelectionHint') }}</p>

      <div v-if="!isMultiSelection && primaryAnnotation" class="settings-group">
        <h4 class="section-title">{{ t('style.section.description') }}</h4>
        <div class="field" style="margin-bottom: 0">
          <textarea
            :value="primaryAnnotation.description"
            :placeholder="t('style.descriptionPlaceholder')"
            :aria-label="t('style.description')"
            @input="emit('patch', { description: ($event.target as HTMLTextAreaElement).value })"
          />
        </div>
      </div>

      <div class="settings-group">
        <h4 class="section-title">{{ t('style.section.placement') }}</h4>
        <div class="field">
          <label>{{ t('style.calloutSide') }}</label>
          <div
            class="callout-side-buttons"
            role="group"
            :aria-label="t('style.calloutSide')"
          >
            <button
              v-for="option in calloutSideOptions"
              :key="option.value"
              class="callout-side-btn"
              type="button"
              :class="[
                `callout-side-${option.area}`,
                { active: sharedCalloutSide === option.value },
              ]"
              :aria-label="option.title"
              :aria-pressed="sharedCalloutSide === option.value"
              :title="option.title"
              @click="emit('patch', { calloutSide: option.value })"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
        <div class="field">
          <label class="slider-label">
            <span>{{ t('style.labelPositionX') }}</span>
            <div class="px-field px-field-compact">
              <input
                type="text"
                inputmode="numeric"
                :value="displayLabelPosition('x')"
                :placeholder="sharedLabelPositionX === null ? t('style.mixed') : undefined"
                @change="onLabelPositionChange('x', $event)"
                @keydown.enter.prevent="onLabelPositionChange('x', $event)"
              />
              <span class="px-unit">px</span>
            </div>
          </label>
          <input
            class="size-slider"
            type="range"
            :min="0"
            :max="labelPositionXMax"
            :step="1"
            :value="sliderLabelPosition('x')"
            @input="onLabelPositionSlider('x', $event)"
          />
        </div>
        <div class="field">
          <label class="slider-label">
            <span>{{ t('style.labelPositionY') }}</span>
            <div class="px-field px-field-compact">
              <input
                type="text"
                inputmode="numeric"
                :value="displayLabelPosition('y')"
                :placeholder="sharedLabelPositionY === null ? t('style.mixed') : undefined"
                @change="onLabelPositionChange('y', $event)"
                @keydown.enter.prevent="onLabelPositionChange('y', $event)"
              />
              <span class="px-unit">px</span>
            </div>
          </label>
          <input
            class="size-slider"
            type="range"
            :min="0"
            :max="labelPositionYMax"
            :step="1"
            :value="sliderLabelPosition('y')"
            @input="onLabelPositionSlider('y', $event)"
          />
        </div>
        <div class="field" style="margin-bottom: 0">
          <button
            class="btn btn-ghost reset-label-btn"
            type="button"
            :disabled="!hasManualLabelPosition"
            @click="resetLabelPosition"
          >
            {{ t('style.labelPositionReset') }}
          </button>
          <p class="field-hint">{{ t('style.labelPositionHint') }}</p>
        </div>
      </div>

      <div class="settings-group">
        <h4 class="section-title">{{ t('style.section.anchor') }}</h4>
        <div class="field">
          <label class="slider-label">
            <span>{{ t('style.axis.x') }}</span>
            <div class="px-field px-field-compact">
              <input
                type="text"
                inputmode="numeric"
                :value="displayOffset('x')"
                :placeholder="sharedAnchorOffsetX === null ? t('style.mixed') : undefined"
                @change="onAnchorOffsetChange('x', $event)"
                @keydown.enter.prevent="onAnchorOffsetChange('x', $event)"
              />
              <span class="px-unit">px</span>
            </div>
          </label>
          <input
            class="size-slider"
            type="range"
            :min="-anchorOffsetXExtent"
            :max="anchorOffsetXExtent"
            :step="ANCHOR_OFFSET_STEP"
            :value="sliderOffset('x')"
            @input="onAnchorOffsetSlider('x', $event)"
          />
        </div>
        <div class="field" style="margin-bottom: 0">
          <label class="slider-label">
            <span>{{ t('style.axis.y') }}</span>
            <div class="px-field px-field-compact">
              <input
                type="text"
                inputmode="numeric"
                :value="displayOffset('y')"
                :placeholder="sharedAnchorOffsetY === null ? t('style.mixed') : undefined"
                @change="onAnchorOffsetChange('y', $event)"
                @keydown.enter.prevent="onAnchorOffsetChange('y', $event)"
              />
              <span class="px-unit">px</span>
            </div>
          </label>
          <input
            class="size-slider"
            type="range"
            :min="-anchorOffsetYExtent"
            :max="anchorOffsetYExtent"
            :step="ANCHOR_OFFSET_STEP"
            :value="sliderOffset('y')"
            @input="onAnchorOffsetSlider('y', $event)"
          />
        </div>
      </div>
    </div>
    <div v-else class="settings-stack-header settings-stack-header-idle">
      <h3 class="panel-heading settings-stack-title">
        <svg
          class="panel-heading-icon"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          aria-hidden="true"
        >
          <path
            d="M4 20l4.5-1.2L19 8.3a2.1 2.1 0 0 0 0-3l-.3-.3a2.1 2.1 0 0 0-3 0L5.2 15.5 4 20z"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linejoin="round"
          />
          <path
            d="M14.5 6.5l3 3"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
        {{ t('style.selectedAnnotationTitle') }}
      </h3>
    </div>
    <p v-if="selectionCount === 0" class="hint">{{ t('style.noSelectionHint') }}</p>
  </div>
</template>

<style scoped>
.settings-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.multi-hint {
  margin: -4px 2px 0;
}

.reset-label-btn {
  width: 100%;
  justify-content: center;
}

.settings-stack-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0 2px 10px;
}

.settings-stack-header-idle {
  margin-bottom: 8px;
}

.settings-stack-title {
  margin: 0;
  min-width: 0;
}

.close-editor-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin: 0;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--ink-muted);
  font-size: 1.15rem;
  line-height: 1;
  cursor: pointer;
}

.close-editor-btn:hover {
  border-color: var(--line-strong);
  background: rgba(255, 255, 255, 0.72);
  color: var(--ink);
}

.settings-group {
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 14px;
  background: rgba(120, 120, 128, 0.05);
}

.settings-group + .settings-group,
.settings-group + p.hint,
.settings-stack + .settings-group,
.settings-stack + p.hint {
  margin-top: 0;
}

.settings-stack + .settings-stack,
.settings-stack + p.hint {
  margin-top: 14px;
}

.settings-stack-annotation .settings-group {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.settings-group .panel-title {
  display: flex;
  align-items: center;
  gap: 6px;
}

.section-title {
  margin: 0 0 12px;
  color: var(--ink-muted);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: none;
}

.px-field {
  display: flex;
  align-items: center;
  gap: 6px;
}

.px-field-compact {
  width: 5.5rem;
}

.px-field-compact input {
  padding: 5px 8px;
  text-align: right;
}

.px-field input {
  flex: 1;
  min-width: 0;
  font-variant-numeric: tabular-nums;
}

.px-unit {
  flex: 0 0 auto;
  color: var(--ink-muted);
  font-size: 0.78rem;
  font-weight: 650;
}

.field-hint {
  margin: 4px 0 0;
  color: var(--ink-muted);
  font-size: 0.72rem;
  line-height: 1.35;
  opacity: 0.85;
}

.slider-label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.size-slider {
  width: 100%;
  margin: 2px 0 0;
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  accent-color: var(--accent);
  cursor: pointer;
}

.size-slider:focus {
  outline: none;
  box-shadow: none;
}

.callout-side-buttons {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-template-areas:
    '. top .'
    'left auto right'
    '. bottom .';
  gap: 6px;
}

.callout-side-top {
  grid-area: top;
}

.callout-side-left {
  grid-area: left;
}

.callout-side-auto {
  grid-area: auto;
}

.callout-side-right {
  grid-area: right;
}

.callout-side-bottom {
  grid-area: bottom;
}

.callout-side-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 8px 6px;
  border: 1px solid var(--line-strong);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.88);
  color: var(--ink-muted);
  font-size: 0.72rem;
  font-weight: 650;
  line-height: 1.2;
  cursor: pointer;
}

.callout-side-btn:hover {
  border-color: var(--accent);
  color: var(--ink);
}

.callout-side-btn.active {
  border-color: rgba(0, 122, 255, 0.45);
  background: var(--accent-soft);
  color: var(--accent-strong);
  box-shadow: inset 0 0 0 1px rgba(0, 122, 255, 0.12);
}
</style>
