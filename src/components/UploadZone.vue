<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ProjectFolder, SavedProjectMeta } from '../utils/projectStorage'
import { loadNamedProjectImageBlob, loadNamedProjectThumbnail } from '../utils/projectStorage'
import { isDesktopApp } from '../runtime'
import { locale, useI18n } from '../i18n'
import { FolderIcon, FolderPlusIcon, InfoIcon } from '@lucide/vue'

const props = defineProps<{
  projects: SavedProjectMeta[]
  folders: ProjectFolder[]
  currentFolderId: string | null
  activeProjectId?: string | null
  isBusy: boolean
}>()

const emit = defineEmits<{
  file: [file: File]
  importProject: [file: File]
  open: [id: string]
  remove: [id: string]
  downloadBundle: []
  reveal: [id: string]
  navigateFolder: [id: string | null]
  createFolder: [name: string, color: string, parentId: string | null]
  renameFolder: [id: string, name: string]
  recolorFolder: [id: string, color: string]
  removeFolder: [id: string, deleteContents: boolean]
  moveProject: [id: string, folderId: string | null]
  moveFolder: [id: string, parentId: string | null]
}>()

const { t, tr } = useI18n()
const isDragging = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)
const thumbUrls = ref<Record<string, string>>({})
const contextMenu = ref<
  | { kind: 'project'; id: string; x: number; y: number }
  | { kind: 'folder'; id: string; x: number; y: number }
  | null
>(null)
const DEV_NOTICE_ISSUES_URL = 'https://github.com/mosynthkey/ScreenDesc/issues'
const PROJECT_DRAG_TYPE = 'application/x-screendesc-project'
const FOLDER_DRAG_TYPE = 'application/x-screendesc-folder'
const FOLDER_COLORS = ['#7aa7ff', '#8bd3c7', '#a8d672', '#ffd166', '#f5a3b7', '#c3a6ff', '#ffab76', '#9ab6c9']
const folderEditor = ref<{
  mode: 'create' | 'rename'
  id: string | null
  name: string
  color: string
  parentId: string | null
} | null>(null)
const folderPendingDelete = ref<string | null>(null)

const currentFolders = computed(() =>
  props.folders
    .filter((folder) => folder.parentId === props.currentFolderId)
    .sort((left, right) => left.name.localeCompare(right.name)),
)
const currentProjects = computed(() =>
  props.projects.filter((project) => (project.folderId ?? null) === props.currentFolderId),
)
const breadcrumbs = computed(() => {
  const byId = new Map(props.folders.map((folder) => [folder.id, folder]))
  const path: ProjectFolder[] = []
  let folderId = props.currentFolderId
  while (folderId) {
    const folder = byId.get(folderId)
    if (!folder) break
    path.unshift(folder)
    folderId = folder.parentId
  }
  return path
})

function closeContextMenu(): void {
  contextMenu.value = null
}

function onProjectContextMenu(projectId: string, event: MouseEvent): void {
  event.preventDefault()
  event.stopPropagation()
  contextMenu.value = { kind: 'project', id: projectId, x: event.clientX, y: event.clientY }
}

function onFolderContextMenu(folderId: string, event: MouseEvent): void {
  event.preventDefault()
  event.stopPropagation()
  contextMenu.value = { kind: 'folder', id: folderId, x: event.clientX, y: event.clientY }
}

function onRevealFromMenu(): void {
  const projectId = contextMenu.value?.kind === 'project' ? contextMenu.value.id : null
  closeContextMenu()
  if (projectId) emit('reveal', projectId)
}

function createFolder(): void {
  folderEditor.value = {
    mode: 'create',
    id: null,
    name: t('folder.defaultName'),
    color: FOLDER_COLORS[0],
    parentId: props.currentFolderId,
  }
}

function renameFolderFromMenu(): void {
  if (contextMenu.value?.kind !== 'folder') return
  const folder = props.folders.find((item) => item.id === contextMenu.value?.id)
  if (!folder) return
  closeContextMenu()
  folderEditor.value = {
    mode: 'rename',
    id: folder.id,
    name: folder.name,
    color: folder.color,
    parentId: folder.parentId,
  }
}

