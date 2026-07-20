<script setup lang="ts">
import { reactive } from 'vue'
import type { ExportFormat, ExportOptions } from '../types/annotation'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  export: [options: ExportOptions]
}>()

const form = reactive({
  format: 'png' as ExportFormat,
  includeSectionGuides: false,
  includeOriginal: false,
  scale: 2,
  filename: 'マニュアル注釈',
})

function submit(): void {
  emit('export', { ...form })
}
</script>

<template>
  <div v-if="open" class="modal-backdrop" @click.self="emit('close')">
    <div class="modal">
      <h2>書き出し</h2>
      <div class="field">
        <label>形式</label>
        <select v-model="form.format">
          <option value="png">PNG</option>
          <option value="svg">SVG</option>
          <option value="pdf">PDF</option>
        </select>
      </div>
      <div class="field">
        <label>ファイル名</label>
        <input v-model="form.filename" type="text" />
      </div>
      <div class="field">
        <label>解像度（PNG / PDF）</label>
        <select v-model.number="form.scale">
          <option :value="1">1×</option>
          <option :value="2">2×</option>
          <option :value="3">3×</option>
        </select>
      </div>
      <label class="check">
        <input v-model="form.includeSectionGuides" type="checkbox" />
        セクション枠も含める
      </label>
      <label class="check" style="margin-top: 8px">
        <input v-model="form.includeOriginal" type="checkbox" />
        元の画像(注釈なし)も一緒に書き出す
      </label>
      <p class="hint" style="margin-top: 10px">
        PDF は注釈済みページを画像として埋め込みます。将来はベクトル PDF バックエンドに差し替え可能な設計です。
      </p>
      <div class="modal-actions">
        <button class="btn btn-ghost" type="button" @click="emit('close')">キャンセル</button>
        <button class="btn btn-primary" type="button" @click="submit">ダウンロード</button>
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
