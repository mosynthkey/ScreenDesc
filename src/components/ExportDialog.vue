<script setup lang="ts">
import { reactive } from 'vue'
import type { ExportFormat, ExportOptions } from '../types/annotation'
import { useI18n } from '../i18n'
import { isDesktopApp } from '../runtime'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  export: [options: ExportOptions]
}>()

const { t, tr } = useI18n()

const form = reactive({
  format: 'png' as ExportFormat,
  includeSectionGuides: false,
  scale: 2,
  filename: t('export.defaultFilename'),
  allVariations: false,
})

function submit(): void {
  emit('export', { ...form })
}
</script>

<template>
  <div v-if="open" class="modal-backdrop">
    <div class="modal">
      <h2>{{ t('export.title') }}</h2>
      <div class="field">
        <label>{{ t('export.format') }}</label>
        <div class="format-buttons">
          <button
            class="btn btn-ghost"
            type="button"
            :class="{ active: form.format === 'png' }"
            @click="form.format = 'png'"
          >
            PNG
          </button>
          <button
            class="btn btn-ghost"
            type="button"
            :class="{ active: form.format === 'svg' }"
            @click="form.format = 'svg'"
          >
            SVG
          </button>
        </div>
      </div>
      <div class="field">
        <label>{{ t('export.filename') }}</label>
        <input v-model="form.filename" type="text" />
      </div>
      <div v-if="form.format === 'png'" class="field">
        <label>{{ t('export.scale') }}</label>
        <select v-model.number="form.scale">
          <option :value="1">1×</option>
          <option :value="2">2×</option>
          <option :value="3">3×</option>
        </select>
      </div>
      <label class="check">
        <input v-model="form.includeSectionGuides" type="checkbox" />
        {{ t('export.includeSectionGuides') }}
      </label>
      <label class="check">
        <input v-model="form.allVariations" type="checkbox" />
        {{ t('export.allVariations') }}
      </label>
      <p v-if="form.allVariations" class="hint">
        {{ t(isDesktopApp ? 'export.allVariationsHint' : 'export.allVariationsHint.web') }}
      </p>
      <div class="modal-actions">
        <button class="btn btn-ghost" type="button" @click="emit('close')">
          {{ t('export.cancel') }}
        </button>
        <button class="btn btn-primary" type="button" @click="submit">
          {{ form.allVariations
            ? t(isDesktopApp ? 'export.selectFolder' : 'export.downloadZip')
            : tr('export.download') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
}

.hint {
  margin: -2px 0 0 24px;
  font-size: 0.78rem;
  line-height: 1.45;
  color: var(--ink-muted);
}

.format-buttons {
  display: flex;
  gap: 8px;
}

.format-buttons .btn {
  flex: 1;
}
</style>
