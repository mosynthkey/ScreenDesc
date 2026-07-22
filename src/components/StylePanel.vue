<script setup lang="ts">
import { computed, watch } from 'vue'
import type {
  Annotation,
  CalloutSide,
  LineStyleId,
  NumberStyleId,
} from '../types/annotation'
import { useI18n, type MessageKey } from '../i18n'
import {
  fontsByGroup,
  loadAllGoogleFonts,
  loadGoogleFont,
  type FontGroupId,
} from '../utils/googleFonts'
import {
  getLineStyleOptions,
  LINE_HALO_WIDTH_MAX,
  LINE_HALO_WIDTH_MIN,
  LINE_OPACITY_MAX,
  LINE_OPACITY_MIN,
  LINE_WIDTH_MAX,
  LINE_WIDTH_MIN,
} from '../utils/lineStyle'
import {
  CALLOUT_BORDER_WIDTH_MAX,
  CALLOUT_BORDER_WIDTH_MIN,
  CALLOUT_FONT_SIZE_MAX,
  CALLOUT_FONT_SIZE_MIN,
  DOT_RADIUS_MAX,
  DOT_RADIUS_MIN,
  DOT_RADIUS_STEP,
} from '../utils/markerSize'
import { numberStyleIds } from '../utils/circledNumbers'

const props = withDefaults(
  defineProps<{
    annotation: Annotation | null
    defaultFontFamily: string
    lineStyle: LineStyleId
    lineWidth: number
    lineColor: string
    lineOpacity: number
    dotRadius: number
    lineHaloWidth: number
    lineHaloColor: string
    calloutFontSize: number
    calloutBorderWidth: number
    numberStyle: NumberStyleId
    showProject?: boolean
    showAnnotation?: boolean
  }>(),
  {
    showProject: true,
    showAnnotation: true,
  },
)

const emit = defineEmits<{
  'update:defaultFontFamily': [fontFamily: string]
  'update:lineStyle': [style: LineStyleId]
  'update:lineWidth': [width: number]
  'update:lineColor': [color: string]
  'update:lineOpacity': [opacity: number]
  'update:dotRadius': [radius: number]
  'update:lineHaloWidth': [width: number]
  'update:lineHaloColor': [color: string]
  'update:calloutFontSize': [size: number]
  'update:calloutBorderWidth': [width: number]
  'update:numberStyle': [style: NumberStyleId]
  patch: [
    patch: Partial<{
      calloutSide: CalloutSide
      description: string
    }>,
  ]
}>()

const { t } = useI18n()

const lineStyleOptions = computed(() => getLineStyleOptions())
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

const FONT_GROUP_LABEL_KEYS: Record<FontGroupId, MessageKey> = {
  japanese: 'style.fontGroup.japanese',
  sans: 'style.fontGroup.sans',
  serif: 'style.fontGroup.serif',
  display: 'style.fontGroup.display',
}

const fontGroups = computed(() =>
  fontsByGroup().map((entry) => ({
    ...entry,
    label: t(FONT_GROUP_LABEL_KEYS[entry.group]),
  })),
)

watch(
  () => props.defaultFontFamily,
  (family) => {
    loadGoogleFont(family)
  },
  { immediate: true },
)

function onFontPickerOpen(): void {
  loadAllGoogleFonts()
}
</script>

<template>
  <div>
    <div v-if="showProject" class="settings-group settings-group-project">
      <h3 class="panel-title">
        <span class="title-icon" aria-hidden="true">⚙</span>
        {{ t('style.projectSettingsTitle') }}
      </h3>
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
      <div class="field">
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
      <div class="field">
        <label class="slider-label">
          <span>{{ t('style.lineOpacity') }}</span>
          <span class="slider-value">{{ Math.round(lineOpacity * 100) }}%</span>
        </label>
        <input
          class="size-slider"
          type="range"
          :min="LINE_OPACITY_MIN"
          :max="LINE_OPACITY_MAX"
          :step="0.05"
          :value="lineOpacity"
          @input="emit('update:lineOpacity', Number(($event.target as HTMLInputElement).value))"
        />
      </div>
      <div class="field">
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
      <div v-if="lineStyle !== 'invert'" class="field">
        <label class="color-swatch color-swatch-inline">
          {{ t('style.lineHaloColor') }}
          <input
            type="color"
            :value="lineHaloColor"
            @input="emit('update:lineHaloColor', ($event.target as HTMLInputElement).value)"
          />
        </label>
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
        <label class="slider-label">
          <span>{{ t('style.calloutBorderWidth') }}</span>
          <span class="slider-value">
            {{
              calloutBorderWidth === 0
                ? t('style.calloutBorder.none')
                : `${calloutBorderWidth}px`
            }}
          </span>
        </label>
        <input
          class="size-slider"
          type="range"
          :min="CALLOUT_BORDER_WIDTH_MIN"
          :max="CALLOUT_BORDER_WIDTH_MAX"
          :step="0.25"
          :value="calloutBorderWidth"
          @input="emit('update:calloutBorderWidth', Number(($event.target as HTMLInputElement).value))"
        />
      </div>
      <div class="field" style="margin-bottom: 0">
        <label>{{ t('style.defaultFont') }}</label>
        <select
          :value="defaultFontFamily"
          @focus="onFontPickerOpen"
          @change="emit('update:defaultFontFamily', ($event.target as HTMLSelectElement).value)"
        >
          <optgroup v-for="group in fontGroups" :key="group.group" :label="group.label">
            <option
              v-for="option in group.fonts"
              :key="option.family"
              :value="option.family"
              :style="{ fontFamily: `'${option.family}', sans-serif` }"
            >
              {{ option.label }}
            </option>
          </optgroup>
        </select>
      </div>
    </div>

    <div v-if="showAnnotation && annotation" class="settings-group settings-group-annotation">
      <h3 class="panel-title">
        <span class="title-icon" aria-hidden="true">✎</span>
        {{ t('style.selectedAnnotationTitle') }}
      </h3>
      <div class="field">
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
    </div>
    <p v-else-if="showAnnotation" class="hint">{{ t('style.noSelectionHint') }}</p>
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
</style>
