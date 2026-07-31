<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { SavedProjectMeta } from '../utils/projectStorage'
import { loadNamedProjectImageBlob, loadNamedProjectThumbnail } from '../utils/projectStorage'
import { isDesktopApp } from '../runtime'
import { locale, useI18n } from '../i18n'
import { InfoIcon } from '@lucide/vue'

const props = defineProps<{
  projects: SavedProjectMeta[]
  activeProjectId?: string | null
  isBusy: boolean
}>()

const emit = defineEmits<{
  file: [file: File]
  open: [id: string]
  remove: [id: string]
  downloadBundle: []
  reveal: [id: string]
}>()

const { t, tr } = useI18n()
const isDragging = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)
const thumbUrls = ref<Record<string, string>>({})
const contextMenu = ref<{ projectId: string; x: number; y: number } | null>(null)
const DEV_NOTICE_ISSUES_URL = 'https://github.com/mosynthkey/ScreenDesc/issues'

function closeContextMenu(): void {
  contextMenu.value = null
}

function onProjectContextMenu(projectId: string, event: MouseEvent): void {
  event.preventDefault()
  event.stopPropagation()
  contextMenu.value = { projectId, x: event.clientX, y: event.clientY }
}

function onRevealFromMenu(): void {
  const projectId = contextMenu.value?.projectId
  closeContextMenu()
  if (projectId) emit('reveal', projectId)
}

function onWindowPointerDown(event: PointerEvent): void {
  if (event.button !== 0) return
  const target = event.target
  if (!(target instanceof Element)) {
    closeContextMenu()
    return
  }
  if (target.closest('.files-context-menu')) return
  closeContextMenu()
}

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
  dragDepth = 0
  isDragging.value = false
  acceptFile(event.dataTransfer?.files?.[0])
}

// Whole-page drop target: dragenter/dragleave fire on every child boundary
// crossed, so a depth counter (rather than a plain boolean) is needed to
// avoid the highlight flickering off while still dragging over a child.
let dragDepth = 0

function onDragEnter(event: DragEvent): void {
  event.preventDefault()
  dragDepth += 1
  isDragging.value = true
}

function onDragOver(event: DragEvent): void {
  event.preventDefault()
}

function onDragLeave(event: DragEvent): void {
  event.preventDefault()
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) isDragging.value = false
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
        // Prefer the annotated thumbnail; fall back to the raw screenshot for
        // saves made before thumbnails existed.
        const blob =
          (await loadNamedProjectThumbnail(project.id)) ??
          (await loadNamedProjectImageBlob(project.id))
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

