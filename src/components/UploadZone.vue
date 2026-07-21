<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from '../i18n'

const emit = defineEmits<{
  file: [file: File]
}>()

const { t } = useI18n()
const isDragging = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

function acceptFile(file: File | undefined): void {
  if (!file || !file.type.startsWith('image/')) return
  emit('file', file)
}

function onDrop(event: DragEvent): void {
  event.preventDefault()
  isDragging.value = false
  acceptFile(event.dataTransfer?.files?.[0])
}

function onInputChange(event: Event): void {
  const input = event.target as HTMLInputElement
  acceptFile(input.files?.[0])
  input.value = ''
}
</script>

<template>
  <div class="upload-hero">
    <div class="upload-card">
      <div class="hero-mark" aria-hidden="true" />
      <h1>{{ t('upload.title') }}</h1>
      <p>{{ t('upload.description') }}</p>
      <div
        class="upload-drop"
        :class="{ 'is-active': isDragging }"
        @dragenter.prevent="isDragging = true"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop="onDrop"
      >
        <p class="hint upload-hint" style="margin-bottom: 18px">
          {{ t('upload.hint.formats') }}<br />
          {{ t('upload.hint.dnd') }}<br />
          {{ t('upload.hint.scanOnLoad') }}
        </p>
        <button class="btn btn-primary" type="button" @click="inputRef?.click()">
          {{ t('upload.button.open') }}
        </button>
        <input
          ref="inputRef"
          type="file"
          accept="image/*"
          hidden
          @change="onInputChange"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.hero-mark {
  width: 56px;
  height: 56px;
  margin: 0 auto 18px;
  border-radius: 14px;
  background: linear-gradient(145deg, #5ac8fa 0%, #007aff 55%, #5856d6 100%);
  box-shadow:
    0 10px 28px rgba(0, 122, 255, 0.28),
    inset 0 0.5px 0 rgba(255, 255, 255, 0.4);
}
</style>
