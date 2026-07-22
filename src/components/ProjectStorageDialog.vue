<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { SavedProjectMeta } from '../utils/projectStorage'
import { locale, useI18n } from '../i18n'

const props = defineProps<{
  open: boolean
  hasImage: boolean
  projects: SavedProjectMeta[]
  isBusy: boolean
  activeProjectId?: string | null
  activeProjectName?: string | null
}>()

const emit = defineEmits<{
  close: []
  save: [name: string]
  overwrite: [id: string]
  load: [id: string]
  remove: [id: string]
  downloadBundle: []
}>()

const { t } = useI18n()
const nameInput = ref('')

const currentDisplayName = computed(() => {
  const named = props.activeProjectName?.trim()
  if (named) return named
  return t('header.untitledProject')
})

const otherProjects = computed(() => {
  const activeId = props.activeProjectId
  if (!activeId) return props.projects
  return props.projects.filter((project) => project.id !== activeId)
})

watch(
  () => props.open,
  (open) => {
    if (!open) return
    const current = props.activeProjectName?.trim()
    nameInput.value = current || defaultName()
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
      <p class="autosave-hint">{{ t('projectStorage.autosaveHint') }}</p>

      <div class="field">
        <label>{{ t('projectStorage.currentLabel') }}</label>
        <div v-if="hasImage" class="current-card">
          <div class="current-meta">
            <strong>{{ currentDisplayName }}</strong>
            <span class="current-badge">{{ t('projectStorage.currentBadge') }}</span>
          </div>
          <p class="hint current-hint">
            {{
              activeProjectId
                ? t('projectStorage.currentNamedHint')
                : t('projectStorage.currentUntitledHint')
            }}
          </p>
        </div>
        <p v-else class="hint">{{ t('projectStorage.needImageHint') }}</p>
      </div>

      <div class="field">
        <label>{{ t('projectStorage.savedListLabel') }}</label>
        <p v-if="otherProjects.length === 0" class="hint">
          {{
            projects.length > 0 && activeProjectId
              ? t('projectStorage.emptyOthers')
              : t('projectStorage.empty')
          }}
        </p>
        <ul v-else class="saved-list">
          <li v-for="project in otherProjects" :key="project.id" class="saved-item">
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

      <div class="field save-as-field">
        <label>{{ t('projectStorage.saveAsLabel') }}</label>
        <p class="hint">{{ t('projectStorage.saveAsHint') }}</p>
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
      </div>

      <div class="modal-actions">
        <button
          class="btn btn-ghost"
          type="button"
          :disabled="projects.length === 0 || isBusy"
          :title="t('projectStorage.downloadBundleTitle')"
          @click="emit('downloadBundle')"
        >
          {{ t('projectStorage.downloadBundle') }}
        </button>
        <button class="btn btn-ghost" type="button" @click="emit('close')">
          {{ t('projectStorage.close') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.autosave-hint {
  margin: -4px 0 14px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--ink-secondary);
  font-size: 0.8rem;
  line-height: 1.45;
}

.current-card {
  padding: 12px;
  border-radius: 10px;
  border: 1px solid rgba(0, 122, 255, 0.28);
  background: rgba(0, 122, 255, 0.06);
}

.current-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.current-meta strong {
  min-width: 0;
  font-size: 0.95rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.current-badge {
  flex: 0 0 auto;
  padding: 2px 8px;
  border-radius: 980px;
  background: var(--accent);
  color: #fff;
  font-size: 0.68rem;
  font-weight: 650;
}

.current-hint {
  margin: 6px 0 0;
}

.save-as-field {
  margin-top: 4px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}

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
  max-height: 220px;
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

.modal-actions {
  justify-content: space-between;
}
</style>
