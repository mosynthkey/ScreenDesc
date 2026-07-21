<script setup lang="ts">
import { ref, watch } from 'vue'
import type { SavedProjectMeta } from '../utils/projectStorage'
import { locale, useI18n } from '../i18n'

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

const { t } = useI18n()
const nameInput = ref('')

watch(
  () => props.open,
  (open) => {
    if (open) nameInput.value = defaultName()
  },
)

function dateLocale(): string {
  return locale.value === 'ja' ? 'ja-JP' : 'en-US'
}

function defaultName(): string {
  const stamp = new Date().toLocaleString(dateLocale(), {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  return t('projectStorage.defaultName', { stamp })
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(dateLocale(), {
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
      <h2>{{ t('projectStorage.title') }}</h2>
      <p class="hint">{{ t('projectStorage.description') }}</p>

      <div class="field">
        <label>{{ t('projectStorage.saveAsLabel') }}</label>
        <div class="save-row">
          <input
            v-model="nameInput"
            type="text"
            :placeholder="t('projectStorage.namePlaceholder')"
            :disabled="!hasImage"
          />
          <button
            class="btn btn-primary"
            type="button"
            :disabled="!hasImage || !nameInput.trim() || isBusy"
            @click="submitSave"
          >
            {{ t('projectStorage.save') }}
          </button>
        </div>
        <p v-if="!hasImage" class="hint">{{ t('projectStorage.needImageHint') }}</p>
      </div>

      <div class="field">
        <label>{{ t('projectStorage.savedListLabel') }}</label>
        <p v-if="projects.length === 0" class="hint">{{ t('projectStorage.empty') }}</p>
        <ul v-else class="saved-list">
          <li v-for="project in projects" :key="project.id" class="saved-item">
            <div class="saved-meta">
              <strong>{{ project.name }}</strong>
              <span>{{ formatDate(project.updatedAt) }}</span>
            </div>
            <div class="saved-actions">
              <button class="btn btn-ghost" type="button" :disabled="isBusy" @click="emit('load', project.id)">
                {{ t('projectStorage.open') }}
              </button>
              <button
                class="btn btn-ghost"
                type="button"
                :disabled="!hasImage || isBusy"
                :title="t('projectStorage.overwriteTitle')"
                @click="emit('overwrite', project.id)"
              >
                {{ t('projectStorage.overwrite') }}
              </button>
              <button class="btn btn-danger" type="button" :disabled="isBusy" @click="emit('remove', project.id)">
                {{ t('projectStorage.remove') }}
              </button>
            </div>
          </li>
        </ul>
      </div>

      <div class="modal-actions">
        <button class="btn btn-ghost" type="button" @click="emit('close')">
          {{ t('projectStorage.close') }}
        </button>
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
