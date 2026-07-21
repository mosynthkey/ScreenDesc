<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Toolbar from './components/Toolbar.vue'
import UploadZone from './components/UploadZone.vue'
import AnnotationCanvas from './components/AnnotationCanvas.vue'
import AnnotationList from './components/AnnotationList.vue'
import StylePanel from './components/StylePanel.vue'
import ExportDialog from './components/ExportDialog.vue'
import ProjectStorageDialog from './components/ProjectStorageDialog.vue'
import { useAnnotationStore } from './composables/useAnnotationStore'
import type { ExportOptions, Point, Rect } from './types/annotation'
import type { SavedProjectMeta } from './utils/projectStorage'
import { useI18n } from './i18n'

const { t } = useI18n()

const store = useAnnotationStore()
const {
  state,
  isDetecting,
  isExporting,
  modelStatus,
  hasImage,
  sortedAnnotations,
  canUndoCrop,
  loadImageFile,
  cropImage,
  undoCrop,
  runSectionDetection,
  addSection,
  setToolMode,
  setDefaultAnnotationMode,
  setDefaultTextStyle,
  setDefaultFontFamily,
  setLineStyle,
  setLineColor,
  setDotColor,
  setDotRadius,
  setLineHalo,
  setCalloutFontSize,
  setCalloutBorderWidth,
  toggleShowSections,
  clearSelection,
  selectSection,
  selectAnnotation,
  updateSectionRect,
  createAnnotationForSection,
  addAnnotationAtPoint,
  updateAnnotation,
  removeAnnotations,
  reorderAnnotations,
  exportProject,
  saveProjectToFile,
  loadProjectFromFile,
  saveProjectAs,
  fetchSavedProjects,
  loadSavedProject,
  removeSavedProject,
  deleteSelection,
} = store

const exportOpen = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const projectFileInputRef = ref<HTMLInputElement | null>(null)
const projectLoadError = ref<string | null>(null)
const projectStorageOpen = ref(false)
const savedProjects = ref<SavedProjectMeta[]>([])
const projectStorageBusy = ref(false)

const selectedAnnotation = computed(() => {
  const selectedId = state.selectedAnnotationIds[0]
  if (!selectedId) return null
  return state.annotations.find((item) => item.id === selectedId) ?? null
})

async function onFile(file: File): Promise<void> {
  await loadImageFile(file)
}

function onWindowPaste(event: ClipboardEvent): void {
  const items = event.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) {
        event.preventDefault()
        void onFile(file)
      }
      return
    }
  }
}

onMounted(() => window.addEventListener('paste', onWindowPaste))
onBeforeUnmount(() => window.removeEventListener('paste', onWindowPaste))

function onReplaceClick(): void {
  fileInputRef.value?.click()
}

function onReplaceChange(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) void onFile(file)
  input.value = ''
}

function onAnnotateSection(sectionId: string): void {
  const section = state.sections.find((item) => item.id === sectionId)
  if (!section) return
  createAnnotationForSection(section)
}

function onAddAnnotationAt(point: Point): void {
  addAnnotationAtPoint(point)
}

function onAddSection(rect: Rect): void {
  addSection(rect)
}

async function onCropImage(rect: Rect): Promise<void> {
  await cropImage(rect)
  setToolMode('select')
}

async function onUndoCrop(): Promise<void> {
  await undoCrop()
}

async function onExportProjectFile(): Promise<void> {
  await saveProjectToFile()
}

function onOpenImportProject(): void {
  projectFileInputRef.value?.click()
}

async function onProjectFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  projectLoadError.value = null
  try {
    await loadProjectFromFile(file)
  } catch (err) {
    projectLoadError.value = err instanceof Error ? err.message : t('error.projectLoadFailed')
  }
}

async function refreshSavedProjects(): Promise<void> {
  savedProjects.value = await fetchSavedProjects()
}

async function onOpenProjectStorage(): Promise<void> {
  projectStorageOpen.value = true
  await refreshSavedProjects()
}

async function onSaveNamedProject(name: string): Promise<void> {
  projectStorageBusy.value = true
  try {
    await saveProjectAs(name)
    await refreshSavedProjects()
  } finally {
    projectStorageBusy.value = false
  }
}

