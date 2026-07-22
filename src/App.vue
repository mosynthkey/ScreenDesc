<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
  clearCurrentProject,
  cropImage,
  undoCrop,
  runSectionDetection,
  addSection,
  setToolMode,
  setDefaultAnnotationMode,
  setDefaultTextStyle,
  setDefaultFontFamily,
  setLineStyle,
  setLineWidth,
  setLineColor,
  setLineOpacity,
  setDotRadius,
  setLineHaloWidth,
  setLineHaloColor,
  setCalloutFontSize,
  setCalloutBorderWidth,
  setNumberStyle,
  setLabelColor,
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
const projectFileInputRef = ref<HTMLInputElement | null>(null)
const homeRef = ref<{ openFilePicker: () => void } | null>(null)
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
  if (hasImage.value) return
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

onMounted(() => {
  window.addEventListener('paste', onWindowPaste)
  void refreshSavedProjects()
})
onBeforeUnmount(() => window.removeEventListener('paste', onWindowPaste))

watch(hasImage, (open) => {
  if (!open) void refreshSavedProjects()
})

async function onNewProject(): Promise<void> {
  if (!hasImage.value) {
    homeRef.value?.openFilePicker()
    return
  }
  if (!window.confirm(t('confirm.newProject'))) return
  projectLoadError.value = null
  await clearCurrentProject()
  await refreshSavedProjects()
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
      :show-sections="state.showSections"
      :is-detecting="isDetecting"
      :can-export="hasImage && !isExporting"
      :has-image="hasImage"
      :model-status="modelStatus"
      :can-undo-crop="canUndoCrop"
      @update:tool-mode="setToolMode"
      @toggle-sections="toggleShowSections"
      @export="exportOpen = true"
      @propose="onPropose"
      @undo-crop="onUndoCrop"
      @export-project-file="onExportProjectFile"
      @open-import-project="onOpenImportProject"
      @open-project-storage="onOpenProjectStorage"
      @new-project="onNewProject"
    />

    <input
      ref="projectFileInputRef"
      type="file"
      accept=".json,application/json"
      hidden
      @change="onProjectFileChange"
    />
    <p v-if="projectLoadError" class="project-load-error">{{ projectLoadError }}</p>

    <div class="workspace" :class="{ 'is-home': !hasImage }">
      <template v-if="hasImage">
        <aside class="panel panel-left">
          <div class="panel-section panel-section-list">
            <AnnotationList
              :annotations="sortedAnnotations"
              :selected-ids="[...state.selectedAnnotationIds]"
              @select="selectAnnotation"
              @reorder="reorderAnnotations"
              @remove="(id) => removeAnnotations([id])"
              @edit-description="(id, value) => updateAnnotation(id, { description: value })"
            />
          </div>
          <div class="panel-section panel-section-annotation">
            <StylePanel
              :show-project="false"
              :show-annotation="true"
              :annotation="selectedAnnotation"
              :default-annotation-mode="state.defaultAnnotationMode"
              :default-text-style="state.defaultTextStyle"
              :default-font-family="state.defaultFontFamily"
              :line-style="state.lineStyle"
              :line-width="state.lineWidth"
              :line-color="state.lineColor"
              :line-opacity="state.lineOpacity"
              :dot-radius="state.dotRadius"
              :line-halo-width="state.lineHaloWidth"
              :line-halo-color="state.lineHaloColor"
              :callout-font-size="state.calloutFontSize"
              :callout-border-width="state.calloutBorderWidth"
              :number-style="state.numberStyle"
              :label-color="state.labelColor"
              @patch="(patch) => selectedAnnotation && updateAnnotation(selectedAnnotation.id, patch)"
            />
          </div>
        </aside>

        <AnnotationCanvas
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
          :line-width="state.lineWidth"
          :line-color="state.lineColor"
          :line-opacity="state.lineOpacity"
          :dot-color="state.lineColor"
          :dot-radius="state.dotRadius"
          :line-halo-width="state.lineHaloWidth"
          :line-halo-color="state.lineHaloColor"
          :callout-font-size="state.calloutFontSize"
          :callout-border-width="state.calloutBorderWidth"
          :number-style="state.numberStyle"
          :label-color="state.labelColor"
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
              :show-project="true"
              :show-annotation="false"
              :annotation="null"
              :default-annotation-mode="state.defaultAnnotationMode"
              :default-text-style="state.defaultTextStyle"
              :default-font-family="state.defaultFontFamily"
              :line-style="state.lineStyle"
              :line-width="state.lineWidth"
              :line-color="state.lineColor"
              :line-opacity="state.lineOpacity"
              :dot-radius="state.dotRadius"
              :line-halo-width="state.lineHaloWidth"
              :line-halo-color="state.lineHaloColor"
              :callout-font-size="state.calloutFontSize"
              :callout-border-width="state.calloutBorderWidth"
              :number-style="state.numberStyle"
              :label-color="state.labelColor"
              @update:default-annotation-mode="setDefaultAnnotationMode"
              @update:default-text-style="setDefaultTextStyle"
              @update:default-font-family="setDefaultFontFamily"
              @update:line-style="setLineStyle"
              @update:line-width="setLineWidth"
              @update:line-color="setLineColor"
              @update:line-opacity="setLineOpacity"
              @update:dot-radius="setDotRadius"
              @update:line-halo-width="setLineHaloWidth"
              @update:line-halo-color="setLineHaloColor"
              @update:callout-font-size="setCalloutFontSize"
              @update:callout-border-width="setCalloutBorderWidth"
              @update:number-style="setNumberStyle"
              @update:label-color="setLabelColor"
            />
          </div>
        </aside>
      </template>

      <UploadZone
        v-else
        ref="homeRef"
        :projects="savedProjects"
        :is-busy="projectStorageBusy"
        @file="onFile"
        @open="onLoadSavedProject"
        @remove="onRemoveSavedProject"
      />
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
.workspace.is-home {
  grid-template-columns: 1fr;
}

.panel-left {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-section-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  border-bottom: none;
}

.panel-section-annotation {
  flex: 0 0 auto;
  margin-top: auto;
  border-bottom: none;
  border-top: 1px solid var(--line);
}

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
