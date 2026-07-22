<script setup lang="ts">
import { useI18n } from '../i18n'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  asNewProject: []
  overwrite: []
}>()

const { t } = useI18n()
</script>

<template>
  <div v-if="open" class="modal-backdrop" @click.self="emit('close')">
    <div class="modal crop-confirm-modal" role="dialog" aria-modal="true">
      <h2>{{ t('cropConfirm.title') }}</h2>
      <p class="body">{{ t('cropConfirm.body') }}</p>
      <div class="choice-stack">
        <button class="btn btn-primary choice-btn" type="button" @click="emit('asNewProject')">
          <span class="choice-label">{{ t('cropConfirm.asNewProject') }}</span>
          <span class="choice-hint">{{ t('cropConfirm.asNewProjectHint') }}</span>
        </button>
        <button class="btn choice-btn choice-btn-secondary" type="button" @click="emit('overwrite')">
          <span class="choice-label">{{ t('cropConfirm.overwrite') }}</span>
          <span class="choice-hint">{{ t('cropConfirm.overwriteHint') }}</span>
        </button>
        <button class="btn btn-ghost choice-btn" type="button" @click="emit('close')">
          <span class="choice-label">{{ t('cropConfirm.cancel') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.crop-confirm-modal {
  width: min(440px, calc(100vw - 32px));
}

.body {
  margin: 0 0 16px;
  color: var(--ink-muted);
  font-size: 0.88rem;
  line-height: 1.55;
}

.choice-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.choice-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  margin: 0;
  padding: 12px 14px;
  border-radius: 12px;
  text-align: left;
  line-height: 1.35;
  white-space: normal;
}

.choice-btn-secondary {
  background: rgba(120, 120, 128, 0.12);
  color: var(--ink);
}

.choice-btn-secondary:hover {
  background: rgba(120, 120, 128, 0.18);
}

.choice-label {
  font-size: 0.9rem;
  font-weight: 650;
}

.choice-hint {
  font-size: 0.75rem;
  font-weight: 500;
  opacity: 0.78;
}

.btn-ghost .choice-label {
  font-weight: 590;
}
</style>
