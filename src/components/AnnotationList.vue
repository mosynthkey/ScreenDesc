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
  remove: [id: string]
}>()

const { t } = useI18n()
const draggingId = ref<string | null>(null)
/** Insert index in the current list (0 … length). */
const dropIndex = ref<number | null>(null)

function onDragStart(id: string, event: DragEvent): void {
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
    <h3 class="panel-title">{{ t('annotationList.title') }}</h3>
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
          @click="emit('select', annotation.id, $event.shiftKey)"
          @dragover="onItemDragOver(itemIndex, $event)"
        >
          <button
            class="drag-handle"
            type="button"
            draggable="true"
            :title="t('annotationList.dragTitle')"
            :aria-label="t('annotationList.dragTitle')"
            @click.stop
            @dragstart="onDragStart(annotation.id, $event)"
            @dragend="onDragEnd"
          >
            ⠿
          </button>
          <span class="desc-text">
            {{ annotation.description || t('annotationList.emptyDescription') }}
          </span>
          <button
            class="icon-btn remove-btn"
            type="button"
            :title="t('annotationList.removeTitle')"
            @click.stop="emit('remove', annotation.id)"
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
.multi-hint {
  margin: -2px 0 10px;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.drop-indicator {
  height: 3px;
  margin: -2px 8px;
  border-radius: 2px;
  background: var(--accent);
  pointer-events: none;
}

.annotation-item {
  display: grid;
  grid-template-columns: 28px 1fr auto;
  gap: 8px;
  align-items: center;
  padding: 10px 10px 10px 6px;
  margin: 0;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.72);
  cursor: pointer;
  transition:
    background var(--spring),
    border-color var(--spring),
    box-shadow var(--spring),
    opacity var(--spring);
}

.annotation-item:hover {
  border-color: var(--line-strong);
  background: #fff;
}

.annotation-item:active {
  transform: none;
}

.annotation-item.selected {
  border-color: rgba(0, 122, 255, 0.35);
  background: var(--accent-soft);
  box-shadow: inset 0 0 0 1px rgba(0, 122, 255, 0.12);
}

.annotation-item.dragging {
  opacity: 0.4;
}

.drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: #fff;
  color: var(--ink-muted);
  font-size: 0.95rem;
  line-height: 1;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.drag-handle:hover {
  color: var(--ink);
  background: #fff;
}

.drag-handle:active {
  cursor: grabbing;
}

.desc-text {
  min-width: 0;
  padding: 6px 8px;
  font-size: 0.86rem;
  font-weight: 500;
  line-height: 1.35;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remove-btn {
  opacity: 0.55;
  width: 28px;
  height: 28px;
  background: transparent;
  color: var(--ink-muted);
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
