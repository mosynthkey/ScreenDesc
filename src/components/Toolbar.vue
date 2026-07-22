<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ToolMode } from '../types/annotation'
import type { ModelStatus } from '../types/detection'
import type { AppPageId } from './NavigationBar.vue'
import { useI18n } from '../i18n'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    page: AppPageId
    projectTitle?: string | null
    toolMode: ToolMode
    showSections: boolean
    isDetecting: boolean
    canExport: boolean
    copyJustSucceeded?: boolean
    hasImage: boolean
    /** When false, hide the floating edit dock (e.g. gallery while a project remains open). */
    showToolDock?: boolean
    modelStatus: ModelStatus
    modelDownloadProgress?: number
    canUndoCrop: boolean
  }>(),
  {
    projectTitle: null,
    copyJustSucceeded: false,
    showToolDock: true,
    modelDownloadProgress: 0,
  },
)

const emit = defineEmits<{
  'update:toolMode': [mode: ToolMode]
  toggleSections: []
  copyClipboard: []
  export: []
  undoCrop: []
  exportProjectFile: []
  openImportProject: []
  replaceImage: []
  openProjectStorage: []
  newProject: []
  renameProject: [name: string]
}>()

const cropMenuOpen = ref(false)
const projectMenuOpen = ref(false)
const titleDraft = ref('')
const titleInputRef = ref<HTMLInputElement | null>(null)

function syncTitleDraft(): void {
  titleDraft.value = props.projectTitle?.trim() || ''
}

watch(
  () => props.projectTitle,
  () => {
    if (document.activeElement === titleInputRef.value) return
    syncTitleDraft()
  },
  { immediate: true },
)

watch(
  () => props.page,
  (page) => {
    cropMenuOpen.value = false
    projectMenuOpen.value = false
    if (page === 'edit') syncTitleDraft()
  },
)

function commitTitle(): void {
  const next = titleDraft.value.trim()
  const current = props.projectTitle?.trim() || ''
  if (!next) {
    syncTitleDraft()
    return
  }
  if (next === current) {
    titleDraft.value = next
    return
  }
  emit('renameProject', next)
}

function onTitleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    event.preventDefault()
    titleInputRef.value?.blur()
    return
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    syncTitleDraft()
    titleInputRef.value?.blur()
  }
}

function setTool(mode: ToolMode): void {
  emit('update:toolMode', mode)
}

function toggleCropMenu(): void {
  cropMenuOpen.value = !cropMenuOpen.value
}

function chooseUndoCrop(): void {
  emit('undoCrop')
  cropMenuOpen.value = false
}

function toggleProjectMenu(): void {
  projectMenuOpen.value = !projectMenuOpen.value
}

function chooseProjectStorage(): void {
  emit('openProjectStorage')
  projectMenuOpen.value = false
}

function chooseNewProject(): void {
  emit('newProject')
  projectMenuOpen.value = false
}

function chooseExportProjectFile(): void {
  emit('exportProjectFile')
  projectMenuOpen.value = false
}

function chooseImportProject(): void {
  emit('openImportProject')
  projectMenuOpen.value = false
}

function chooseReplaceImage(): void {
  emit('replaceImage')
  projectMenuOpen.value = false
}

function handleWindowClick(event: MouseEvent): void {
  const target = event.target as HTMLElement | null
  if (cropMenuOpen.value && !target?.closest('.crop-menu-wrap')) {
    cropMenuOpen.value = false
  }
  if (projectMenuOpen.value && !target?.closest('.project-menu-wrap')) {
    projectMenuOpen.value = false
  }
}

onMounted(() => window.addEventListener('click', handleWindowClick))
onBeforeUnmount(() => window.removeEventListener('click', handleWindowClick))
</script>