async function onOverwriteSavedProject(id: string): Promise<void> {
  const target = savedProjects.value.find((item) => item.id === id)
  if (!target) return
  projectStorageBusy.value = true
  try {
    await saveProjectAs(target.name, id)
    await refreshSavedProjects()
  } finally {
    projectStorageBusy.value = false
  }
}

async function onLoadSavedProject(id: string): Promise<void> {
  projectStorageBusy.value = true
  projectLoadError.value = null
  try {
    await loadSavedProject(id)
    projectStorageOpen.value = false
  } catch (err) {
    projectLoadError.value = err instanceof Error ? err.message : t('error.projectLoadFailed')
  } finally {
    projectStorageBusy.value = false
  }
}

async function onRemoveSavedProject(id: string): Promise<void> {
  projectStorageBusy.value = true
  try {
    await removeSavedProject(id)
    await refreshSavedProjects()
  } finally {
    projectStorageBusy.value = false
  }
}

async function onPropose(): Promise<void> {
  await runSectionDetection()
}

function onUpdateMarker(annotationId: string, point: Point): void {
  updateAnnotation(annotationId, { markerPosition: point })
}

function onUpdateCalloutPosition(annotationId: string, point: Point): void {
  updateAnnotation(annotationId, { calloutPosition: point })
}

function onCommitDescription(annotationId: string, description: string): void {
  updateAnnotation(annotationId, { description })
}

async function onExport(options: ExportOptions): Promise<void> {
  await exportProject(options)
  exportOpen.value = false
}

function onKeydown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return

  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    deleteSelection()
  }
  if (event.key === 'Escape') {
    clearSelection()
  }
  if (event.key === 'v' || event.key === 'V') {
    setToolMode('select')
  }
  if (event.key === 'a' || event.key === 'A') {
    setToolMode('annotate')
  }
  if (event.key === 'f' || event.key === 'F') {
    setToolMode('add-section')
  }
  if (event.key === 'x' || event.key === 'X') {
    setToolMode('crop')
  }
  if (event.key === 'c' || event.key === 'C') {
    setDefaultAnnotationMode('callout')
    setToolMode('annotate')
  }
  if (event.key === 'i' || event.key === 'I') {
    setDefaultAnnotationMode('inline')
    setToolMode('annotate')
  }
}
</script>

