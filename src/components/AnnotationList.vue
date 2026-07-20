<script setup lang="ts">
import { ref } from 'vue'
import type { Annotation } from '../types/annotation'
import { toCircledNumber } from '../utils/circledNumbers'

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
  <div>
    <h3 class="panel-title">注釈一覧</h3>
    <p v-if="annotations.length === 0" class="hint">
      範囲を描いてセクションを提案し、クリックでステップマーカーを追加。ドラッグで移動、ダブルクリックで説明編集。
    </p>

    <div
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
      <div class="drag-handle" title="ドラッグで並び替え" aria-hidden="true">⠿</div>
      <div class="annotation-number">{{ toCircledNumber(annotation.order) }}</div>
      <div class="annotation-meta">
        <strong>{{ annotation.description || '（説明なし）' }}</strong>
        <input
          class="desc-input"
          type="text"
          :value="annotation.description"
          placeholder="手順の説明"
          @click.stop
          @input="emit('editDescription', annotation.id, ($event.target as HTMLInputElement).value)"
        />
      </div>
      <button class="icon-btn" type="button" title="削除" @click.stop="emit('remove', annotation.id)">
        ×
      </button>
    </div>
  </div>
</template>

<style scoped>
.annotation-item {
  grid-template-columns: auto auto 1fr auto;
}

.drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  color: var(--ink-muted);
  font-size: 1rem;
  line-height: 1;
  cursor: grab;
  touch-action: none;
}

.annotation-item.dragging {
  opacity: 0.4;
}

.annotation-item.drag-over {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-soft) inset;
}

.desc-input {
  width: 100%;
  margin-top: 6px;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 6px 8px;
  font-size: 0.78rem;
  background: rgba(255, 255, 255, 0.7);
  transition: border-color var(--spring), box-shadow var(--spring);
}

.desc-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
</style>
