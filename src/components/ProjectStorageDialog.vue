<script setup lang="ts">
import { ref, watch } from 'vue'
import type { SavedProjectMeta } from '../utils/projectStorage'

const props = defineProps<{
  open: boolean
  hasImage: boolean
  projects: SavedProjectMeta[]
  isBusy: boolean
}>()

const emit = defineEmits<{
  close: []
  save: [name: string]
  overwrite: [id: string]
  load: [id: string]
  remove: [id: string]
}>()

const nameInput = ref('')

watch(
  () => props.open,
  (open) => {
    if (open) nameInput.value = defaultName()
  },
)

function defaultName(): string {
  const stamp = new Date().toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `プロジェクト ${stamp}`
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function submitSave(): void {
  const name = nameInput.value.trim()
  if (!name) return
  emit('save', name)
}
</script>

<template>
  <div v-if="open" class="modal-backdrop" @click.self="emit('close')">
    <div class="modal">
      <h2>ブラウザ内ストレージに保存 / 読み込み</h2>
      <p class="hint">
        この端末のブラウザ内に複数のプロジェクトを保存・管理できます。他の端末に持ち出す場合は「エクスポート」を使ってください。
      </p>

      <div class="field">
        <label>名前を付けて保存</label>
        <div class="save-row">
          <input v-model="nameInput" type="text" placeholder="プロジェクト名" :disabled="!hasImage" />
          <button
            class="btn btn-primary"
            type="button"
            :disabled="!hasImage || !nameInput.trim() || isBusy"
            @click="submitSave"
          >
            保存
          </button>
        </div>
        <p v-if="!hasImage" class="hint">画像を開いてから保存できます。</p>
      </div>

      <div class="field">
        <label>保存済みのプロジェクト</label>
        <p v-if="projects.length === 0" class="hint">まだ保存されたプロジェクトはありません。</p>
        <ul v-else class="saved-list">
          <li v-for="project in projects" :key="project.id" class="saved-item">
            <div class="saved-meta">
              <strong>{{ project.name }}</strong>
              <span>{{ formatDate(project.updatedAt) }}</span>
            </div>
            <div class="saved-actions">
              <button class="btn btn-ghost" type="button" :disabled="isBusy" @click="emit('load', project.id)">
                開く
              </button>
              <button
                class="btn btn-ghost"
                type="button"
                :disabled="!hasImage || isBusy"
                title="現在のプロジェクトでこの保存を上書きします"
                @click="emit('overwrite', project.id)"
              >
                上書き保存
              </button>
              <button class="btn btn-danger" type="button" :disabled="isBusy" @click="emit('remove', project.id)">
                削除
              </button>
            </div>
          </li>
        </ul>
      </div>

      <div class="modal-actions">
        <button class="btn btn-ghost" type="button" @click="emit('close')">閉じる</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.save-row {
  display: flex;
  gap: 8px;
}

.save-row input {
  flex: 1;
}

.saved-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 260px;
  overflow-y: auto;
  border: 1px solid var(--line);
  border-radius: 10px;
}

.saved-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
}

.saved-item:last-child {
  border-bottom: none;
}

.saved-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.saved-meta strong {
  font-size: 0.85rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.saved-meta span {
  font-size: 0.72rem;
  color: var(--ink-muted);
}

.saved-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.saved-actions .btn {
  padding: 6px 10px;
  font-size: 0.78rem;
}
</style>
