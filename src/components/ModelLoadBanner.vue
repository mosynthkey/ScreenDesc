<script setup lang="ts">
import { computed } from 'vue'
import type { ModelStatus } from '../types/detection'
import { useI18n } from '../i18n'

const props = defineProps<{
  status: ModelStatus
  progress: number
  errorMessage?: string | null
}>()

const emit = defineEmits<{
  retry: []
}>()

const { t } = useI18n()

const visible = computed(() => props.status !== 'ready' && props.status !== 'idle')

const percent = computed(() => Math.round(Math.min(1, Math.max(0, props.progress)) * 100))

const title = computed(() => {
  if (props.status === 'error') return t('status.modelLoadFailed')
  if (props.status === 'downloading') return t('status.modelDownloading', { percent: percent.value })
  return t('status.modelPreparing')
})

const showBar = computed(() => props.status === 'downloading' || props.status === 'loading')
</script>

<template>
  <div
    v-if="visible"
    class="model-load-banner"
    :class="{ error: status === 'error' }"
    role="status"
    aria-live="polite"
  >
    <div class="model-load-copy">
      <p class="model-load-title">{{ title }}</p>
      <p v-if="status === 'error' && errorMessage" class="model-load-detail">{{ errorMessage }}</p>
      <p v-else class="model-load-detail">{{ t('status.modelEditBlocked') }}</p>
    </div>
    <div v-if="showBar" class="model-load-track" aria-hidden="true">
      <div
        class="model-load-fill"
        :class="{ indeterminate: status === 'loading' }"
        :style="status === 'downloading' ? { width: `${percent}%` } : undefined"
      />
    </div>
    <button
      v-if="status === 'error'"
      class="btn btn-primary model-load-retry"
      type="button"
      @click="emit('retry')"
    >
      {{ t('status.modelRetry') }}
    </button>
  </div>
</template>

<style scoped>
.model-load-banner {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 12px 16px 0;
  padding: 14px 16px;
  border: 1px solid var(--line-strong);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: var(--shadow);
}

.model-load-banner.error {
  border-color: rgba(255, 59, 48, 0.35);
  background: rgba(255, 245, 245, 0.96);
}

.model-load-title {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 650;
  color: var(--ink);
}

.model-load-detail {
  margin: 4px 0 0;
  font-size: 0.78rem;
  line-height: 1.45;
  color: var(--ink-muted);
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

.model-load-retry {
  align-self: flex-start;
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
