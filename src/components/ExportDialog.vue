<script setup lang="ts">
import { reactive } from 'vue'
import type { ExportFormat, ExportOptions } from '../types/annotation'
import { useI18n } from '../i18n'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  export: [options: ExportOptions]
}>()

const { t } = useI18n()

const form = reactive({
  format: 'png' as ExportFormat,
  includeSectionGuides: false,
  includeOriginal: false,
  scale: 2,
  filename: t('export.defaultFilename'),
})

function submit(): void {
  emit('export', { ...form })
}
</script>

<template>
  <div v-if="open" class="modal-backdrop" @click.self="emit('close')">
    <div class="modal">
      <h2>{{ t('export.title') }}</h2>
      <div class="field">
        <label>{{ t('export.format') }}</label>
        <select v-model="form.format">
          <option value="png">PNG</option>
          <option value="svg">SVG</option>
          <option value="pdf">PDF</option>
        </select>
      </div>
      <div class="field">
        <label>{{ t('export.filename') }}</label>
        <input v-model="form.filename" type="text" />
      </div>
      <div class="field">
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
      <label class="check" style="margin-top: 8px">
        <input v-model="form.includeOriginal" type="checkbox" />
        {{ t('export.includeOriginal') }}
      </label>
      <p class="hint" style="margin-top: 10px">
        {{ t('export.pdfHint') }}
      </p>
      <div class="modal-actions">
        <button class="btn btn-ghost" type="button" @click="emit('close')">
          {{ t('export.cancel') }}
        </button>
        <button class="btn btn-primary" type="button" @click="submit">
          {{ t('export.download') }}
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
</style>