function submitFolderEditor(): void {
  const editor = folderEditor.value
  const name = editor?.name.trim()
  if (!editor || !name) return
  if (editor.mode === 'create') emit('createFolder', name, editor.color, editor.parentId)
  else if (editor.id) {
    emit('renameFolder', editor.id, name)
    emit('recolorFolder', editor.id, editor.color)
  }
  folderEditor.value = null
}

function recolorFolderFromMenu(color: string): void {
  if (contextMenu.value?.kind !== 'folder') return
  const id = contextMenu.value.id
  closeContextMenu()
  emit('recolorFolder', id, color)
}

function removeFolderFromMenu(): void {
  if (contextMenu.value?.kind !== 'folder') return
  folderPendingDelete.value = contextMenu.value.id
  closeContextMenu()
}

function confirmFolderDelete(deleteContents: boolean): void {
  const id = folderPendingDelete.value
  folderPendingDelete.value = null
  if (id) emit('removeFolder', id, deleteContents)
}

function startProjectDrag(projectId: string, event: DragEvent): void {
  event.dataTransfer?.setData(PROJECT_DRAG_TYPE, projectId)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function startFolderDrag(folderId: string, event: DragEvent): void {
  event.dataTransfer?.setData(FOLDER_DRAG_TYPE, folderId)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function hasInternalDrag(event: DragEvent): boolean {
  const types = Array.from(event.dataTransfer?.types ?? [])
  return types.includes(PROJECT_DRAG_TYPE) || types.includes(FOLDER_DRAG_TYPE)
}

function dropIntoFolder(folderId: string | null, event: DragEvent): void {
  if (!hasInternalDrag(event)) return
  event.preventDefault()
  event.stopPropagation()
  const projectId = event.dataTransfer?.getData(PROJECT_DRAG_TYPE)
  if (projectId) {
    emit('moveProject', projectId, folderId)
    return
  }
  const movedFolderId = event.dataTransfer?.getData(FOLDER_DRAG_TYPE)
  if (movedFolderId && movedFolderId !== folderId) emit('moveFolder', movedFolderId, folderId)
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
  if (!file) return
  if (file.type.startsWith('image/')) {
    emit('file', file)
    return
  }
  const name = file.name.toLowerCase()
  if (
    name.endsWith('.screendesc') ||
    name.endsWith('.screendesc.json') ||
    name.endsWith('.screendesc-bundle.json') ||
    name.endsWith('.json')
  ) {
    emit('importProject', file)
  }
}

function onDrop(event: DragEvent): void {
  event.preventDefault()
  dragDepth = 0
  isDragging.value = false
  if (!hasInternalDrag(event)) acceptFile(event.dataTransfer?.files?.[0])
}

// Whole-page drop target: dragenter/dragleave fire on every child boundary
// crossed, so a depth counter (rather than a plain boolean) is needed to
// avoid the highlight flickering off while still dragging over a child.
let dragDepth = 0

function onDragEnter(event: DragEvent): void {
  event.preventDefault()
  if (hasInternalDrag(event)) return
  dragDepth += 1
  isDragging.value = true
}

function onDragOver(event: DragEvent): void {
  event.preventDefault()
}

function onDragLeave(event: DragEvent): void {
  event.preventDefault()
  if (hasInternalDrag(event)) return
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
    :class="{ 'is-dragging': isDragging }"
    @dragenter="onDragEnter"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >

    <input
      ref="inputRef"
      type="file"
      accept="image/*"
      hidden
      @change="onInputChange"
    />

    <section class="files">
      <div class="files-header">
        <div class="files-heading">
          <h2>{{ t('home.filesTitle') }}</h2>
          <span class="hint">{{ t('home.filesCount', { count: projects.length }) }}</span>
        </div>
        <div class="files-header-actions">
          <button class="btn btn-ghost" type="button" :disabled="isBusy" @click="createFolder">
            <FolderPlusIcon :size="16" :stroke-width="1.8" aria-hidden="true" />
            {{ t('folder.new') }}
          </button>
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
      </div>
      <nav class="folder-breadcrumbs" :aria-label="t('folder.breadcrumbAria')">
        <button
          type="button"
          :class="{ active: currentFolderId === null }"
          @click="emit('navigateFolder', null)"
          @dragover.prevent
          @drop="dropIntoFolder(null, $event)"
        >
          {{ t('folder.root') }}
        </button>
        <template v-for="folder in breadcrumbs" :key="folder.id">
          <span aria-hidden="true">/</span>
          <button
            type="button"
            :class="{ active: folder.id === currentFolderId }"
            @click="emit('navigateFolder', folder.id)"
            @dragover.prevent
            @drop="dropIntoFolder(folder.id, $event)"
          >
            {{ folder.name }}
          </button>
        </template>
      </nav>
      <p
        v-if="currentFolders.length === 0 && currentProjects.length === 0"
        class="hint files-empty"
        @dragover.prevent
        @drop="dropIntoFolder(currentFolderId, $event)"
      >
        {{ projects.length === 0 && folders.length === 0 ? t('home.filesEmpty') : t('folder.empty') }}
      </p>
      <ul v-else class="files-grid">
        <li
          v-for="folder in currentFolders"
          :key="folder.id"
          class="files-item folder-item"
          draggable="true"
          @dragstart="startFolderDrag(folder.id, $event)"
          @dragover.prevent
          @drop="dropIntoFolder(folder.id, $event)"
          @contextmenu="onFolderContextMenu(folder.id, $event)"
        >
          <button
            class="files-card folder-card"
            type="button"
            :disabled="isBusy"
            @click="emit('navigateFolder', folder.id)"
          >
            <div class="files-thumb folder-thumb">
              <FolderIcon
                class="folder-card-icon"
                :style="{ color: folder.color }"
                :size="54"
                :stroke-width="1.5"
                aria-hidden="true"
              />
            </div>
            <div class="files-meta">
              <strong>{{ folder.name }}</strong>
              <span>{{ formatDate(folder.updatedAt) }}</span>
            </div>
          </button>
        </li>
        <li
          v-for="project in currentProjects"
          :key="project.id"
          class="files-item"
          :data-project-id="project.id"
          draggable="true"
          @dragstart="startProjectDrag(project.id, $event)"
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
            :title="t('project.remove')"
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
        v-if="contextMenu.kind === 'project'"
        class="files-context-item"
        type="button"
        role="menuitem"
        :disabled="isBusy"
        :title="t('home.openLocationTitle')"
        @click="onRevealFromMenu"
      >
        {{ t('home.openLocation') }}
      </button>
      <template v-else>
        <button class="files-context-item" type="button" @click="renameFolderFromMenu">
          {{ t('folder.rename') }}
        </button>
        <div class="folder-color-options" :aria-label="t('folder.color')">
          <button
            v-for="color in FOLDER_COLORS"
            :key="color"
            class="folder-color-option"
            type="button"
            :style="{ backgroundColor: color }"
            :aria-label="t('folder.color')"
            @click="recolorFolderFromMenu(color)"
          />
        </div>
        <button class="files-context-item danger" type="button" @click="removeFolderFromMenu">
          {{ t('folder.delete') }}
        </button>
      </template>
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

  <Teleport to="body">
    <div v-if="folderEditor" class="modal-backdrop">
      <form class="modal folder-editor-modal" @submit.prevent="submitFolderEditor">
        <h2>{{ folderEditor.mode === 'create' ? t('folder.new') : t('folder.rename') }}</h2>
        <label class="folder-editor-label">
          <span>{{ t('folder.namePrompt') }}</span>
          <input v-model="folderEditor.name" type="text" maxlength="80" autofocus />
        </label>
        <fieldset class="folder-editor-colors">
          <legend>{{ t('folder.color') }}</legend>
          <button
            v-for="color in FOLDER_COLORS"
            :key="color"
            class="folder-editor-color"
            :class="{ selected: folderEditor.color === color }"
            type="button"
            :style="{ backgroundColor: color }"
            :aria-label="t('folder.color')"
            :aria-pressed="folderEditor.color === color"
            @click="folderEditor.color = color"
          />
        </fieldset>
        <div class="modal-actions">
          <button class="btn btn-ghost" type="button" @click="folderEditor = null">
            {{ t('confirm.cancel') }}
          </button>
          <button class="btn btn-primary" type="submit" :disabled="!folderEditor.name.trim()">
            {{ folderEditor.mode === 'create' ? t('folder.create') : t('folder.save') }}
          </button>
        </div>
      </form>
    </div>

    <div v-if="folderPendingDelete" class="modal-backdrop">
      <div class="modal folder-delete-modal" role="dialog" aria-modal="true">
        <h2>{{ t('folder.delete') }}</h2>
        <p>{{ t('folder.deleteChoice') }}</p>
        <div class="folder-delete-actions">
          <button class="btn btn-danger" type="button" @click="confirmFolderDelete(true)">
            {{ t('folder.deleteWithContents') }}
          </button>
          <button class="btn btn-ghost" type="button" @click="confirmFolderDelete(false)">
            {{ t('folder.moveContentsToRoot') }}
          </button>
          <button class="btn btn-ghost" type="button" @click="folderPendingDelete = null">
            {{ t('confirm.cancel') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.home {
  position: relative;
  height: 100%;
  overflow: auto;
  padding: 28px 40px 28px;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(900px 480px at 50% 0%, rgba(0, 122, 255, 0.08), transparent 60%),
    var(--bg);
}

.home.is-dragging::after {
  content: '';
  position: fixed;
  inset: 14px 14px 14px 86px;
  z-index: 60;
  pointer-events: none;
  border: 3px dashed var(--accent);
  border-radius: 18px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.home:has(> .dev-notice) {
  padding-bottom: 96px;
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

.files-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.files-header-actions .btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
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

.folder-breadcrumbs {
  display: flex;
  align-items: center;
  gap: 5px;
  min-height: 32px;
  margin: -4px 0 14px;
  overflow-x: auto;
  color: var(--ink-muted);
}

.folder-breadcrumbs button {
  flex: 0 0 auto;
  padding: 4px 7px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--ink-secondary);
  font-size: 0.78rem;
}

.folder-breadcrumbs button:hover,
.folder-breadcrumbs button.active {
  background: var(--accent-soft);
  color: var(--accent-strong);
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

.folder-card {
  height: 100%;
}

.folder-thumb {
  display: grid;
  place-items: center;
  background:
    linear-gradient(145deg, color-mix(in srgb, currentColor 8%, transparent), transparent 65%),
    var(--bg-panel);
}

.folder-card-icon {
  fill: color-mix(in srgb, currentColor 24%, transparent);
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

.files-context-item.danger {
  color: var(--danger);
}

.folder-color-options {
  display: grid;
  grid-template-columns: repeat(4, 24px);
  gap: 7px;
  padding: 8px 10px;
}

.folder-color-option {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 2px solid rgba(255, 255, 255, 0.75);
  border-radius: 50%;
  box-shadow: 0 0 0 1px var(--line-strong);
}

.folder-editor-modal,
.folder-delete-modal {
  width: min(400px, calc(100vw - 32px));
}

.folder-editor-label {
  display: flex;
  flex-direction: column;
  gap: 7px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ink-secondary);
}

.folder-editor-label input {
  width: 100%;
  box-sizing: border-box;
  padding: 9px 11px;
  border: 1px solid var(--line-strong);
  border-radius: 10px;
  background: var(--input-bg);
  color: var(--ink);
  font: inherit;
}

.folder-editor-colors {
  display: flex;
  gap: 10px;
  margin: 18px 0 0;
  padding: 0;
  border: none;
}

.folder-editor-colors legend {
  margin-bottom: 9px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ink-secondary);
}

.folder-editor-color {
  width: 30px;
  height: 30px;
  padding: 0;
  border: 3px solid transparent;
  border-radius: 50%;
  box-shadow: 0 0 0 1px var(--line-strong);
}

.folder-editor-color.selected {
  border-color: var(--bg-elevated);
  box-shadow: 0 0 0 2px var(--accent);
}

.folder-delete-modal p {
  margin: 0;
  color: var(--ink-secondary);
  line-height: 1.55;
}

.folder-delete-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 18px;
}

@media (max-width: 720px) {
  .home {
    padding: 24px 16px 24px;
  }

}
</style>
