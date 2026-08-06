<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { BundleImportCandidate } from '../composables/projectFileIO'
import { useI18n } from '../i18n'

const props = defineProps<{
  open: boolean
  candidates: BundleImportCandidate[]
  isBusy: boolean
}>()

const emit = defineEmits<{
  close: []
  import: [indexes: number[]]
}>()

const { t } = useI18n()
const selectedIndexes = ref<Set<number>>(new Set())
const availableCandidates = computed(() => props.candidates.filter((candidate) => !candidate.duplicate))
const selectedCount = computed(() => selectedIndexes.value.size)
const allSelected = computed(
  () =>
    availableCandidates.value.length > 0 &&
    availableCandidates.value.every((candidate) => selectedIndexes.value.has(candidate.index)),
)

watch(
  () => [props.open, props.candidates] as const,
  ([open]) => {
    if (!open) return
    selectedIndexes.value = new Set(
      props.candidates.filter((candidate) => !candidate.duplicate).map((candidate) => candidate.index),
    )
  },
  { immediate: true },
)

function toggleCandidate(index: number, checked: boolean): void {
  const next = new Set(selectedIndexes.value)
  if (checked) next.add(index)
  else next.delete(index)
  selectedIndexes.value = next
}

function toggleAll(): void {
  selectedIndexes.value = allSelected.value
    ? new Set()
    : new Set(availableCandidates.value.map((candidate) => candidate.index))
}

function submit(): void {
  emit('import', [...selectedIndexes.value].sort((left, right) => left - right))
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop">
      <div class="modal bundle-import-modal" role="dialog" aria-modal="true" :aria-label="t('bundleImport.title')">
        <div class="bundle-import-heading">
          <div>
            <h2>{{ t('bundleImport.title') }}</h2>
            <p>{{ t('bundleImport.description') }}</p>
          </div>
          <button
            class="btn btn-ghost"
            type="button"
            :disabled="availableCandidates.length === 0 || isBusy"
            @click="toggleAll"
          >
            {{ allSelected ? t('bundleImport.clearAll') : t('bundleImport.selectAll') }}
          </button>
        </div>

        <ul class="bundle-import-list">
          <li v-for="candidate in candidates" :key="candidate.index">
            <label :class="{ duplicate: candidate.duplicate }">
              <input
                type="checkbox"
                :checked="selectedIndexes.has(candidate.index)"
                :disabled="candidate.duplicate || isBusy"
                @change="toggleCandidate(candidate.index, ($event.target as HTMLInputElement).checked)"
              />
              <span class="bundle-import-copy">
                <strong>{{ candidate.name }}</strong>
                <small v-if="candidate.folderPath">{{ candidate.folderPath }}</small>
                <small v-else>{{ t('folder.root') }}</small>
              </span>
              <span v-if="candidate.duplicate" class="bundle-import-duplicate">
                {{ t('bundleImport.alreadyExists') }}
              </span>
            </label>
          </li>
        </ul>

        <p v-if="availableCandidates.length === 0" class="bundle-import-empty">
          {{ t('bundleImport.noImportableProjects') }}
        </p>

        <div class="modal-actions">
          <button class="btn btn-ghost" type="button" :disabled="isBusy" @click="emit('close')">
            {{ t('confirm.cancel') }}
          </button>
          <button class="btn btn-primary" type="button" :disabled="selectedCount === 0 || isBusy" @click="submit">
            {{ t('bundleImport.importSelected', { count: selectedCount }) }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.bundle-import-modal {
  width: min(620px, calc(100vw - 32px));
  max-height: min(760px, calc(100vh - 48px));
  display: flex;
  flex-direction: column;
}

.bundle-import-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.bundle-import-heading h2 {
  margin-bottom: 5px;
}

.bundle-import-heading p {
  margin: 0;
  color: var(--ink-secondary);
  font-size: 0.84rem;
}

.bundle-import-list {
  min-height: 0;
  margin: 18px 0 0;
  padding: 0;
  overflow: auto;
  list-style: none;
  border: 1px solid var(--line);
  border-radius: 12px;
}

.bundle-import-list li + li {
  border-top: 1px solid var(--line);
}

.bundle-import-list label {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 58px;
  padding: 9px 12px;
}

.bundle-import-list label.duplicate {
  background: rgba(120, 120, 128, 0.07);
  color: var(--ink-muted);
}

.bundle-import-copy {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.bundle-import-copy strong,
.bundle-import-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bundle-import-copy strong {
  font-size: 0.88rem;
}

.bundle-import-copy small {
  color: var(--ink-muted);
  font-size: 0.72rem;
}

.bundle-import-duplicate {
  flex: 0 0 auto;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(120, 120, 128, 0.14);
  font-size: 0.68rem;
  font-weight: 650;
}

.bundle-import-empty {
  margin: 14px 0 0;
  color: var(--ink-secondary);
  font-size: 0.84rem;
}
</style>
