<script setup lang="ts">
import { useI18n } from '../i18n'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  confirm: []
}>()

const { t } = useI18n()
</script>

<template>
  <div v-if="open" class="modal-backdrop" @click.self="emit('close')">
    <div class="modal replace-detect-modal" role="dialog" aria-modal="true">
      <h2>{{ t('replaceDetect.title') }}</h2>
      <p class="body">{{ t('replaceDetect.body') }}</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" type="button" @click="emit('close')">
          {{ t('replaceDetect.keep') }}
        </button>
        <button class="btn btn-primary" type="button" @click="emit('confirm')">
          {{ t('replaceDetect.run') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.replace-detect-modal {
  width: min(420px, calc(100vw - 32px));
}

.body {
  margin: 0 0 4px;
  color: var(--ink-muted);
  font-size: 0.88rem;
  line-height: 1.55;
}
</style>