onMounted(() => {
  window.addEventListener('pointerdown', onWindowPointerDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', onWindowPointerDown)
  revokeThumbs(thumbUrls.value)
})

defineExpose({ openFilePicker })
</script>

<template>
  <div
    class="home"
    @dragenter="onDragEnter"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >

    <section
      class="new-card"
      :class="{ 'is-active': isDragging }"
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

    <section class="files">
      <div class="files-header">
        <div class="files-heading">
          <h2>{{ t('home.filesTitle') }}</h2>
          <span class="hint">{{ t('home.filesCount', { count: projects.length }) }}</span>
        </div>
        <button
          class="btn btn-ghost"
          type="button"
          :disabled="projects.length === 0 || isBusy"
          :title="tr('home.downloadBundleTitle')"
          @click="emit('downloadBundle')"
        >
          {{ tr('home.downloadBundle') }}
        </button>
      </div>
      <p v-if="projects.length === 0" class="hint files-empty">{{ t('home.filesEmpty') }}</p>
      <ul v-else class="files-grid">
        <li
          v-for="project in projects"
          :key="project.id"
          class="files-item"
          :data-project-id="project.id"
          @contextmenu="onProjectContextMenu(project.id, $event)"
        >
          <button
            class="files-card"
            type="button"
            :class="{ 'is-editing': project.id === activeProjectId }"
            :disabled="isBusy"
            :aria-current="project.id === activeProjectId ? 'true' : undefined"
            @click="emit('open', project.id)"
          >
            <div class="files-thumb">
              <img
                v-if="thumbUrls[project.id]"
                :src="thumbUrls[project.id]"
                :alt="project.name"
              />
              <div v-else class="files-thumb-fallback" aria-hidden="true" />
              <span v-if="project.id === activeProjectId" class="files-editing-badge">
                {{ t('home.editingBadge') }}
              </span>
            </div>
            <div class="files-meta">
              <strong>{{ project.name }}</strong>
              <span>{{ formatDate(project.updatedAt) }}</span>
            </div>
          </button>
          <button
            class="files-remove"
            type="button"
            :disabled="isBusy"
            :aria-label="t('home.removeAria')"
            :title="t('projectStorage.remove')"
            @click.stop="emit('remove', project.id)"
          >
            ×
          </button>
        </li>
      </ul>
    </section>

    <div
      v-if="contextMenu"
      class="files-context-menu"
      role="menu"
      :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
    >
      <button
        class="files-context-item"
        type="button"
        role="menuitem"
        :disabled="isBusy"
        :title="t('home.openLocationTitle')"
        @click="onRevealFromMenu"
      >
        {{ t('home.openLocation') }}
      </button>
    </div>

    <div
      v-if="!isDesktopApp"
      class="dev-notice"
      role="note"
      :aria-label="t('home.devNotice.aria')"
    >
      <InfoIcon class="dev-notice-icon" :size="20" :stroke-width="1.8" aria-hidden="true" />
      <div class="dev-notice-lines">
        <p class="dev-notice-text">
          {{ t('home.devNotice.body') }}
          <a :href="DEV_NOTICE_ISSUES_URL" target="_blank" rel="noopener noreferrer">
            {{ t('home.devNotice.issueLink') }}
          </a>
        </p>
        <p class="dev-notice-text">
          {{ t('storage.notice.before') }}<br
          /><button
            class="storage-notice-link"
            type="button"
            :disabled="projects.length === 0 || isBusy"
            :title="t('home.downloadBundleTitle')"
            @click="emit('downloadBundle')"
          >
            {{ t('storage.notice.link') }}
          </button
          >{{ t('storage.notice.after') }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home {
  height: 100%;
  overflow: auto;
  padding: 28px 40px 28px;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(900px 480px at 50% 0%, rgba(0, 122, 255, 0.08), transparent 60%),
    var(--bg);
}

.home:has(> .dev-notice) {
  padding-bottom: 96px;
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

.files {
  max-width: 920px;
  width: 100%;
  margin: 0 auto;
  flex: 1 1 auto;
}

.files-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.files-heading {
  display: flex;
  align-items: baseline;
  gap: 12px;
  min-width: 0;
}

.files-header h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
}

.storage-notice-link {
  display: inline;
  padding: 0;
  border: none;
  background: none;
  color: var(--accent-strong);
  font: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.storage-notice-link:hover:not(:disabled) {
  color: var(--accent);
}

.storage-notice-link:disabled {
  opacity: 0.45;
  cursor: default;
  text-decoration: none;
}

.dev-notice {
  position: fixed;
  left: 72px;
  right: 0;
  bottom: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px 20px;
  border-top: 1px solid var(--line);
  background: var(--bg-elevated);
  box-shadow: var(--shadow-lg);
}

.dev-notice-icon {
  flex: 0 0 auto;
  color: var(--accent-strong);
}

.dev-notice-lines {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 920px;
}

.dev-notice-lines .dev-notice-text + .dev-notice-text {
  padding-top: 6px;
  border-top: 1px solid var(--line);
}

.dev-notice-text {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.45;
  color: var(--ink);
  text-align: center;
}

.dev-notice-text a {
  color: var(--accent-strong);
  text-decoration: underline;
  text-underline-offset: 2px;
  white-space: nowrap;
}

.dev-notice-text a:hover {
  color: var(--accent);
}

.files-empty {
  margin: 0;
  padding: 28px 16px;
  text-align: center;
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius);
  background: var(--bg-panel);
}

.files-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 14px;
}

.files-item {
  position: relative;
}

.files-card {
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

.files-card:hover:not(:disabled) {
  border-color: var(--line-strong);
  box-shadow: var(--shadow);
}

.files-card.is-editing {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent), var(--shadow-sm);
}

.files-card.is-editing:hover:not(:disabled) {
  border-color: var(--accent-strong);
  box-shadow: 0 0 0 1px var(--accent-strong), var(--shadow);
}

.files-card:disabled {
  opacity: 0.6;
  cursor: default;
}

.files-thumb {
  position: relative;
  aspect-ratio: 16 / 10;
  background: #e8e8ed;
  overflow: hidden;
}

.files-editing-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1.3;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.files-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.files-thumb-fallback {
  width: 100%;
  height: 100%;
  background:
    linear-gradient(135deg, rgba(0, 122, 255, 0.12), rgba(88, 86, 214, 0.16)),
    #e8e8ed;
}

.files-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px 12px;
  min-width: 0;
}

.files-meta strong {
  font-size: 0.86rem;
  font-weight: 650;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.files-meta span {
  font-size: 0.72rem;
  color: var(--ink-muted);
}

.files-remove {
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

.files-item:hover .files-remove,
.files-remove:focus-visible {
  opacity: 1;
}

.files-remove:hover:not(:disabled) {
  background: var(--danger);
}

.files-remove:disabled {
  opacity: 0;
  cursor: default;
}

.files-context-menu {
  position: fixed;
  z-index: 80;
  min-width: 180px;
  padding: 4px;
  border-radius: 10px;
  background: var(--bg-elevated);
  border: 1px solid var(--line-strong);
  box-shadow: var(--shadow);
}

.files-context-item {
  display: block;
  width: 100%;
  border: none;
  border-radius: 8px;
  padding: 8px 10px;
  background: transparent;
  color: var(--ink);
  font-size: 0.85rem;
  font-weight: 550;
  text-align: left;
  cursor: pointer;
}

.files-context-item:hover:not(:disabled) {
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.files-context-item:disabled {
  opacity: 0.45;
  cursor: default;
}

@media (max-width: 720px) {
  .home {
    padding: 24px 16px 24px;
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
