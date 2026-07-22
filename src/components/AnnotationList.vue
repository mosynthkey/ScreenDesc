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
  editDescription: [id: string, value: string]
}>()

const { t } = useI18n()
const draggingId = ref<string | null>(null)
const dragOverId = ref<string | null>(null)

function onDragStart(id: string, event: DragEvent): void {
  draggingId.value = id
  event.dataTransfer?.setData('text/plain', id)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onDragOver(id: string, event: DragEvent): void {
  if (!draggingId.value || draggingId.value === id) return
  event.preventDefault()
  dragOverId.value = id
}

function onDragEnd(): void {
  draggingId.value = null
  dragOverId.value = null
}

function onDrop(targetId: string, event: DragEvent): void {
  event.preventDefault()
  const sourceId = draggingId.value
  draggingId.value = null
  dragOverId.value = null
  if (!sourceId || sourceId === targetId) return

  const ids = props.annotations.map((item) => item.id)
  const fromIndex = ids.indexOf(sourceId)
  const toIndex = ids.indexOf(targetId)
  if (fromIndex === -1 || toIndex === -1) return

  ids.splice(fromIndex, 1)
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

    <ul v-else class="list" role="list">
      <li
        v-for="annotation in annotations"
        :key="annotation.id"
        class="annotation-item"
        draggable="true"
        :class="{
          selected: selectedIds.includes(annotation.id),
          dragging: draggingId === annotation.id,
          'drag-over': dragOverId === annotation.id && draggingId !== annotation.id,
        }"
        @click="emit('select', annotation.id, $event.shiftKey)"
        @dragstart="onDragStart(annotation.id, $event)"
        @dragover="onDragOver(annotation.id, $event)"
        @dragend="onDragEnd"
        @drop="onDrop(annotation.id, $event)"
      >
        <span class="drag-handle" :title="t('annotationList.dragTitle')" aria-hidden="true">⠿</span>
        <input
          class="desc-input"
          type="text"
          :value="annotation.description"
          :placeholder="t('annotationList.descriptionPlaceholder')"
          @click.stop
          @input="emit('editDescription', annotation.id, ($event.target as HTMLInputElement).value)"
        />
        <button
          class="icon-btn remove-btn"
          type="button"
          :title="t('annotationList.removeTitle')"
          @click.stop="emit('remove', annotation.id)"
        >
          ×
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.annotation-item {
  display: grid;
  grid-template-columns: 14px 1fr auto;
  gap: 6px;
  align-items: center;
  padding: 6px 4px;
  margin: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
}

.annotation-item:hover {
  background: rgba(120, 120, 128, 0.08);
}

.annotation-item:active {
  transform: none;
}

.annotation-item.selected {
  background: var(--accent-soft);
  border-color: transparent;
  box-shadow: none;
}

.annotation-item.dragging {
  opacity: 0.35;
}

.annotation-item.drag-over {
  box-shadow: inset 0 -2px 0 var(--accent);
}

.drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  color: transparent;
  font-size: 0.85rem;
  line-height: 1;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.annotation-item:hover .drag-handle,
.annotation-item.dragging .drag-handle {
  color: var(--ink-muted);
}

.desc-input {
  width: 100%;
  min-width: 0;
  margin: 0;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 4px 6px;
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--ink);
  background: transparent;
  transition: border-color var(--spring), background var(--spring);
}

.desc-input::placeholder {
  color: var(--ink-muted);
  font-weight: 400;
}

.desc-input:hover {
  background: rgba(255, 255, 255, 0.45);
}

.desc-input:focus {
  outline: none;
  border-color: var(--accent);
  background: #fff;
}

.remove-btn {
  opacity: 0;
  width: 24px;
  height: 24px;
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