<template>
  <header class="app-header">
    <div class="header-title">
      <h1 class="page-title">
        {{ page === 'gallery' ? t('header.galleryTitle') : t('header.editTitle') }}
      </h1>
      <input
        v-if="page === 'edit'"
        ref="titleInputRef"
        v-model="titleDraft"
        class="project-name-input"
        type="text"
        :aria-label="t('header.projectNameAria')"
        :placeholder="t('header.untitledProject')"
        @keydown="onTitleKeydown"
        @blur="commitTitle"
      />
    </div>

    <div v-if="page === 'gallery'" class="header-actions">
      <button
        class="header-btn"
        type="button"
        :data-tooltip="t('tooltip.importProjectFile')"
        @click="chooseImportProject"
      >
        <svg class="header-btn-icon" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
          <path
            d="M12 21V10"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          />
          <path
            d="M8 14l4-4 4 4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M5 6h14"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          />
        </svg>
        <span>{{ t('button.importProject') }}</span>
      </button>
      <button
        class="header-btn header-btn-primary"
        type="button"
        :data-tooltip="t('tooltip.newProject')"
        @click="chooseNewProject"
      >
        <svg class="header-btn-icon" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
          <path
            d="M12 5v14"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          />
          <path
            d="M5 12h14"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          />
        </svg>
        <span>{{ t('button.newProject') }}</span>
      </button>
    </div>

    <div v-else class="header-actions">
      <span v-if="modelStatus !== 'ready'" class="status-chip">
        <template v-if="modelStatus === 'error'">{{ t('status.modelLoadFailed') }}</template>
        <template v-else-if="modelStatus === 'downloading'">
          {{ t('status.modelDownloading', { percent: Math.round(modelDownloadProgress * 100) }) }}
        </template>
        <template v-else>{{ t('status.modelPreparing') }}</template>
      </span>
      <span v-if="isDetecting" class="status-chip">{{ t('status.proposing') }}</span>

      <div class="project-menu-wrap">
        <button
          class="header-btn"
          type="button"
          :data-tooltip="t('tooltip.projectMenu')"
          @click.stop="toggleProjectMenu"
        >
          <svg class="header-btn-icon" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <path
              d="M3.5 7.5h6.2l1.6 1.8H20.5v9.2a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5V7.5Z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linejoin="round"
            />
            <path
              d="M3.5 7.5V6A1.5 1.5 0 0 1 5 4.5h4.2L11 6.2"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span>{{ t('button.project') }}</span>
        </button>
        <div v-if="projectMenuOpen" class="project-menu" @click.stop>
          <button class="project-menu-item" type="button" @click="chooseNewProject">
            <svg class="project-menu-icon" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <path
                d="M12 5v14M5 12h14"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
              />
            </svg>
            <span>{{ t('menu.newProject') }}</span>
          </button>
          <button class="project-menu-item" type="button" @click="chooseProjectStorage">
            <svg class="project-menu-icon" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <path
                d="M3.5 7.5h6.2l1.6 1.8H20.5v9.2a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5V7.5Z"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linejoin="round"
              />
            </svg>
            <span>{{ t('menu.projectStorage') }}</span>
          </button>
          <div class="project-menu-sep" />
          <button
            class="project-menu-item"
            type="button"
            :disabled="!hasImage"
            @click="chooseExportProjectFile"
          >
            <svg class="project-menu-icon" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <path
                d="M12 4v10"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
              />
              <path
                d="M8 8l4-4 4 4"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M5 16v2.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V16"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
              />
            </svg>
            <span>{{ t('menu.exportProjectFile') }}</span>
          </button>
          <button class="project-menu-item" type="button" @click="chooseImportProject">
            <svg class="project-menu-icon" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <path
                d="M12 14V4"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
              />
              <path
                d="M8 10l4 4 4-4"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M5 16v2.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V16"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
              />
            </svg>
            <span>{{ t('menu.importProjectFile') }}</span>
          </button>
          <div class="project-menu-sep" />
          <button
            class="project-menu-item"
            type="button"
            :disabled="!hasImage"
            :title="t('tooltip.replaceImage')"
            @click="chooseReplaceImage"
          >
            <svg class="project-menu-icon" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <rect
                x="3.5"
                y="5.5"
                width="17"
                height="13"
                rx="2"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
              />
              <circle cx="9" cy="10.5" r="1.6" fill="currentColor" />
              <path
                d="M4.5 16.5l4.2-4.2a1.2 1.2 0 0 1 1.7 0L14 16l2.2-2.2a1.2 1.2 0 0 1 1.7 0l1.6 1.6"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span>{{ t('menu.replaceImage') }}</span>
          </button>
        </div>
      </div>

      <button
        class="header-btn"
        type="button"
        :data-tooltip="t('tooltip.copyClipboard')"
        :disabled="!canExport"
        @click="emit('copyClipboard')"
      >
        <svg
          v-if="!copyJustSucceeded"
          class="header-btn-icon"
          viewBox="0 0 24 24"
          width="15"
          height="15"
          aria-hidden="true"
        >
          <path
            d="M9 4.5h5.2a1.8 1.8 0 0 1 1.8 1.8V7H9.8A1.8 1.8 0 0 0 8 8.8V18H7a1.8 1.8 0 0 1-1.8-1.8V6.3A1.8 1.8 0 0 1 7 4.5h2Z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linejoin="round"
          />
          <rect
            x="9"
            y="7"
            width="10.5"
            height="12.5"
            rx="1.8"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
          />
        </svg>
        <svg
          v-else
          class="header-btn-icon"
          viewBox="0 0 24 24"
          width="15"
          height="15"
          aria-hidden="true"
        >
          <path
            d="M5 12.5l4.2 4.2L19 7"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span>{{ copyJustSucceeded ? t('button.copied') : t('button.copyClipboard') }}</span>
      </button>
      <button
        class="header-btn header-btn-primary"
        type="button"
        :data-tooltip="t('tooltip.export')"
        :disabled="!canExport"
        @click="emit('export')"
      >
        <svg class="header-btn-icon" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
          <path
            d="M12 3v11"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          />
          <path
            d="M8 10l4 4 4-4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M5 18h14"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          />
        </svg>
        <span>{{ t('button.export') }}</span>
      </button>
    </div>
  </header>

  <!-- Single floating dock: tools + modes + scan (no duplicate second bar) -->
  <div v-if="showToolDock" class="tool-dock" @keydown.stop>
    <div class="dock-bar material" role="toolbar" :aria-label="t('aria.editToolbar')">
      <div class="dock-group">
        <button
          class="tool-btn"
          :class="{ active: toolMode === 'select' }"
          type="button"
          :data-tooltip="t('tooltip.toolSelect')"
          :aria-label="t('aria.toolSelect')"
          @click="setTool('select')"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M6 4.5 17.5 12l-5.2 1.3L10 20.5 6 4.5Z" fill="currentColor" />
          </svg>
        </button>

        <button
          class="tool-btn"
          :class="{ active: toolMode === 'add-section' }"
          type="button"
          :data-tooltip="t('tooltip.toolAddSection')"
          :aria-label="t('aria.toolAddSection')"
          @click="setTool('add-section')"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path
              d="M8 5h8M5 8v8M19 8v8M8 19h8"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
            />
            <rect x="8" y="8" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1.5" />
          </svg>
        </button>

        <button
          class="tool-btn"
          :class="{ active: toolMode === 'annotate' }"
          type="button"
          :data-tooltip="t('tooltip.toolAnnotate')"
          :aria-label="t('aria.toolAnnotate')"
          @click="setTool('annotate')"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="1.8" />
            <circle cx="12" cy="12" r="2.2" fill="currentColor" />
          </svg>
        </button>

        <button
          class="tool-btn"
          :class="{ active: toolMode === 'crop' }"
          type="button"
          :data-tooltip="t('tooltip.toolCrop')"
          :aria-label="t('aria.toolCrop')"
          @click="setTool('crop')"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path
              d="M7 3v14a1 1 0 0 0 1 1h14M17 21V7a1 1 0 0 0-1-1H3"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>

        <div class="crop-menu-wrap">
          <button
            class="tool-btn tool-btn-caret"
            type="button"
            :data-tooltip="t('tooltip.cropMenu')"
            :aria-label="t('aria.cropMenu')"
            @click.stop="toggleCropMenu"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path d="M5 8l7 8 7-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>

          <div v-if="cropMenuOpen" class="crop-menu" @click.stop>
            <button
              class="crop-menu-item"
              type="button"
              :disabled="!canUndoCrop"
              @click="chooseUndoCrop"
            >
              {{ t('menu.undoCrop') }}
            </button>
          </div>
        </div>
      </div>

      <div class="dock-sep" />

      <div class="dock-group">
        <button
          class="tool-btn"
          :class="{ active: showSections }"
          type="button"
          :data-tooltip="t('tooltip.toggleSections')"
          :aria-label="t('aria.toggleSections')"
          @click="emit('toggleSections')"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <rect
              x="5"
              y="6"
              width="14"
              height="12"
              rx="2"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-dasharray="3 2"
            />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 18px;
  background: rgba(255, 255, 255, 0.72);
  border-bottom: 1px solid var(--line);
  backdrop-filter: var(--blur);
  -webkit-backdrop-filter: var(--blur);
  z-index: 5;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1 1 auto;
}

