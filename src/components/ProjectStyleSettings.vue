<script setup lang="ts">
import { computed, watch } from 'vue'
import type {
  AnchorStyleId,
  LineStyleId,
  NumberStyleId,
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
  DOT_RADIUS_MAX,
  DOT_RADIUS_MIN,
  DOT_RADIUS_STEP,
} from '../utils/markerSize'
import {
  CALLOUT_FILL_OPACITY_MAX,
  CALLOUT_FILL_OPACITY_MIN,
} from '../utils/commonSettings'
import { numberStyleIds } from '../utils/circledNumbers'

const props = defineProps<{
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
}>()

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

function parseBoundedNumber(
  raw: string,
  min: number,
  max: number,
  step?: number,
): number | null {
  const trimmed = raw.trim().replace(/%$/i, '').replace(/px$/i, '')
  if (trimmed === '' || trimmed === '-' || trimmed === '+') return null
  const value = Number(trimmed)
  if (!Number.isFinite(value)) return null
  let next = Math.min(max, Math.max(min, value))
  if (step !== undefined && step > 0) {
    const steps = Math.round((next - min) / step)
    next = min + steps * step
    const stepText = String(step)
    const decimals = stepText.includes('.') ? stepText.split('.')[1]!.length : 0
    next = Number(next.toFixed(decimals))
  }
  return Math.min(max, Math.max(min, next))
}

function onProjectPxChange(
  event: Event,
  min: number,
  max: number,
  step: number | undefined,
  apply: (value: number) => void,
  fallback: number,
): void {
  const input = event.target as HTMLInputElement
  const parsed = parseBoundedNumber(input.value, min, max, step)
  if (parsed === null) {
    input.value = String(fallback)
    return
  }
  input.value = String(parsed)
  apply(parsed)
}

function onLineWidthChange(event: Event): void {
  onProjectPxChange(event, LINE_WIDTH_MIN, LINE_WIDTH_MAX, 0.5, (value) => {
    emit('update:lineWidth', value)
  }, props.lineWidth)
}

function onLineHaloWidthChange(event: Event): void {
  onProjectPxChange(
    event,
    LINE_HALO_WIDTH_MIN,
    LINE_HALO_WIDTH_MAX,
    0.5,
    (value) => {
      emit('update:lineHaloWidth', value)
    },
    props.lineHaloWidth,
  )
}

function onDotRadiusChange(event: Event): void {
  onProjectPxChange(event, DOT_RADIUS_MIN, DOT_RADIUS_MAX, DOT_RADIUS_STEP, (value) => {
    emit('update:dotRadius', value)
  }, props.dotRadius)
}

function onCalloutFontSizeChange(event: Event): void {
  onProjectPxChange(
    event,
    CALLOUT_FONT_SIZE_MIN,
    CALLOUT_FONT_SIZE_MAX,
    1,
    (value) => {
      emit('update:calloutFontSize', value)
    },
    props.calloutFontSize,
  )
}

function displayFillOpacityPercent(): string {
  return String(Math.round(props.calloutFillOpacity * 100))
}

function onCalloutFillOpacityChange(event: Event): void {
  const input = event.target as HTMLInputElement
  const percent = parseBoundedNumber(input.value, 0, 100, 5)
  if (percent === null) {
    input.value = displayFillOpacityPercent()
    return
  }
  input.value = String(percent)
  emit('update:calloutFillOpacity', percent / 100)
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
  <div class="settings-stack">
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
          <div class="px-field px-field-compact">
            <input
              type="text"
              inputmode="decimal"
              :value="lineWidth"
              @change="onLineWidthChange"
              @keydown.enter.prevent="onLineWidthChange"
            />
            <span class="px-unit">px</span>
          </div>
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
          <div class="px-field px-field-compact">
            <input
              type="text"
              inputmode="decimal"
              :value="lineHaloWidth"
              @change="onLineHaloWidthChange"
              @keydown.enter.prevent="onLineHaloWidthChange"
            />
            <span class="px-unit">px</span>
          </div>
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
          <div class="px-field px-field-compact">
            <input
              type="text"
              inputmode="decimal"
              :value="dotRadius"
              @change="onDotRadiusChange"
              @keydown.enter.prevent="onDotRadiusChange"
            />
            <span class="px-unit">px</span>
          </div>
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
          <div class="px-field px-field-compact">
            <input
              type="text"
              inputmode="numeric"
              :value="calloutFontSize"
              @change="onCalloutFontSizeChange"
              @keydown.enter.prevent="onCalloutFontSizeChange"
            />
            <span class="px-unit">px</span>
          </div>
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
            <div class="px-field px-field-compact">
              <input
                type="text"
                inputmode="numeric"
                :value="displayFillOpacityPercent()"
                @change="onCalloutFillOpacityChange"
                @keydown.enter.prevent="onCalloutFillOpacityChange"
              />
              <span class="px-unit">%</span>
            </div>
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
</template>

<style scoped>
.settings-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
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
.settings-group + p.hint {
  margin-top: 0;
}

.settings-group .panel-title {
  display: flex;
  align-items: center;
  gap: 6px;
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
