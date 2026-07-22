<script setup lang="ts">
import { computed, watch } from 'vue'
import type {
  Annotation,
  AnchorStyleId,
  CalloutSide,
  LineStyleId,
  NumberStyleId,
  Point,
} from '../types/annotation'
import { useI18n, type MessageKey } from '../i18n'
import FontFamilyPicker from './FontFamilyPicker.vue'
import { loadGoogleFont } from '../utils/googleFonts'
import { getAnchorStyleOptions } from '../utils/anchorStyle'
import {
  getLineStyleOptions,
  LINE_HALO_WIDTH_MAX,
  LINE_HALO_WIDTH_MIN,
  LINE_WIDTH_MAX,
  LINE_WIDTH_MIN,
} from '../utils/lineStyle'
import {
  CALLOUT_FONT_SIZE_MAX,
  CALLOUT_FONT_SIZE_MIN,
  ANCHOR_OFFSET_STEP,
  DOT_RADIUS_MAX,
  DOT_RADIUS_MIN,
  DOT_RADIUS_STEP,
  anchorOffsetExtent,
  clampAnchorOffsetAxis,
} from '../utils/markerSize'
import {
  CALLOUT_FILL_OPACITY_MAX,
  CALLOUT_FILL_OPACITY_MIN,
} from '../utils/commonSettings'
import { numberStyleIds } from '../utils/circledNumbers'

const props = withDefaults(
  defineProps<{
    /** @deprecated Prefer `selectedAnnotations`. */
    annotation?: Annotation | null
    selectedAnnotations?: Annotation[]
    defaultFontFamily: string
    lineStyle: LineStyleId
    lineWidth: number
    lineColor: string
    dotRadius: number
    anchorStyle: AnchorStyleId
    lineHaloWidth: number
    lineHaloColor: string
    calloutFontSize: number
    calloutBorderEnabled: boolean
    calloutFillEnabled: boolean
    calloutFillColor: string
    calloutFillOpacity: number
    pageBackgroundColor: string
    numberStyle: NumberStyleId
    imageWidth?: number
    imageHeight?: number
    /** Document size for label coordinate editors (includes margins). */
    documentWidth?: number
    documentHeight?: number
    /** Laid-out label top-left by annotation id (document coords). */
    labelPositions?: Record<string, Point>
    showProject?: boolean
    showAnnotation?: boolean
  }>(),
  {
    annotation: null,
    selectedAnnotations: () => [],
    imageWidth: 0,
    imageHeight: 0,
    documentWidth: 0,
    documentHeight: 0,
    labelPositions: () => ({}),
    showProject: true,
    showAnnotation: true,
  },
)

const emit = defineEmits<{
  'update:defaultFontFamily': [fontFamily: string]
  'update:lineStyle': [style: LineStyleId]
  'update:lineWidth': [width: number]
  'update:lineColor': [color: string]
  'update:dotRadius': [radius: number]
  'update:anchorStyle': [style: AnchorStyleId]
  'update:lineHaloWidth': [width: number]
  'update:lineHaloColor': [color: string]
  'update:calloutFontSize': [size: number]
  'update:calloutBorderEnabled': [enabled: boolean]
  'update:calloutFillEnabled': [enabled: boolean]
  'update:calloutFillColor': [color: string]
  'update:calloutFillOpacity': [opacity: number]
  'update:pageBackgroundColor': [color: string]
  'update:numberStyle': [style: NumberStyleId]
  openPresets: []
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
}>()

const { t } = useI18n()

const lineStyleOptions = computed(() => getLineStyleOptions())
const anchorStyleOptions = computed(() => getAnchorStyleOptions())
const NUMBER_STYLE_LABEL_KEYS: Record<NumberStyleId, MessageKey> = {
  circled: 'style.numberStyle.circled',
  paren: 'style.numberStyle.paren',
  dotted: 'style.numberStyle.dotted',
  'paren-suffix': 'style.numberStyle.parenSuffix',
  plain: 'style.numberStyle.plain',
  none: 'style.numberStyle.none',
}
const numberStyleOptions = computed(() =>
  numberStyleIds().map((value) => ({ value, label: t(NUMBER_STYLE_LABEL_KEYS[value]) })),
)

