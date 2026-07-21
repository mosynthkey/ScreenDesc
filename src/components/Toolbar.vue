<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { AnnotationMode, ToolMode } from '../types/annotation'
import type { ModelStatus } from '../types/detection'
import { useI18n } from '../i18n'

const { t } = useI18n()

defineProps<{
  toolMode: ToolMode
  annotationMode: AnnotationMode
  showSections: boolean
  isDetecting: boolean
  canExport: boolean
  hasImage: boolean
  modelStatus: ModelStatus
  canUndoCrop: boolean
}>()

const emit = defineEmits<{
  'update:toolMode': [mode: ToolMode]
  'update:annotationMode': [mode: AnnotationMode]
  toggleSections: []
  export: []
  upload: []
  propose: []
  undoCrop: []
  exportProjectFile: []
  openImportProject: []
  openProjectStorage: []
}>()

const cropMenuOpen = ref(false)
const projectMenuOpen = ref(false)

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

function chooseExportProjectFile(): void {
  emit('exportProjectFile')
  projectMenuOpen.value = false
}

function chooseImportProject(): void {
  emit('openImportProject')
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
    <div class="brand">
      <div class="brand-mark" aria-hidden="true" />
      <div class="brand-text">
        <div class="brand-name">ScreenDesc</div>
        <div class="brand-tag">{{ t('brand.tagline') }}</div>
      </div>
    </div>

    <div class="header-actions">
      <span v-if="modelStatus !== 'ready'" class="status-chip">
        {{ modelStatus === 'error' ? t('status.modelLoadFailed') : t('status.modelLoading') }}
      </span>
      <span v-if="isDetecting" class="status-chip">{{ t('status.proposing') }}</span>

      <div class="project-menu-wrap">
        <button
          class="header-btn"
          type="button"
          :data-tooltip="t('tooltip.projectMenu')"
          @click.stop="toggleProjectMenu"
        >
          {{ t('button.project') }}
        </button>
        <div v-if="projectMenuOpen" class="project-menu" @click.stop>
          <button class="project-menu-item" type="button" @click="chooseProjectStorage">
            {{ t('menu.projectStorage') }}
          </button>
          <div class="project-menu-sep" />
          <button
            class="project-menu-item"
            type="button"
            :disabled="!hasImage"
            @click="chooseExportProjectFile"
          >
            {{ t('menu.exportProjectFile') }}
          </button>
          <button class="project-menu-item" type="button" @click="chooseImportProject">
            {{ t('menu.importProjectFile') }}
          </button>
        </div>
      </div>

      <button
        class="header-btn"
        type="button"
        :data-tooltip="hasImage ? t('tooltip.replaceImage') : t('tooltip.openImage')"
        @click="emit('upload')"
      >
        {{ hasImage ? t('button.replaceImage') : t('button.openImage') }}
      </button>
      <button
        class="header-btn header-btn-primary"
        type="button"
        :data-tooltip="t('tooltip.export')"
        :disabled="!canExport"
        @click="emit('export')"
      >
        {{ t('button.export') }}
      </button>
    </div>
  </header>

  <!-- Single floating dock: tools + modes + scan (no duplicate second bar) -->
  <div v-if="hasImage" class="tool-dock" @keydown.stop>
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
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
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
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
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
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
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
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
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
            <svg viewBox="0 0 24 24" width="10" height="10" aria-hidden="true">
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
          :class="{ active: annotationMode === 'inline' }"
          type="button"
          :data-tooltip="t('tooltip.modeInline')"
          :aria-label="t('aria.modeInline')"
          @click="emit('update:annotationMode', 'inline'); setTool('annotate')"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8" />
            <text
              x="12"
              y="16"
              text-anchor="middle"
              font-size="10"
              font-weight="700"
              fill="currentColor"
            >
              ①
            </text>
          </svg>
        </button>

        <button
          class="tool-btn"
          :class="{ active: annotationMode === 'callout' }"
          type="button"
          :data-tooltip="t('tooltip.modeCallout')"
          :aria-label="t('aria.modeCallout')"
          @click="emit('update:annotationMode', 'callout'); setTool('annotate')"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              d="M4 17V7h7"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <rect
              x="12"
              y="5"
              width="8"
              height="5.5"
              rx="1.2"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
            />
          </svg>
        </button>
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
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
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

        <button
          class="tool-btn"
          type="button"
          :data-tooltip="t('tooltip.rescan')"
          :aria-label="t('aria.rescan')"
          :disabled="isDetecting"
          @click="emit('propose')"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              d="M6.5 8.5A6 6 0 0 1 18 10"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
            />
            <path
              d="M18 6.5v3.5h-3.5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
            />
            <path
              d="M17.5 15.5A6 6 0 0 1 6 14"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
            />
            <path
              d="M6 17.5V14h3.5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
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

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-mark {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: linear-gradient(145deg, #5ac8fa 0%, #007aff 55%, #5856d6 100%);
  box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.35);
}

.brand-name {
  font-size: 0.98rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.1;
}

.brand-tag {
  font-size: 0.68rem;
  color: var(--ink-muted);
  letter-spacing: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-btn {
  position: relative;
  border: none;
  background: rgba(120, 120, 128, 0.12);
  color: var(--ink);
  border-radius: 980px;
  padding: 7px 14px;
  font-size: 0.8rem;
  font-weight: 590;
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
  left: 50%;
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
  height: 22px;
  margin: 0 6px;
  background: rgba(255, 255, 255, 0.16);
}

.tool-btn {
  position: relative;
  appearance: none;
  border: none;
  background: transparent;
  color: rgba(245, 245, 247, 0.92);
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  height: 40px;
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
  min-width: 180px;
  box-shadow: var(--shadow-lg);
  z-index: 50;
}

.project-menu-item {
  display: block;
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
