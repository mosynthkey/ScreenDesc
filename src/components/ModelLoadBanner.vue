<script setup lang="ts">
import { computed } from 'vue'
import type { ModelStatus } from '../types/detection'
import { useI18n } from '../i18n'

const props = defineProps<{
  /** When false, load continues in the background without blocking the UI. */
  blocking?: boolean
  status: ModelStatus
  progress: number
  errorMessage?: string | null
}>()

const emit = defineEmits<{
  retry: []
}>()

const { t } = useI18n()

const visible = computed(
  () => Boolean(props.blocking) && props.status !== 'ready',
)

const percent = computed(() => Math.round(Math.min(1, Math.max(0, props.progress)) * 100))

const title = computed(() => {
  if (props.status === 'error') return t('status.modelLoadFailed')
  if (props.status === 'downloading') return t('status.modelDownloading', { percent: percent.value })
  return t('status.modelPreparing')
})

const showBar = computed(() => props.status === 'downloading' || props.status === 'loading')
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="modal-backdrop model-load-backdrop"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
    >
      <div class="modal model-load-modal" :class="{ error: status === 'error' }">
        <h2>{{ title }}</h2>
        <p v-if="status === 'error' && errorMessage" class="body">{{ errorMessage }}</p>
        <p v-else class="body">{{ t('status.modelEditBlocked') }}</p>

        <div v-if="showBar" class="model-load-track" aria-hidden="true">
          <div
            class="model-load-fill"
            :class="{ indeterminate: status === 'loading' }"
            :style="status === 'downloading' ? { width: `${percent}%` } : undefined"
          />
        </div>

        <div v-if="status === 'error'" class="modal-actions">
          <button class="btn btn-primary" type="button" @click="emit('retry')">
            {{ t('status.modelRetry') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.model-load-backdrop {
  z-index: 55;
  /* Loading gate: do not dismiss by clicking the scrim. */
  pointer-events: auto;
}

.model-load-modal {
  width: min(400px, calc(100vw - 32px));
}

.model-load-modal.error {
  border-color: rgba(255, 59, 48, 0.28);
}

.body {
  margin: 0 0 14px;
  color: var(--ink-muted);
  font-size: 0.88rem;
  line-height: 1.55;
}

.model-load-track {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(120, 120, 128, 0.16);
}

.model-load-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
  transition: width 120ms linear;
}

.model-load-fill.indeterminate {
  width: 40%;
  animation: model-load-indeterminate 1.1s ease-in-out infinite;
}

.modal-actions {
  margin-top: 16px;
}

.modal-actions .btn {
  border-radius: 10px;
}

@keyframes model-load-indeterminate {
  0% {
    transform: translateX(-120%);
  }
  100% {
    transform: translateX(280%);
  }
}
</style>
