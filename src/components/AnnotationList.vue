<script setup lang="ts">
import { ref } from 'vue'
import type { Annotation } from '../types/annotation'
import type { NumberPrefixDirection, NumberPrefixStyle } from '../utils/numberPrefix'
import { resolveAnnotationDescription } from '../utils/calloutLayout'
import { useI18n, type MessageKey } from '../i18n'

const props = defineProps<{
  annotations: Annotation[]
  selectedIds: string[]
  /** Currently displayed/edited variation; `null` means the base description. */
  activeVariation: string | null
}>()

const emit = defineEmits<{
  select: [id: string, additive: boolean]
  reorder: [orderedIds: string[]]
  assignNumbers: [direction: NumberPrefixDirection, style: NumberPrefixStyle]
  clearNumbers: []
  remove: [id: string]
}>()

const { t } = useI18n()
const draggingId = ref<string | null>(null)
/** Insert index in the current list (0 … length). */
const dropIndex = ref<number | null>(null)

const numberMenuOpen = ref(false)
const numberDirection = ref<NumberPrefixDirection>('left-to-right')
const numberStyle = ref<NumberPrefixStyle>('circled')

const numberDirectionOptions: Array<{ value: NumberPrefixDirection; labelKey: MessageKey }> = [
  { value: 'left-to-right', labelKey: 'annotationList.numberDirection.leftToRight' },
  { value: 'top-to-bottom', labelKey: 'annotationList.numberDirection.topToBottom' },
]
const numberStyleOptions: Array<{ value: NumberPrefixStyle; labelKey: MessageKey }> = [
  { value: 'circled', labelKey: 'style.numberStyle.circled' },
  { value: 'paren', labelKey: 'style.numberStyle.paren' },
  { value: 'dotted', labelKey: 'style.numberStyle.dotted' },
  { value: 'paren-suffix', labelKey: 'style.numberStyle.parenSuffix' },
  { value: 'plain', labelKey: 'style.numberStyle.plain' },
]

function applyNumbering(): void {
  emit('assignNumbers', numberDirection.value, numberStyle.value)
  numberMenuOpen.value = false
}

function clearNumbering(): void {
  emit('clearNumbers')
  numberMenuOpen.value = false
}

function displayText(annotation: Annotation): string {
  const prefix = annotation.numberPrefix ? `${annotation.numberPrefix} ` : ''
  const text = resolveAnnotationDescription(annotation, props.activeVariation)
  return `${prefix}${text || t('annotationList.emptyDescription')}`
}

