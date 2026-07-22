<script setup lang="ts">
import { computed, onMounted } from 'vue'
import type {
  Annotation,
  AnnotationMode,
  CalloutSide,
  LineStyleId,
  NumberStyleId,
  TextStylePreset,
} from '../types/annotation'
import { textStyleLabel, textStyleOptions } from '../i18n/labels'
import { useI18n, type MessageKey } from '../i18n'
import { GOOGLE_FONT_OPTIONS, loadGoogleFont } from '../utils/googleFonts'
import { getLineStyleOptions, LINE_WIDTH_MAX, LINE_WIDTH_MIN } from '../utils/lineStyle'
import { numberStyleIds } from '../utils/circledNumbers'

const CALLOUT_FONT_SIZE_MIN = 16
const CALLOUT_FONT_SIZE_MAX = 80
const DOT_RADIUS_MIN = 1.5
const DOT_RADIUS_MAX = 14
const DOT_RADIUS_STEP = 0.5

defineProps<{
  annotation: Annotation | null
  defaultAnnotationMode: AnnotationMode
  defaultTextStyle: TextStylePreset
  defaultFontFamily: string
  lineStyle: LineStyleId
  lineWidth: number
  lineColor: string
  dotRadius: number
  lineHalo: boolean
  calloutFontSize: number
  calloutBorderWidth: number
  numberStyle: NumberStyleId
  labelColor: string
}>()

const emit = defineEmits<{
  'update:defaultAnnotationMode': [mode: AnnotationMode]
  'update:defaultTextStyle': [style: TextStylePreset]
  'update:defaultFontFamily': [fontFamily: string]
  'update:lineStyle': [style: LineStyleId]
  'update:lineWidth': [width: number]
  'update:lineColor': [color: string]
  'update:dotRadius': [radius: number]
  'update:lineHalo': [enabled: boolean]
  'update:calloutFontSize': [size: number]
  'update:calloutBorderWidth': [width: number]
  'update:numberStyle': [style: NumberStyleId]
  'update:labelColor': [color: string]
  patch: [
    patch: Partial<{
      textStyle: TextStylePreset
      calloutSide: CalloutSide
      description: string
    }>,
  ]
}>()

const { t } = useI18n()

const lineStyleOptions = computed(() => getLineStyleOptions())
const styleOptions = computed(() => textStyleOptions())
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
const calloutBorderWidthOptions = computed(() => [

  { value: 0, label: t('style.calloutBorder.none') },
  { value: 0.75, label: t('style.calloutBorder.hairline') },
  { value: 1.5, label: t('style.calloutBorder.medium') },
  { value: 2.5, label: t('style.calloutBorder.bold') },
  { value: 4, label: t('style.calloutBorder.heavy') },
])

onMounted(() => {
  for (const option of GOOGLE_FONT_OPTIONS) {
    loadGoogleFont(option.family)
  }
})
</script>

