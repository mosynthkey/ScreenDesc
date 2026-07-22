<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import type { SavedProjectMeta } from '../utils/projectStorage'
import { loadNamedProjectImageBlob } from '../utils/projectStorage'
import { locale, useI18n } from '../i18n'

const props = defineProps<{
  projects: SavedProjectMeta[]
  isBusy: boolean
}>()

const emit = defineEmits<{
  file: [file: File]
  open: [id: string]
  remove: [id: string]
  downloadBundle: []
}>()

const { t } = useI18n()
const isDragging = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)
const thumbUrls = ref<Record<string, string>>({})

function dateLocale(): string {
  return locale.value === 'ja' ? 'ja-JP' : 'en-US'
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

function openFilePicker(): void {
  inputRef.value?.click()
}

function revokeThumbs(urls: Record<string, string>): void {
  for (const url of Object.values(urls)) {
    URL.revokeObjectURL(url)
  }
}

async function refreshThumbs(projects: SavedProjectMeta[]): Promise<void> {
  const previous = thumbUrls.value
  const next: Record<string, string> = {}
  await Promise.all(
    projects.map(async (project) => {
      try {
        const blob = await loadNamedProjectImageBlob(project.id)
        if (blob) next[project.id] = URL.createObjectURL(blob)
      } catch {
        // Skip broken saves; card still shows name/date.
      }
    }),
  )
  thumbUrls.value = next
  revokeThumbs(previous)
}

watch(
  () => props.projects,
  (projects) => {
    void refreshThumbs(projects)
  },
  { immediate: true, deep: true },
)

onBeforeUnmount(() => revokeThumbs(thumbUrls.value))

defineExpose({ openFilePicker })
</script>

<template>
  <div class="home">
    <section
      class="new-card"
      :class="{ 'is-active': isDragging }"
      @dragenter.prevent="isDragging = true"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop="onDrop"
    >
      <div class="new-card-copy">
        <h2>{{ t('home.newTitle') }}</h2>
        <p class="hint">
          {{ t('home.newHint.formats') }}<br />
          {{ t('home.newHint.dnd') }}
        </p>
      </div>
      <button class="btn btn-primary" type="button" :disabled="isBusy" @click="openFilePicker">
        {{ t('home.newButton') }}
      </button>
      <input
        ref="inputRef"
        type="file"
        accept="image/*"
        hidden
        @change="onInputChange"
      />
    </section>

    <section class="gallery">
      <div class="gallery-header">
        <div class="gallery-heading">
          <h2>{{ t('home.galleryTitle') }}</h2>
          <span class="hint">{{ t('home.galleryCount', { count: projects.length }) }}</span>
        </div>
        <button
          class="btn btn-ghost"
          type="button"
          :disabled="projects.length === 0 || isBusy"
          :title="t('home.downloadBundleTitle')"
          @click="emit('downloadBundle')"
        >
          {{ t('home.downloadBundle') }}
        </button>
      </div>
      <p v-if="projects.length === 0" class="hint gallery-empty">{{ t('home.galleryEmpty') }}</p>
      <ul v-else class="gallery-grid">
        <li v-for="project in projects" :key="project.id" class="gallery-item">
          <button
            class="gallery-card"
            type="button"
            :disabled="isBusy"
            @click="emit('open', project.id)"
          >
            <div class="gallery-thumb">
              <img
                v-if="thumbUrls[project.id]"
                :src="thumbUrls[project.id]"
                :alt="project.name"
              />
              <div v-else class="gallery-thumb-fallback" aria-hidden="true" />
            </div>
            <div class="gallery-meta">
              <strong>{{ project.name }}</strong>
              <span>{{ formatDate(project.updatedAt) }}</span>
            </div>
          </button>
          <button
            class="gallery-remove"
            type="button"
            :disabled="isBusy"
            :aria-label="t('home.removeAria')"
            :title="t('projectStorage.remove')"
            @click="emit('remove', project.id)"
          >
            ×
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.home {
  height: 100%;
  overflow: auto;
  padding: 28px 40px 48px;
  background:
    radial-gradient(900px 480px at 50% 0%, rgba(0, 122, 255, 0.08), transparent 60%),
    var(--bg);
}

.new-card {
  max-width: 920px;
  margin: 0 auto 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 22px 24px;
  border-radius: var(--radius-lg);
  background: var(--bg-elevated);
  border: 1px solid rgba(255, 255, 255, 0.65);
  box-shadow: var(--shadow);
  transition:
    border-color var(--spring),
    background var(--spring),
    transform var(--spring);
}

.new-card.is-active {
  border-color: var(--accent);
  background: var(--accent-soft);
  transform: scale(1.01);
}

.new-card-copy {
  text-align: left;
  min-width: 0;
}

.new-card h2 {
  margin: 0 0 4px;
  font-size: 1.05rem;
  font-weight: 700;
}

.gallery {
  max-width: 920px;
  margin: 0 auto;
}

.gallery-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.gallery-heading {
  display: flex;
  align-items: baseline;
  gap: 12px;
  min-width: 0;
}

.gallery-header h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
}

.gallery-empty {
  margin: 0;
  padding: 28px 16px;
  text-align: center;
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius);
  background: rgba(255, 255, 255, 0.45);
}

.gallery-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 14px;
}

.gallery-item {
  position: relative;
}

.gallery-card {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 14px;
  overflow: hidden;
  background: var(--bg-solid);
  box-shadow: var(--shadow-sm);
  text-align: left;
  color: inherit;
}

.gallery-card:hover:not(:disabled) {
  border-color: var(--line-strong);
  box-shadow: var(--shadow);
}

.gallery-card:disabled {
  opacity: 0.6;
  cursor: default;
}

.gallery-thumb {
  aspect-ratio: 16 / 10;
  background: #e8e8ed;
  overflow: hidden;
}

.gallery-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.gallery-thumb-fallback {
  width: 100%;
  height: 100%;
  background:
    linear-gradient(135deg, rgba(0, 122, 255, 0.12), rgba(88, 86, 214, 0.16)),
    #e8e8ed;
}

.gallery-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px 12px;
  min-width: 0;
}

.gallery-meta strong {
  font-size: 0.86rem;
  font-weight: 650;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gallery-meta span {
  font-size: 0.72rem;
  color: var(--ink-muted);
}

.gallery-remove {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: rgba(28, 28, 30, 0.55);
  color: #fff;
  font-size: 1rem;
  line-height: 1;
  opacity: 0;
  transition: opacity var(--spring), background var(--press);
}

.gallery-item:hover .gallery-remove,
.gallery-remove:focus-visible {
  opacity: 1;
}

.gallery-remove:hover:not(:disabled) {
  background: var(--danger);
}

.gallery-remove:disabled {
  opacity: 0;
  cursor: default;
}

@media (max-width: 720px) {
  .home {
    padding: 24px 16px 36px;
  }

  .new-card {
    flex-direction: column;
    align-items: stretch;
    text-align: center;
  }

  .new-card-copy {
    text-align: center;
  }
}
</style>
