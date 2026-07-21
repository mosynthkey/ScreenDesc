<script setup lang="ts">
import { computed, onMounted } from 'vue'
import type {
  Annotation,
  AnnotationMode,
  CalloutSide,
  LineStyleId,
  TextStylePreset,
} from '../types/annotation'
import { textStyleLabel, textStyleOptions } from '../i18n/labels'
import { useI18n } from '../i18n'
import { GOOGLE_FONT_OPTIONS, loadGoogleFont } from '../utils/googleFonts'
import { getLineStyleOptions } from '../utils/lineStyle'

const CALLOUT_FONT_SIZE_OPTIONS = [12, 14, 16, 18, 20, 24, 28, 32, 36, 40]

defineProps<{
  annotation: Annotation | null
  defaultAnnotationMode: AnnotationMode
  defaultTextStyle: TextStylePreset
  defaultFontFamily: string
  lineStyle: LineStyleId
  lineColor: string
  dotColor: string
  dotRadius: number
  lineHalo: boolean
  calloutFontSize: number
  calloutBorderWidth: number
}>()

const emit = defineEmits<{
  'update:defaultAnnotationMode': [mode: AnnotationMode]
  'update:defaultTextStyle': [style: TextStylePreset]
  'update:defaultFontFamily': [fontFamily: string]
  'update:lineStyle': [style: LineStyleId]
  'update:lineColor': [color: string]
  'update:dotColor': [color: string]
  'update:dotRadius': [radius: number]
  'update:lineHalo': [enabled: boolean]
  'update:calloutFontSize': [size: number]
  'update:calloutBorderWidth': [width: number]
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
const dotRadiusOptions = computed(() => [
  { value: 2.5, label: t('style.dotRadius.small') },
  { value: 4.5, label: t('style.dotRadius.medium') },
  { value: 6.5, label: t('style.dotRadius.large') },
  { value: 9, label: t('style.dotRadius.xlarge') },
])
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
      <div v-if="defaultAnnotationMode === 'callout' && lineStyle !== 'invert'" class="field">
        <label>{{ t('style.lineAndDotColor') }}</label>
        <div class="color-row">
          <label class="color-swatch">
            {{ t('style.lineColor') }}
            <input
              type="color"
              :value="lineColor"
              @input="emit('update:lineColor', ($event.target as HTMLInputElement).value)"
            />
          </label>
          <label class="color-swatch">
            {{ t('style.dotColor') }}
            <input
              type="color"
              :value="dotColor"
              @input="emit('update:dotColor', ($event.target as HTMLInputElement).value)"
            />
          </label>
        </div>
      </div>
      <div v-if="defaultAnnotationMode === 'callout'" class="field">
        <label>{{ t('style.dotRadius') }}</label>
        <select
          :value="dotRadius"
          @change="emit('update:dotRadius', Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="option in dotRadiusOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
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
        <label>{{ t('style.calloutFontSize') }}</label>
        <select
          :value="calloutFontSize"
          @change="emit('update:calloutFontSize', Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="size in CALLOUT_FONT_SIZE_OPTIONS" :key="size" :value="size">
            {{ size }}px
          </option>
        </select>
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
</style>
