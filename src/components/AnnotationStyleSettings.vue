<script setup lang="ts">
import { computed, toRefs } from 'vue'
import { storeToRefs } from 'pinia'
import type {
  Annotation,
  CalloutSide,
  Point,
  Section,
} from '../types/annotation'
import { useI18n } from '../i18n'
import { useAnnotationStore } from '../stores/annotationStore'
import { resolveAnnotationDescription } from '../utils/calloutLayout'
import { PenLineIcon } from '@lucide/vue'
import {
  ANCHOR_OFFSET_STEP,
  ANCHOR_OUTSIDE_GAP_MAX,
  ANCHOR_OUTSIDE_GAP_MIN,
  ANCHOR_OUTSIDE_GAP_STEP,
  DEFAULT_ANCHOR_OUTSIDE_GAP,
  anchorOffsetExtent,
  clampAnchorOffsetAxis,
  normalizeAnchorOutsideGap,
} from '../utils/markerSize'

const store = useAnnotationStore()
const { selectedAnnotations, documentWidth, documentHeight, labelPositions } =
  storeToRefs(store)
const { sections, selectedSectionIds, activeVariation, imageWidth, imageHeight } =
  toRefs(store.state)
const {
  patchSelectedAnnotations,
  commitDescription,
  toggleSectionOutline,
  toggleSectionOutlineHalo,
  clearSelection,
} = store

const { t } = useI18n()

const activeAnnotations = computed(() => selectedAnnotations.value)
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

const sharedAnchorOutsideGap = computed<number | null>(() => {
  const first = activeAnnotations.value[0]
  if (!first) return null
  return activeAnnotations.value.every(
    (item) => item.anchorOutsideGap === first.anchorOutsideGap,
  )
    ? first.anchorOutsideGap
    : null
})

function sectionForAnnotation(annotation: Annotation): Section | null {
  if (!annotation.sectionId) return null
  return sections.value.find((section) => section.id === annotation.sectionId) ?? null
}

/**
 * The UI element(s) the outline toggle applies to: sections behind selected
 * annotations, plus sections selected directly (clicking the UI element
 * itself rather than one of its annotations) — either path counts as "the
 * currently selected UI element".
 */
const targetSections = computed<Section[]>(() => {
  const byId = new Map<string, Section>()
  for (const annotation of activeAnnotations.value) {
    const section = sectionForAnnotation(annotation)
    if (section) byId.set(section.id, section)
  }
  for (const section of sections.value) {
    if (selectedSectionIds.value.includes(section.id)) byId.set(section.id, section)
  }
  return [...byId.values()]
})

const showSectionOutlineToggle = computed(() => targetSections.value.length > 0)

const sharedSectionOutlineEnabled = computed<boolean | null>(() => {
  const items = targetSections.value
  const first = items[0]
  if (!first) return null
  const firstEnabled = first.outlineEnabled === true
  return items.every((section) => (section.outlineEnabled === true) === firstEnabled)
    ? firstEnabled
    : null
})

function onSectionOutlineEnabledChange(event: Event): void {
  const checked = (event.target as HTMLInputElement).checked
  toggleSectionOutline(checked)
}

const sharedSectionOutlineHaloEnabled = computed<boolean | null>(() => {
  const items = targetSections.value
  const first = items[0]
  if (!first) return null
  const firstEnabled = first.outlineHaloEnabled === true
  return items.every((section) => (section.outlineHaloEnabled === true) === firstEnabled)
    ? firstEnabled
    : null
})

function onSectionOutlineHaloEnabledChange(event: Event): void {
  const checked = (event.target as HTMLInputElement).checked
  toggleSectionOutlineHalo(checked)
}

function parseAnchorOutsideGapPx(raw: string): number | null {
  const trimmed = raw.trim().replace(/px$/i, '')
  if (trimmed === '' || trimmed === '-' || trimmed === '+') return null
  const value = Number(trimmed)
  if (!Number.isFinite(value)) return null
  return normalizeAnchorOutsideGap(value)
}

function emitAnchorOutsideGap(raw: string): void {
  if (selectionCount.value === 0) return
  const parsed = parseAnchorOutsideGapPx(raw)
  if (parsed === null) return
  patchSelectedAnnotations({ anchorOutsideGap: parsed })
}

function onAnchorOutsideGapChange(event: Event): void {
  const input = event.target as HTMLInputElement
  const parsed = parseAnchorOutsideGapPx(input.value)
  if (parsed === null) {
    input.value =
      sharedAnchorOutsideGap.value === null ? '' : String(sharedAnchorOutsideGap.value)
    return
  }
  input.value = String(parsed)
  emitAnchorOutsideGap(String(parsed))
}

function onAnchorOutsideGapSlider(event: Event): void {
  emitAnchorOutsideGap((event.target as HTMLInputElement).value)
}

function displayAnchorOutsideGap(): string {
  return sharedAnchorOutsideGap.value === null ? '' : String(sharedAnchorOutsideGap.value)
}