<template>
  <div class="app-shell" tabindex="0" @keydown="onKeydown">
    <Toolbar
      :tool-mode="state.toolMode"
      :annotation-mode="state.defaultAnnotationMode"
      :show-sections="state.showSections"
      :is-detecting="isDetecting"
      :can-export="hasImage && !isExporting"
      :has-image="hasImage"
      :model-status="modelStatus"
      :can-undo-crop="canUndoCrop"
      @update:tool-mode="setToolMode"
      @update:annotation-mode="setDefaultAnnotationMode"
      @toggle-sections="toggleShowSections"
      @export="exportOpen = true"
      @upload="onReplaceClick"
      @propose="onPropose"
      @undo-crop="onUndoCrop"
      @export-project-file="onExportProjectFile"
      @open-import-project="onOpenImportProject"
      @open-project-storage="onOpenProjectStorage"
    />

    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      hidden
      @change="onReplaceChange"
    />
    <input
      ref="projectFileInputRef"
      type="file"
      accept=".json,application/json"
      hidden
      @change="onProjectFileChange"
    />
    <p v-if="projectLoadError" class="project-load-error">{{ projectLoadError }}</p>

    <div class="workspace">
      <aside class="panel">
        <div class="panel-section">
          <h3 class="panel-title">{{ t('sidebar.workflowTitle') }}</h3>
          <p class="hint">
            {{ t('sidebar.workflow.step1') }}<br />
            {{ t('sidebar.workflow.step2') }}<br />
            {{ t('sidebar.workflow.step3') }}<br />
            {{ t('sidebar.workflow.step4') }}
          </p>
        </div>
        <div class="panel-section">
          <AnnotationList
            :annotations="sortedAnnotations"
            :selected-ids="[...state.selectedAnnotationIds]"
            @select="selectAnnotation"
            @reorder="reorderAnnotations"
            @remove="(id) => removeAnnotations([id])"
            @edit-description="(id, value) => updateAnnotation(id, { description: value })"
          />
        </div>
      </aside>

      <UploadZone v-if="!hasImage" @file="onFile" />
      <AnnotationCanvas
        v-else
        :image-url="state.imageUrl!"
        :document="state.document"
        :sections="[...state.sections]"
        :annotations="[...state.annotations]"
        :callout-layouts="state.calloutLayouts.map((item) => ({ ...item, lines: [...item.lines] }))"
        :selected-section-ids="[...state.selectedSectionIds]"
        :selected-annotation-ids="[...state.selectedAnnotationIds]"
        :tool-mode="state.toolMode"
        :show-sections="state.showSections"
        :annotation-mode="state.defaultAnnotationMode"
        :line-style="state.lineStyle"
        :line-color="state.lineColor"
        :dot-color="state.dotColor"
        :dot-radius="state.dotRadius"
        :line-halo="state.lineHalo"
        :callout-font-size="state.calloutFontSize"
        :callout-border-width="state.calloutBorderWidth"
        :font-family="state.defaultFontFamily"
        :is-detecting="isDetecting"
        :empty-hint="state.sections.length === 0"
        @clear-selection="clearSelection"
        @select-section="selectSection"
        @select-annotation="selectAnnotation"
        @annotate-section="onAnnotateSection"
        @add-annotation-at="onAddAnnotationAt"
        @update-section-rect="updateSectionRect"
        @update-marker="onUpdateMarker"
        @update-callout-position="onUpdateCalloutPosition"
        @add-section="onAddSection"
        @commit-description="onCommitDescription"
        @crop-image="onCropImage"
      />

      <aside class="panel">
        <div class="panel-section">
          <StylePanel
            :annotation="selectedAnnotation"
            :default-annotation-mode="state.defaultAnnotationMode"
            :default-text-style="state.defaultTextStyle"
            :default-font-family="state.defaultFontFamily"
            :line-style="state.lineStyle"
            :line-color="state.lineColor"
            :dot-color="state.dotColor"
            :dot-radius="state.dotRadius"
            :line-halo="state.lineHalo"
            :callout-font-size="state.calloutFontSize"
            :callout-border-width="state.calloutBorderWidth"
            @update:default-annotation-mode="setDefaultAnnotationMode"
            @update:default-text-style="setDefaultTextStyle"
            @update:default-font-family="setDefaultFontFamily"
            @update:line-style="setLineStyle"
            @update:line-color="setLineColor"
            @update:dot-color="setDotColor"
            @update:dot-radius="setDotRadius"
            @update:line-halo="setLineHalo"
            @update:callout-font-size="setCalloutFontSize"
            @update:callout-border-width="setCalloutBorderWidth"
            @patch="(patch) => selectedAnnotation && updateAnnotation(selectedAnnotation.id, patch)"
          />
        </div>
        <div class="panel-section">
          <h3 class="panel-title">{{ t('sidebar.shortcutsTitle') }}</h3>
          <p class="hint">
            {{ t('sidebar.shortcuts.line1') }}<br />
            {{ t('sidebar.shortcuts.line2') }}<br />
            {{ t('sidebar.shortcuts.line3') }}<br />
            {{ t('sidebar.shortcuts.line4') }}<br />
            {{ t('sidebar.shortcuts.line5') }}
          </p>
        </div>
      </aside>
    </div>

    <ExportDialog :open="exportOpen" @close="exportOpen = false" @export="onExport" />
    <ProjectStorageDialog
      :open="projectStorageOpen"
      :has-image="hasImage"
      :projects="savedProjects"
      :is-busy="projectStorageBusy"
      @close="projectStorageOpen = false"
      @save="onSaveNamedProject"
      @overwrite="onOverwriteSavedProject"
      @load="onLoadSavedProject"
      @remove="onRemoveSavedProject"
    />
  </div>
</template>

<style scoped>
.project-load-error {
  position: fixed;
  top: 64px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 60;
  background: var(--danger-soft);
  color: var(--danger);
  border: 1px solid rgba(255, 59, 48, 0.3);
  border-radius: 10px;
  padding: 8px 14px;
  font-size: 0.82rem;
  font-weight: 590;
  box-shadow: var(--shadow);
}
</style>