const activeAnnotations = computed(() => {
  if (props.selectedAnnotations.length > 0) return props.selectedAnnotations
  return props.annotation ? [props.annotation] : []
})
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

watch(
  () => props.defaultFontFamily,
  (family) => {
    loadGoogleFont(family)
  },
  { immediate: true },
)
</script>

<template>
  <div>
    <div v-if="showProject" class="settings-stack">
      <div class="settings-stack-header">
        <h3 class="panel-title settings-stack-title">
          <span class="title-icon" aria-hidden="true">⚙</span>
          {{ t('style.projectSettingsTitle') }}
        </h3>
        <button class="presets-btn" type="button" @click="emit('openPresets')">
          {{ t('style.presetsManage') }}
        </button>
      </div>

      <div class="settings-group">
        <div class="field" style="margin-bottom: 0">
          <label class="color-swatch color-swatch-inline">
            {{ t('style.pageBackground') }}
            <input
              type="color"
              :value="pageBackgroundColor"
              @input="emit('update:pageBackgroundColor', ($event.target as HTMLInputElement).value)"
            />
          </label>
        </div>
      </div>

      <div class="settings-group">
        <div class="field" style="margin-bottom: 0">
          <label>{{ t('style.numberStyle') }}</label>
          <select
            :value="numberStyle"
            @change="emit('update:numberStyle', ($event.target as HTMLSelectElement).value as NumberStyleId)"
          >
            <option v-for="option in numberStyleOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>
      </div>

      <div class="settings-group">
        <div class="field">
          <label>{{ t('style.lineStyle') }}</label>
          <div class="line-style-buttons" role="group" :aria-label="t('style.lineStyle')">
            <button
              v-for="option in lineStyleOptions"
              :key="option.value"
              class="line-style-btn"
              type="button"
              :class="{ active: lineStyle === option.value }"
              :title="option.value === 'invert' ? t('lineStyle.invertHint') : undefined"
              :aria-pressed="lineStyle === option.value"
              @click="emit('update:lineStyle', option.value)"
            >
              <svg
                class="line-style-icon"
                viewBox="0 0 40 12"
                width="40"
                height="12"
                aria-hidden="true"
              >
                <line
                  v-if="option.value === 'solid'"
                  x1="2"
                  y1="6"
                  x2="38"
                  y2="6"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                />
                <line
                  v-else-if="option.value === 'dashed'"
                  x1="2"
                  y1="6"
                  x2="38"
                  y2="6"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-dasharray="5 4"
                />
                <g v-else>
                  <rect x="1" y="1" width="38" height="10" rx="2" fill="currentColor" opacity="0.18" />
                  <line
                    x1="2"
                    y1="6"
                    x2="38"
                    y2="6"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                  />
                </g>
              </svg>
              <span>{{ option.label }}</span>
            </button>
          </div>
        </div>
        <div class="field">
          <label class="slider-label">
            <span>{{ t('style.lineWidth') }}</span>
            <span class="slider-value">{{ lineWidth }}px</span>
          </label>
          <input
            class="size-slider"
            type="range"
            :min="LINE_WIDTH_MIN"
            :max="LINE_WIDTH_MAX"
            :step="0.5"
            :value="lineWidth"
            @input="emit('update:lineWidth', Number(($event.target as HTMLInputElement).value))"
          />
        </div>
        <div v-if="lineStyle !== 'invert'" class="field">
          <label class="color-swatch color-swatch-inline">
            {{ t('style.lineAndDotColor') }}
            <input
              type="color"
              :value="lineColor"
              @input="emit('update:lineColor', ($event.target as HTMLInputElement).value)"
            />
          </label>
        </div>
        <div v-if="lineStyle !== 'invert'" class="field">
          <label class="slider-label">
            <span>{{ t('style.lineHalo') }}</span>
            <span class="slider-value">
              {{ lineHaloWidth === 0 ? t('style.lineHalo.off') : `${lineHaloWidth}px` }}
            </span>
          </label>
          <input
            class="size-slider"
            type="range"
            :min="LINE_HALO_WIDTH_MIN"
            :max="LINE_HALO_WIDTH_MAX"
            :step="0.5"
            :value="lineHaloWidth"
            @input="emit('update:lineHaloWidth', Number(($event.target as HTMLInputElement).value))"
          />
        </div>
        <div v-if="lineStyle !== 'invert'" class="field" style="margin-bottom: 0">
          <label class="color-swatch color-swatch-inline">
            {{ t('style.lineHaloColor') }}
            <input
              type="color"
              :value="lineHaloColor"
              @input="emit('update:lineHaloColor', ($event.target as HTMLInputElement).value)"
            />
          </label>
        </div>
      </div>

      <div class="settings-group">
        <div class="field">
          <label>{{ t('style.anchorStyle') }}</label>
          <div class="anchor-style-buttons" role="group" :aria-label="t('style.anchorStyle')">
            <button
              v-for="option in anchorStyleOptions"
              :key="option.value"
              class="anchor-style-btn"
              type="button"
              :class="{ active: anchorStyle === option.value }"
              :aria-label="option.label"
              :aria-pressed="anchorStyle === option.value"
              :title="option.label"
              @click="emit('update:anchorStyle', option.value)"
            >
              <svg
                v-if="option.value === 'dot'"
                class="anchor-style-icon"
                viewBox="0 0 24 24"
                width="22"
                height="22"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="5" fill="currentColor" />
              </svg>
              <svg
                v-else-if="option.value === 'arrow'"
                class="anchor-style-icon"
                viewBox="0 0 24 24"
                width="22"
                height="22"
                aria-hidden="true"
              >
                <path d="M5 12 L19 5 L15 12 L19 19 Z" fill="currentColor" />
              </svg>
              <svg
                v-else
                class="anchor-style-icon"
                viewBox="0 0 24 24"
                width="22"
                height="22"
                aria-hidden="true"
              >
                <path
                  d="M16 5 L8 12 L16 19"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
        <div class="field" style="margin-bottom: 0">
          <label class="slider-label">
            <span>{{ t('style.dotRadius') }}</span>
            <span class="slider-value">{{ dotRadius }}px</span>
          </label>
          <input
            class="size-slider"
            type="range"
            :min="DOT_RADIUS_MIN"
            :max="DOT_RADIUS_MAX"
            :step="DOT_RADIUS_STEP"
            :value="dotRadius"
            @input="emit('update:dotRadius', Number(($event.target as HTMLInputElement).value))"
          />
        </div>
      </div>

      <div class="settings-group">
        <div class="field">
          <label>{{ t('style.defaultFont') }}</label>
          <FontFamilyPicker
            :model-value="defaultFontFamily"
            @update:model-value="emit('update:defaultFontFamily', $event)"
          />
        </div>
        <div class="field">
          <label class="slider-label">
            <span>{{ t('style.calloutFontSize') }}</span>
            <span class="slider-value">{{ calloutFontSize }}px</span>
          </label>
          <input
            class="size-slider"
            type="range"
            :min="CALLOUT_FONT_SIZE_MIN"
            :max="CALLOUT_FONT_SIZE_MAX"
            :step="1"
            :value="calloutFontSize"
            @input="emit('update:calloutFontSize', Number(($event.target as HTMLInputElement).value))"
          />
        </div>
        <div class="field">
          <label class="check">
            <input
              type="checkbox"
              :checked="calloutFillEnabled"
              @change="
                emit(
                  'update:calloutFillEnabled',
                  ($event.target as HTMLInputElement).checked,
                )
              "
            />
            <span>{{ t('style.calloutFill') }}</span>
          </label>
        </div>
        <template v-if="calloutFillEnabled">
          <div class="field">
            <label class="color-swatch color-swatch-inline">
              {{ t('style.calloutFillColor') }}
              <input
                type="color"
                :value="calloutFillColor"
                @input="emit('update:calloutFillColor', ($event.target as HTMLInputElement).value)"
              />
            </label>
          </div>
          <div class="field">
            <label class="slider-label">
              <span>{{ t('style.calloutFillOpacity') }}</span>
              <span class="slider-value">{{ Math.round(calloutFillOpacity * 100) }}%</span>
            </label>
            <input
              class="size-slider"
              type="range"
              :min="CALLOUT_FILL_OPACITY_MIN"
              :max="CALLOUT_FILL_OPACITY_MAX"
              :step="0.05"
              :value="calloutFillOpacity"
              @input="
                emit(
                  'update:calloutFillOpacity',
                  Number(($event.target as HTMLInputElement).value),
                )
              "
            />
          </div>
        </template>
        <div class="field" style="margin-bottom: 0">
          <label class="check">
            <input
              type="checkbox"
              :checked="calloutBorderEnabled"
              @change="
                emit(
                  'update:calloutBorderEnabled',
                  ($event.target as HTMLInputElement).checked,
                )
              "
            />
            <span>{{ t('style.calloutBorder') }}</span>
          </label>
          <p class="field-hint">{{ t('style.calloutBorderHint') }}</p>
        </div>
      </div>
    </div>

    <div
      v-if="showAnnotation && selectionCount > 0"
      class="settings-stack settings-stack-annotation"
    >
      <h3 class="panel-title settings-stack-title">
        <span class="title-icon" aria-hidden="true">✎</span>
        {{ selectionTitle }}
      </h3>
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
          <select
            :value="sharedCalloutSide ?? ''"
            @change="
              emit('patch', {
                calloutSide: ($event.target as HTMLSelectElement).value as CalloutSide,
              })
            "
          >
            <option v-if="sharedCalloutSide === null" value="" disabled>
              {{ t('style.mixed') }}
            </option>
            <option value="auto">{{ t('style.calloutSide.auto') }}</option>
            <option value="left">{{ t('style.calloutSide.left') }}</option>
            <option value="right">{{ t('style.calloutSide.right') }}</option>
          </select>
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
    <p v-else-if="showAnnotation" class="hint">{{ t('style.noSelectionHint') }}</p>
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