function sliderAnchorOutsideGap(): number {
  if (sharedAnchorOutsideGap.value !== null) return sharedAnchorOutsideGap.value
  return primaryAnnotation.value?.anchorOutsideGap ?? DEFAULT_ANCHOR_OUTSIDE_GAP
}

function resolvedLabelPosition(annotation: Annotation): Point {
  if (annotation.calloutPosition) return annotation.calloutPosition
  return labelPositions.value[annotation.id] ?? { x: 0, y: 0 }
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

const anchorOffsetXExtent = computed(() => anchorOffsetExtent(imageWidth.value))
const anchorOffsetYExtent = computed(() => anchorOffsetExtent(imageHeight.value))
const labelPositionXMax = computed(() => Math.max(0, documentWidth.value - 8))
const labelPositionYMax = computed(() => Math.max(0, documentHeight.value - 8))

function parseAnchorOffsetPx(axis: 'x' | 'y', raw: string): number | null {
  const trimmed = raw.trim().replace(/px$/i, '')
  if (trimmed === '' || trimmed === '-' || trimmed === '+') return null
  const value = Number(trimmed)
  if (!Number.isFinite(value)) return null
  const imageSize = axis === 'x' ? imageWidth.value : imageHeight.value
  return clampAnchorOffsetAxis(value, imageSize)
}

function emitAnchorOffset(axis: 'x' | 'y', raw: string): void {
  if (selectionCount.value === 0) return
  const parsed = parseAnchorOffsetPx(axis, raw)
  if (parsed === null) return
  if (isMultiSelection.value) {
    patchSelectedAnnotations(axis === 'x' ? { anchorOffsetX: parsed } : { anchorOffsetY: parsed })
    return
  }
  const annotation = primaryAnnotation.value
  if (!annotation) return
  patchSelectedAnnotations({
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
    patchSelectedAnnotations(axis === 'x' ? { calloutPositionX: value } : { calloutPositionY: value })
    return
  }
  const annotation = primaryAnnotation.value
  if (!annotation) return
  const current = resolvedLabelPosition(annotation)
  patchSelectedAnnotations({
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
  patchSelectedAnnotations({ calloutPosition: null })
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
          <PenLineIcon class="panel-heading-icon" :size="18" :stroke-width="2" aria-hidden="true" />
          {{ selectionTitle }}
        </h3>
        <button
          class="panel-action-btn"
          type="button"
          :title="t('style.clearSelection')"
          @click="clearSelection"
        >
          {{ t('style.clearSelection') }}
        </button>
      </div>
      <p v-if="isMultiSelection" class="hint multi-hint">{{ t('style.multiSelectionHint') }}</p>

      <div v-if="!isMultiSelection && primaryAnnotation" class="settings-group settings-group-compact">
        <div class="field field-tight" style="margin-bottom: 0">
          <textarea
            class="description-input"
            rows="2"
            :value="resolveAnnotationDescription(primaryAnnotation, activeVariation)"
            :placeholder="t('style.description')"
            :aria-label="t('style.description')"
            @input="
              commitDescription(
                primaryAnnotation.id,
                ($event.target as HTMLTextAreaElement).value,
              )
            "
          />
        </div>
      </div>

      <div v-if="showSectionOutlineToggle" class="settings-group settings-group-compact">
        <h4 class="section-title">{{ t('style.section.uiElement') }}</h4>
        <div class="field field-tight">
          <label class="check">
            <input
              type="checkbox"
              :checked="sharedSectionOutlineEnabled ?? false"
              :indeterminate.prop="sharedSectionOutlineEnabled === null"
              @change="onSectionOutlineEnabledChange"
            />
            <span>{{ t('style.sectionOutlineEnabled') }}</span>
          </label>
        </div>
        <div class="field field-tight" style="margin-bottom: 0">
          <label class="check">
            <input
              type="checkbox"
              :checked="sharedSectionOutlineHaloEnabled ?? false"
              :indeterminate.prop="sharedSectionOutlineHaloEnabled === null"
              @change="onSectionOutlineHaloEnabledChange"
            />
            <span>{{ t('style.sectionOutlineHaloEnabled') }}</span>
          </label>
        </div>
      </div>

      <div class="settings-group settings-group-compact">
        <h4 class="section-title">{{ t('style.section.placement') }}</h4>
        <div class="field field-tight">
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
              @click="patchSelectedAnnotations({ calloutSide: option.value })"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
        <div class="field field-tight">
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
        <div class="field field-tight">
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
        <div class="field field-tight field-reset" style="margin-bottom: 0">
          <button
            class="btn btn-ghost reset-label-btn"
            type="button"
            :disabled="!hasManualLabelPosition"
            @click="resetLabelPosition"
          >
            {{ t('style.labelPositionReset') }}
          </button>
        </div>
      </div>

      <div class="settings-group settings-group-compact">
        <h4 class="section-title">{{ t('style.section.anchor') }}</h4>
        <div class="field field-tight">
          <label class="slider-label">
            <span>{{ t('style.anchorOutsideGap') }}</span>
            <div class="px-field px-field-compact">
              <input
                type="text"
                inputmode="numeric"
                :value="displayAnchorOutsideGap()"
                :placeholder="sharedAnchorOutsideGap === null ? t('style.mixed') : undefined"
                @change="onAnchorOutsideGapChange"
                @keydown.enter.prevent="onAnchorOutsideGapChange"
              />
              <span class="px-unit">px</span>
            </div>
          </label>
          <input
            class="size-slider"
            type="range"
            :min="ANCHOR_OUTSIDE_GAP_MIN"
            :max="ANCHOR_OUTSIDE_GAP_MAX"
            :step="ANCHOR_OUTSIDE_GAP_STEP"
            :value="sliderAnchorOutsideGap()"
            @input="onAnchorOutsideGapSlider"
          />
        </div>
        <div class="field field-tight">
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
        <div class="field field-tight" style="margin-bottom: 0">
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
    <div
      v-else-if="showSectionOutlineToggle"
      class="settings-stack settings-stack-annotation"
    >
      <div class="settings-stack-header">
        <h3 class="panel-heading settings-stack-title">
          <PenLineIcon class="panel-heading-icon" :size="18" :stroke-width="2" aria-hidden="true" />
          {{ t('style.selectedSectionTitle') }}
        </h3>
        <button
          class="panel-action-btn"
          type="button"
          :title="t('style.clearSelection')"
          @click="clearSelection"
        >
          {{ t('style.clearSelection') }}
        </button>
      </div>
      <div class="settings-group settings-group-compact">
        <h4 class="section-title">{{ t('style.section.uiElement') }}</h4>
        <div class="field field-tight">
          <label class="check">
            <input
              type="checkbox"
              :checked="sharedSectionOutlineEnabled ?? false"
              :indeterminate.prop="sharedSectionOutlineEnabled === null"
              @change="onSectionOutlineEnabledChange"
            />
            <span>{{ t('style.sectionOutlineEnabled') }}</span>
          </label>
        </div>
        <div class="field field-tight" style="margin-bottom: 0">
          <label class="check">
            <input
              type="checkbox"
              :checked="sharedSectionOutlineHaloEnabled ?? false"
              :indeterminate.prop="sharedSectionOutlineHaloEnabled === null"
              @change="onSectionOutlineHaloEnabledChange"
            />
            <span>{{ t('style.sectionOutlineHaloEnabled') }}</span>
          </label>
        </div>
      </div>
    </div>
    <div v-else class="settings-stack-header settings-stack-header-idle">
      <h3 class="panel-heading settings-stack-title">
        <PenLineIcon class="panel-heading-icon" :size="18" :stroke-width="2" aria-hidden="true" />
        {{ t('style.selectedAnnotationTitle') }}
      </h3>
    </div>
    <p v-if="selectionCount === 0 && !showSectionOutlineToggle" class="hint">
      {{ t('style.noSelectionHint') }}
    </p>
  </div>
</template>

<style scoped>
.settings-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.multi-hint {
  margin: -4px 2px 0;
}

.field-reset {
  display: flex;
  justify-content: center;
  align-items: center;
}

.reset-label-btn {
  width: auto;
  min-width: 0;
  margin: 0;
  padding: 5px 12px;
  font-size: 0.75rem;
}

.settings-stack-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0 2px 6px;
}

.settings-stack-header-idle {
  margin-bottom: 8px;
}

.settings-stack-title {
  margin: 0;
  min-width: 0;
}

.settings-group {
  border: none;
  border-radius: 12px;
  padding: 10px;
  background: var(--bg-solid);
  box-shadow: var(--shadow-sm);
}

.settings-group-compact {
  padding: 8px 10px;
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
  background: var(--bg-solid);
}

.settings-group .panel-title {
  display: flex;
  align-items: center;
  gap: 6px;
}

.section-title {
  margin: 0 0 8px;
  color: var(--ink-muted);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: none;
}

.field-tight {
  gap: 4px;
  margin-bottom: 8px;
}

.description-input {
  min-height: 2.6em;
  resize: vertical;
}

.px-field {
  display: flex;
  align-items: center;
  gap: 6px;
}

.px-field-compact {
  width: 5rem;
}

.px-field-compact input {
  padding: 4px 6px;
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
  font-size: 0.72rem;
  font-weight: 650;
}

.slider-label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  font-size: 0.72rem;
}

.size-slider {
  width: 100%;
  margin: 0;
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
    'left . right'
    '. bottom .';
  gap: 4px;
}

.callout-side-top {
  grid-area: top;
}

.callout-side-left {
  grid-area: left;
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
  padding: 5px 4px;
  border: none;
  border-radius: 8px;
  background: rgba(120, 120, 128, 0.1);
  color: var(--ink-muted);
  font-size: 0.68rem;
  font-weight: 650;
  line-height: 1.2;
  cursor: pointer;
}

.callout-side-btn:hover {
  background: rgba(120, 120, 128, 0.16);
  color: var(--ink);
}

.callout-side-btn.active {
  background: var(--accent-soft);
  color: var(--accent-strong);
}
</style>