.page-title {
  margin: 0;
  flex: 0 0 auto;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
  white-space: nowrap;
}

.project-name-input {
  display: block;
  flex: 1 1 auto;
  min-width: 0;
  width: auto;
  max-width: min(360px, 42vw);
  margin: 0;
  padding: 4px 8px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
  outline: none;
  transition:
    background var(--press),
    border-color var(--press),
    box-shadow var(--press);
}

.project-name-input::placeholder {
  color: var(--ink-muted);
  font-weight: 650;
}

.project-name-input:hover {
  background: rgba(120, 120, 128, 0.08);
}

.project-name-input:focus {
  background: var(--bg-elevated);
  border-color: rgba(0, 122, 255, 0.35);
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.14);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.header-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: none;
  background: rgba(120, 120, 128, 0.12);
  color: var(--ink);
  border-radius: 980px;
  padding: 7px 14px;
  font-size: 0.8rem;
  font-weight: 590;
}

.header-btn-icon {
  flex: 0 0 auto;
  display: block;
}

.header-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.header-btn-primary {
  background: var(--accent);
  color: #fff;
}

.header-btn-primary:hover:not(:disabled) {
  background: var(--accent-strong);
}

.tool-dock {
  position: fixed;
  /* Center within the main column (right of the nav rail). */
  left: calc(var(--nav-rail-width) + (100vw - var(--nav-rail-width)) / 2);
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 40;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
  animation: dock-rise var(--spring);
}

