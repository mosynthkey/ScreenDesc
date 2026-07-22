<script setup lang="ts">
import { ref, watch } from 'vue'
import type { CommonSettingsPresetMeta } from '../utils/commonSettings'
import { locale, useI18n } from '../i18n'

const props = defineProps<{
  open: boolean
  presets: CommonSettingsPresetMeta[]
  isBusy: boolean
}>()

const emit = defineEmits<{
  close: []
  save: [name: string]
  overwrite: [id: string]
  apply: [id: string]
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
  return t('commonSettings.defaultName', { stamp })
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
      <h2>{{ t('commonSettings.title') }}</h2>
      <p class="hint">{{ t('commonSettings.description') }}</p>

      <div class="field">
        <label>{{ t('commonSettings.saveAsLabel') }}</label>
        <div class="save-row">
          <input
            v-model="nameInput"
            type="text"
            :placeholder="t('commonSettings.namePlaceholder')"
            :disabled="isBusy"
          />
          <button
            class="btn btn-primary"
            type="button"
            :disabled="!nameInput.trim() || isBusy"
            @click="submitSave"
          >
            {{ t('commonSettings.save') }}
          </button>
        </div>
      </div>

      <div class="field">
        <label>{{ t('commonSettings.savedListLabel') }}</label>
        <p v-if="presets.length === 0" class="hint">{{ t('commonSettings.empty') }}</p>
        <ul v-else class="saved-list">
          <li v-for="preset in presets" :key="preset.id" class="saved-item">
            <div class="saved-meta">
              <strong>{{ preset.name }}</strong>
              <span>{{ formatDate(preset.updatedAt) }}</span>
            </div>
            <div class="saved-actions">
              <button class="btn btn-ghost" type="button" :disabled="isBusy" @click="emit('apply', preset.id)">
                {{ t('commonSettings.apply') }}
              </button>
              <button
                class="btn btn-ghost"
                type="button"
                :disabled="isBusy"
                :title="t('commonSettings.overwriteTitle')"
                @click="emit('overwrite', preset.id)"
              >
                {{ t('commonSettings.overwrite') }}
              </button>
              <button class="btn btn-danger" type="button" :disabled="isBusy" @click="emit('remove', preset.id)">
                {{ t('commonSettings.remove') }}
              </button>
            </div>
          </li>
        </ul>
      </div>

      <div class="modal-actions">
        <button class="btn btn-ghost" type="button" @click="emit('close')">
          {{ t('commonSettings.close') }}
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