function onDragStart(id: string, event: DragEvent): void {
  const target = event.target as HTMLElement | null
  if (target?.closest('.remove-btn')) {
    event.preventDefault()
    return
  }
  draggingId.value = id
  dropIndex.value = null
  event.dataTransfer?.setData('text/plain', id)
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

function onItemDragOver(itemIndex: number, event: DragEvent): void {
  if (!draggingId.value) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  const row = event.currentTarget as HTMLElement
  const rect = row.getBoundingClientRect()
  const insertBefore = event.clientY < rect.top + rect.height / 2
  dropIndex.value = insertBefore ? itemIndex : itemIndex + 1
}

function onListDragOver(event: DragEvent): void {
  if (!draggingId.value) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
}

function onDragLeaveList(event: DragEvent): void {
  const list = event.currentTarget as HTMLElement
  const related = event.relatedTarget as Node | null
  if (related && list.contains(related)) return
  dropIndex.value = null
}

function onDragEnd(): void {
  draggingId.value = null
  dropIndex.value = null
}

function onDrop(event: DragEvent): void {
  event.preventDefault()
  const sourceId = draggingId.value
  const insertAt = dropIndex.value
  draggingId.value = null
  dropIndex.value = null
  if (!sourceId || insertAt === null) return

  const ids = props.annotations.map((item) => item.id)
  const fromIndex = ids.indexOf(sourceId)
  if (fromIndex === -1) return
  if (insertAt === fromIndex || insertAt === fromIndex + 1) return

  ids.splice(fromIndex, 1)
  const toIndex = insertAt > fromIndex ? insertAt - 1 : insertAt
  ids.splice(toIndex, 0, sourceId)
  emit('reorder', ids)
}
</script>

<template>
  <div class="annotation-list">
    <div class="list-header">
      <h3 class="panel-heading">
        <svg
          class="panel-heading-icon"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          aria-hidden="true"
        >
          <path
            d="M8 6h12M8 12h12M8 18h12"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
          <circle cx="4" cy="6" r="1.2" fill="currentColor" />
          <circle cx="4" cy="12" r="1.2" fill="currentColor" />
          <circle cx="4" cy="18" r="1.2" fill="currentColor" />
        </svg>
        {{ t('annotationList.title') }}
      </h3>
      <div v-if="annotations.length > 1" class="list-header-actions">
        <div class="number-menu-anchor">
          <button
            class="list-action-btn"
            type="button"
            :title="t('annotationList.assignNumbersTitle')"
            @click="numberMenuOpen = !numberMenuOpen"
          >
            {{ t('annotationList.assignNumbers') }}
          </button>
          <div v-if="numberMenuOpen" class="number-menu">
            <label class="number-menu-field">
              <span>{{ t('annotationList.numberDirectionLabel') }}</span>
              <select v-model="numberDirection">
                <option
                  v-for="option in numberDirectionOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ t(option.labelKey) }}
                </option>
              </select>
            </label>
            <label class="number-menu-field">
              <span>{{ t('style.numberStyle') }}</span>
              <select v-model="numberStyle">
                <option
                  v-for="option in numberStyleOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ t(option.labelKey) }}
                </option>
              </select>
            </label>
            <div class="number-menu-buttons">
              <button class="number-menu-clear" type="button" @click="clearNumbering">
                {{ t('annotationList.clearNumbers') }}
              </button>
              <button class="number-menu-apply" type="button" @click="applyNumbering">
                {{ t('annotationList.applyNumbers') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <p v-if="annotations.length === 0" class="hint">
      {{ t('annotationList.emptyHint') }}
    </p>
    <p v-else-if="annotations.length > 1" class="hint multi-hint">
      {{ t('annotationList.multiSelectHint') }}
    </p>

    <ul
      v-if="annotations.length > 0"
      class="list"
      role="list"
      @dragover="onListDragOver"
      @dragleave="onDragLeaveList"
      @drop="onDrop"
    >
      <li
        v-if="dropIndex === 0"
        class="drop-indicator"
        aria-hidden="true"
      />
      <template v-for="(annotation, itemIndex) in annotations" :key="annotation.id">
        <li
          class="annotation-item"
          :class="{
            selected: selectedIds.includes(annotation.id),
            dragging: draggingId === annotation.id,
          }"
          draggable="true"
          :title="t('annotationList.dragTitle')"
          @click="emit('select', annotation.id, $event.shiftKey)"
          @dragstart="onDragStart(annotation.id, $event)"
          @dragend="onDragEnd"
          @dragover="onItemDragOver(itemIndex, $event)"
        >
          <span class="desc-text">{{ displayText(annotation) }}</span>
          <button
            class="icon-btn remove-btn"
            type="button"
            :title="t('annotationList.removeTitle')"
            @click.stop="emit('remove', annotation.id)"
            @pointerdown.stop
          >
            ×
          </button>
        </li>
        <li
          v-if="dropIndex === itemIndex + 1"
          class="drop-indicator"
          aria-hidden="true"
        />
      </template>
    </ul>
  </div>
</template>

<style scoped>
.annotation-list {
  width: 100%;
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
  padding: 0 16px;
}

.list-header .panel-heading {
  margin: 0;
}

.list-action-btn {
  flex-shrink: 0;
  padding: 4px 8px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg-panel);
  color: var(--ink-muted);
  font-size: 0.72rem;
  font-weight: 600;
  line-height: 1.2;
  cursor: pointer;
  transition:
    background var(--spring),
    border-color var(--spring),
    color var(--spring);
}

.list-action-btn:hover {
  border-color: var(--line-strong);
  background: var(--bg-elevated);
  color: var(--ink);
}

.list-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.number-menu-anchor {
  position: relative;
}

.number-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 200px;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--bg-elevated);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.number-menu-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.75rem;
  color: var(--ink-muted);
}

.number-menu-field select {
  padding: 4px 6px;
  border: 1px solid var(--line);
  border-radius: 6px;
  font-size: 0.8rem;
  color: var(--ink);
}

.number-menu-buttons {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.number-menu-apply,
.number-menu-clear {
  padding: 5px 10px;
  border: none;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
}

.number-menu-apply {
  background: var(--accent);
  color: #fff;
}

.number-menu-clear {
  background: transparent;
  color: var(--ink-muted);
  border: 1px solid var(--line);
}

.number-menu-clear:hover {
  color: var(--ink);
  border-color: var(--line-strong);
}

.hint,
.multi-hint {
  padding: 0 16px;
}

.multi-hint {
  margin: -2px 0 10px;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0;
  border: solid var(--line);
  border-width: 1px 0;
  border-radius: 0;
  overflow: hidden;
  background: var(--bg-elevated);
}

.drop-indicator {
  flex: 0 0 auto;
  height: 2px;
  margin: 0;
  padding: 0;
  border: none;
  background: var(--accent);
  pointer-events: none;
}

.annotation-item {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px;
  align-items: center;
  padding: 8px 8px 8px 12px;
  margin: 0;
  border: none;
  border-bottom: 1px solid var(--line);
  border-radius: 0;
  background: transparent;
  cursor: grab;
  touch-action: none;
  user-select: none;
  transition:
    background var(--spring),
    opacity var(--spring);
}

.list > .annotation-item:last-child {
  border-bottom: none;
}

.annotation-item:hover {
  background: rgba(120, 120, 128, 0.06);
}

.annotation-item:active {
  cursor: grabbing;
}

.annotation-item.selected {
  background: var(--accent-soft);
  box-shadow: inset 3px 0 0 var(--accent);
}

.annotation-item.dragging {
  opacity: 0.4;
}

.desc-text {
  min-width: 0;
  padding: 2px 0;
  font-size: 0.86rem;
  font-weight: 500;
  line-height: 1.35;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remove-btn {
  opacity: 0.45;
  width: 28px;
  height: 28px;
  background: transparent;
  color: var(--ink-muted);
  cursor: pointer;
  touch-action: manipulation;
}

.annotation-item:hover .remove-btn,
.annotation-item.selected .remove-btn,
.remove-btn:focus-visible {
  opacity: 1;
}

.remove-btn:hover {
  color: var(--ink);
  background: rgba(120, 120, 128, 0.16);
}
</style>