.settings-stack-title {
  margin: 0 2px;
}

.settings-stack-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0 2px;
}

.settings-stack-header .settings-stack-title {
  margin: 0;
}

.presets-btn {
  flex: 0 0 auto;
  margin: 0;
  padding: 5px 10px;
  border: 1px solid var(--line-strong);
  border-radius: 980px;
  background: rgba(255, 255, 255, 0.88);
  color: var(--ink-muted);
  font-size: 0.72rem;
  font-weight: 650;
  cursor: pointer;
}

.presets-btn:hover {
  border-color: var(--accent);
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

.settings-stack-annotation .settings-stack-title {
  color: var(--accent-strong);
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

.check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.78rem;
  font-weight: 590;
  color: var(--ink-muted);
  cursor: pointer;
}

.check input {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--accent);
}

.field-hint {
  margin: 4px 0 0;
  color: var(--ink-muted);
  font-size: 0.72rem;
  line-height: 1.35;
  opacity: 0.85;
}

.title-icon {
  font-size: 1.15em;
  line-height: 1;
  opacity: 0.85;
}

.color-swatch {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.78rem;
  font-weight: 590;
  color: var(--ink-muted);
}

.color-swatch-inline {
  justify-content: space-between;
  width: 100%;
  font-size: 0.78rem;
  font-weight: 590;
  color: var(--ink-muted);
}