<template>
  <div>
    <div class="settings-group settings-group-project">
      <h3 class="panel-title">
        <span class="title-icon" aria-hidden="true">⚙</span>
        {{ t('style.projectSettingsTitle') }}
      </h3>
      <div class="field">
        <label>{{ t('style.placementMethod') }}</label>
        <select
          :value="defaultAnnotationMode"
          @change="emit('update:defaultAnnotationMode', ($event.target as HTMLSelectElement).value as AnnotationMode)"
        >
          <option value="inline">{{ t('style.mode.inline') }}</option>
          <option value="callout">{{ t('style.mode.callout') }}</option>
        </select>
      </div>
      <div class="field">
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
      <div v-if="defaultAnnotationMode === 'callout'" class="field">
        <label>{{ t('style.lineStyle') }}</label>
        <select
          :value="lineStyle"
          @change="emit('update:lineStyle', ($event.target as HTMLSelectElement).value as LineStyleId)"
        >
          <option v-for="option in lineStyleOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>
      <div v-if="defaultAnnotationMode === 'callout'" class="field">
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
      <div v-if="defaultAnnotationMode === 'callout' && lineStyle !== 'invert'" class="field">
        <label class="color-swatch color-swatch-inline">
          {{ t('style.lineAndDotColor') }}
          <input
            type="color"
            :value="lineColor"
            @input="emit('update:lineColor', ($event.target as HTMLInputElement).value)"
          />
        </label>
      </div>
      <div v-if="defaultAnnotationMode === 'callout'" class="field">
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
      <label v-if="defaultAnnotationMode === 'callout' && lineStyle !== 'invert'" class="check field">
        <input
          type="checkbox"
          :checked="lineHalo"
          @change="emit('update:lineHalo', ($event.target as HTMLInputElement).checked)"
        />
        {{ t('style.lineHalo') }}
      </label>
      <div v-if="defaultAnnotationMode === 'callout'" class="field">
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
      <div v-if="defaultAnnotationMode === 'callout'" class="field">
        <label>{{ t('style.calloutBorderWidth') }}</label>
        <select
          :value="calloutBorderWidth"
          @change="emit('update:calloutBorderWidth', Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="option in calloutBorderWidthOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>
      <div class="field">
        <label>{{ t('style.defaultTextStyle') }}</label>
        <select
          :value="defaultTextStyle"
          @change="emit('update:defaultTextStyle', ($event.target as HTMLSelectElement).value as TextStylePreset)"
        >
          <option v-for="option in styleOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>
      <div v-if="defaultTextStyle === 'label'" class="field">
        <label class="color-swatch color-swatch-inline">
          {{ t('style.labelColor') }}
          <input
            type="color"
            :value="labelColor"
            @input="emit('update:labelColor', ($event.target as HTMLInputElement).value)"
          />
        </label>
      </div>
      <div class="field" style="margin-bottom: 0">
        <label>{{ t('style.defaultFont') }}</label>
        <select
          :value="defaultFontFamily"
          @change="emit('update:defaultFontFamily', ($event.target as HTMLSelectElement).value)"
        >
          <option
            v-for="option in GOOGLE_FONT_OPTIONS"
            :key="option.family"
            :value="option.family"
            :style="{ fontFamily: `'${option.family}', sans-serif` }"
          >
            {{ option.label }}
          </option>
        </select>
      </div>
    </div>

    <div v-if="annotation" class="settings-group settings-group-annotation">
      <h3 class="panel-title">
        <span class="title-icon" aria-hidden="true">✎</span>
        {{ t('style.selectedAnnotationTitle') }}
      </h3>
      <div class="field">
        <label>{{ t('style.textStyle') }}</label>
        <select
          :value="annotation.textStyle"
          @change="emit('patch', { textStyle: ($event.target as HTMLSelectElement).value as TextStylePreset })"
        >
          <option v-for="option in styleOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>
      <div v-if="annotation.textStyle === 'label' || annotation.resolvedStyle === 'label'" class="field">
        <label class="color-swatch color-swatch-inline">
          {{ t('style.labelColor') }}
          <input
            type="color"
            :value="labelColor"
            @input="emit('update:labelColor', ($event.target as HTMLInputElement).value)"
          />
        </label>
      </div>
      <div v-if="defaultAnnotationMode === 'callout'" class="field">
        <label>{{ t('style.calloutSide') }}</label>
        <select
          :value="annotation.calloutSide"
          @change="emit('patch', { calloutSide: ($event.target as HTMLSelectElement).value as CalloutSide })"
        >
          <option value="auto">{{ t('style.calloutSide.auto') }}</option>
          <option value="left">{{ t('style.calloutSide.left') }}</option>
          <option value="right">{{ t('style.calloutSide.right') }}</option>
        </select>
      </div>
      <div class="field" style="margin-bottom: 0">
        <label>{{ t('style.description') }}</label>
        <textarea
          :value="annotation.description"
          :placeholder="t('style.descriptionPlaceholder')"
          @input="emit('patch', { description: ($event.target as HTMLTextAreaElement).value })"
        />
      </div>
      <p class="hint" style="margin-top: 10px; margin-bottom: 0">
        {{ t('style.resolvedStylePrefix') }}
        <strong>{{ textStyleLabel(annotation.resolvedStyle) }}</strong>
      </p>
    </div>
    <p v-else class="hint">{{ t('style.noSelectionHint') }}</p>
  </div>
</template>

<style scoped>
.settings-group {
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 14px;
  background: rgba(120, 120, 128, 0.05);
}

.settings-group + .settings-group,
.settings-group + p.hint {
  margin-top: 14px;
}

.settings-group .panel-title {
  display: flex;
  align-items: center;
  gap: 6px;
}

.settings-group-annotation {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.settings-group-annotation .panel-title {
  color: var(--accent-strong);
}

.title-icon {
  font-size: 0.85em;
  opacity: 0.8;
}

.color-row {
  display: flex;
  gap: 16px;
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

.check {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  font-size: 0.82rem;
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
</style>