@keyframes dock-rise {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.material {
  background: rgba(30, 30, 32, 0.72);
  color: #f5f5f7;
  backdrop-filter: blur(28px) saturate(180%);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.22),
    inset 0 0.5px 0 rgba(255, 255, 255, 0.18);
}

.dock-bar {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px;
  border-radius: 16px;
}

.dock-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.dock-sep {
  width: 1px;
  height: 26px;
  margin: 0 6px;
  background: rgba(255, 255, 255, 0.16);
}

.tool-btn {
  position: relative;
  appearance: none;
  border: none;
  background: transparent;
  color: rgba(245, 245, 247, 0.92);
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  height: 44px;
  padding: 0 8px;
}

.tool-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.tool-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.tool-btn.active {
  background: var(--accent);
  color: #fff;
  box-shadow: 0 2px 10px rgba(0, 122, 255, 0.35);
}

.crop-menu-wrap {
  position: relative;
}

.project-menu-wrap {
  position: relative;
}

.project-menu {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 4px;
  min-width: 220px;
  box-shadow: var(--shadow-lg);
  z-index: 50;
}

.project-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  color: var(--ink);
  font-size: 0.82rem;
  font-weight: 590;
  padding: 9px 10px;
  border-radius: 7px;
  white-space: nowrap;
}

.project-menu-icon {
  flex: 0 0 auto;
  opacity: 0.78;
}

.project-menu-item:hover:not(:disabled) {
  background: rgba(120, 120, 128, 0.12);
}

.project-menu-item:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.project-menu-sep {
  height: 1px;
  margin: 4px 6px;
  background: var(--line);
}

.tool-btn-caret {
  min-width: 22px;
  width: 22px;
  padding: 0;
  margin-left: -4px;
}

.crop-menu {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(30, 30, 32, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  padding: 4px;
  min-width: 160px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.3);
  z-index: 50;
}

.crop-menu-item {
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  color: #f5f5f7;
  font-size: 0.8rem;
  padding: 8px 10px;
  border-radius: 6px;
  white-space: nowrap;
}

.crop-menu-item:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
}

.crop-menu-item:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* Custom tooltips — native title is slow and inconsistent */
.tool-btn[data-tooltip]::after,
.header-btn[data-tooltip]::after {
  content: attr(data-tooltip);
  position: absolute;
  left: 50%;
  bottom: calc(100% + 10px);
  transform: translateX(-50%) translateY(4px);
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(28, 28, 30, 0.92);
  color: #f5f5f7;
  font-size: 0.72rem;
  font-weight: 590;
  letter-spacing: -0.01em;
  white-space: nowrap;
  line-height: 1.3;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.22);
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 120ms ease,
    transform 120ms ease;
  transition-delay: 0ms;
  z-index: 60;
}

.header-btn[data-tooltip]::after {
  bottom: auto;
  top: calc(100% + 8px);
  transform: translateX(-50%) translateY(-4px);
}

.tool-btn[data-tooltip]:hover::after,
.tool-btn[data-tooltip]:focus-visible::after,
.header-btn[data-tooltip]:hover::after,
.header-btn[data-tooltip]:focus-visible::after {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
  transition-delay: 280ms;
}

.tool-btn[data-tooltip]:disabled:hover::after {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .tool-dock {
    animation: none;
  }

  .tool-btn[data-tooltip]::after,
  .header-btn[data-tooltip]::after {
    transition: none;
  }
}

@media (max-width: 720px) {
  .tool-dock {
    bottom: 12px;
    width: min(100vw - 16px, 420px);
  }

  .dock-bar {
    justify-content: center;
    width: 100%;
  }
}
</style>