.color-swatch input[type='color'] {
  width: 36px;
  height: 28px;
  padding: 2px;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.8);
  cursor: pointer;
}

.slider-label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.slider-value {
  font-variant-numeric: tabular-nums;
  color: var(--ink-muted);
  font-weight: 600;
  font-size: 0.78rem;
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

.line-style-buttons {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.line-style-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
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

.line-style-btn:hover {
  border-color: var(--accent);
  color: var(--ink);
}

.line-style-btn.active {
  border-color: rgba(0, 122, 255, 0.45);
  background: var(--accent-soft);
  color: var(--accent-strong);
  box-shadow: inset 0 0 0 1px rgba(0, 122, 255, 0.12);
}

.line-style-icon {
  display: block;
  flex: 0 0 auto;
}

.anchor-style-buttons {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.anchor-style-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 10px 6px;
  border: 1px solid var(--line-strong);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.88);
  color: var(--ink-muted);
  cursor: pointer;
}

.anchor-style-btn:hover {
  border-color: var(--accent);
  color: var(--ink);
}

.anchor-style-btn.active {
  border-color: rgba(0, 122, 255, 0.45);
  background: var(--accent-soft);
  color: var(--accent-strong);
  box-shadow: inset 0 0 0 1px rgba(0, 122, 255, 0.12);
}

.anchor-style-icon {
  display: block;
  flex: 0 0 auto;
}
</style>
