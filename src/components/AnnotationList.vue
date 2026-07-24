<script setup lang="ts">
import { ref } from 'vue'
import type { Annotation } from '../types/annotation'
import { useI18n } from '../i18n'

const props = defineProps<{
  annotations: Annotation[]
  selectedIds: string[]
}>()

const emit = defineEmits<{
  select: [id: string, additive: boolean]
  reorder: [orderedIds: string[]]
  sortByXY: []
  remove: [id: string]
}>()

const { t } = useI18n()
const draggingId = ref<string | null>(null)
/** Insert index in the current list (0 … length). */
const dropIndex = ref<number | null>(null)

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
      <button
        v-if="annotations.length > 1"
        class="sort-by-xy-btn"
        type="button"
        :title="t('annotationList.sortByXYTitle')"
        @click="emit('sortByXY')"
      >
        {{ t('annotationList.sortByXY') }}
      </button>
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
          <span class="desc-text">
            {{ annotation.description || t('annotationList.emptyDescription') }}
          </span>
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

.sort-by-xy-btn {
  flex-shrink: 0;
  padding: 4px 8px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
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

.sort-by-xy-btn:hover {
  border-color: var(--line-strong);
  background: #fff;
  color: var(--ink);
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
  background: rgba(255, 255, 255, 0.88);
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
