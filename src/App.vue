<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Toolbar from './components/Toolbar.vue'
import UploadZone from './components/UploadZone.vue'
import AnnotationCanvas from './components/AnnotationCanvas.vue'
import AnnotationList from './components/AnnotationList.vue'
import StylePanel from './components/StylePanel.vue'
import ExportDialog from './components/ExportDialog.vue'
import ProjectStorageDialog from './components/ProjectStorageDialog.vue'
import CommonSettingsDialog from './components/CommonSettingsDialog.vue'
import CropConfirmDialog from './components/CropConfirmDialog.vue'
import NavigationBar, { type AppPageId } from './components/NavigationBar.vue'
import { useAnnotationStore } from './composables/useAnnotationStore'
import type { ExportOptions, Point, Rect } from './types/annotation'
import type { SavedProjectMeta } from './utils/projectStorage'
import type { CommonSettingsPresetMeta } from './utils/commonSettings'
import { resolveCalloutBorderWidth } from './utils/commonSettings'
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
  activeNamedProject,
  loadImageFile,
  clearCurrentProject,
  cropImage,
  undoCrop,
  undoEdit,
  addSection,
  setToolMode,
  setDefaultFontFamily,
  setLineStyle,
  setLineWidth,
  setLineColor,
  setDotRadius,
  setAnchorStyle,
  setLineHaloWidth,
  setLineHaloColor,
  setCalloutFontSize,
  setCalloutBorderEnabled,
  setCalloutFillEnabled,
  setCalloutFillColor,
  setCalloutFillOpacity,
  setNumberStyle,
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
  copyAnnotatedImageToClipboard,
  saveProjectToFile,
  loadProjectFromFile,
  saveProjectAs,
  setProjectName,
  fetchSavedProjects,
  loadSavedProject,
  removeSavedProject,
  fetchCommonSettingsPresets,
  saveCommonSettingsAs,
  applyCommonSettingsPreset,
  removeCommonSettingsPreset,
  deleteSelection,
} = store

const exportOpen = ref(false)
const copyJustSucceeded = ref(false)
let copyFeedbackTimer: ReturnType<typeof setTimeout> | undefined
const projectFileInputRef = ref<HTMLInputElement | null>(null)
const homeRef = ref<{ openFilePicker: () => void } | null>(null)
const projectLoadError = ref<string | null>(null)
const projectStorageOpen = ref(false)
const savedProjects = ref<SavedProjectMeta[]>([])
const projectStorageBusy = ref(false)
const commonSettingsOpen = ref(false)
const commonSettingsPresets = ref<CommonSettingsPresetMeta[]>([])
const commonSettingsBusy = ref(false)
const cropConfirmOpen = ref(false)
const pendingCropRect = ref<Rect | null>(null)
const appPage = ref<AppPageId>('gallery')

const selectedAnnotation = computed(() => {
  const selectedId = state.selectedAnnotationIds[0]
  if (!selectedId) return null
  return state.annotations.find((item) => item.id === selectedId) ?? null
})

const effectiveCalloutBorderWidth = computed(() =>
  resolveCalloutBorderWidth(state.calloutBorderEnabled, state.lineWidth),
)

const showToolDock = computed(() => hasImage.value && appPage.value === 'edit')

function goToPage(page: AppPageId): void {
  if (page === 'edit' && !hasImage.value) return
  appPage.value = page
  if (page === 'gallery') void refreshSavedProjects()
}

async function onFile(file: File): Promise<void> {
  await loadImageFile(file)
  appPage.value = 'edit'
}

async function onWindowPaste(event: ClipboardEvent): Promise<void> {
  if (appPage.value !== 'gallery') return
  const items = event.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (!item.type.startsWith('image/')) continue
    const file = item.getAsFile()
    if (!file) return
    event.preventDefault()
    if (hasImage.value) {
      if (!window.confirm(t('confirm.newProject'))) return
      projectLoadError.value = null
      await clearCurrentProject()
    }
    await onFile(file)
    return
  }
}

onMounted(() => {
  window.addEventListener('paste', onWindowPaste)
  void refreshSavedProjects()
})
onBeforeUnmount(() => {
  window.removeEventListener('paste', onWindowPaste)
  if (copyFeedbackTimer) clearTimeout(copyFeedbackTimer)
})

watch(
  hasImage,
  (open, previouslyOpen) => {
    if (!open) {
      void refreshSavedProjects()
      if (previouslyOpen) appPage.value = 'gallery'
      return
    }
    if (previouslyOpen === false || previouslyOpen === undefined) {
      appPage.value = 'edit'
    }
  },
  { immediate: true },
)

async function onNewProject(): Promise<void> {
  if (!hasImage.value) {
    appPage.value = 'gallery'
    await nextTick()
    homeRef.value?.openFilePicker()
    return
  }
  if (!window.confirm(t('confirm.newProject'))) return
  projectLoadError.value = null
  await clearCurrentProject()
  appPage.value = 'gallery'
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
  const hasWork = state.annotations.length > 0 || state.sections.length > 0
  if (hasWork) {
    pendingCropRect.value = rect
    cropConfirmOpen.value = true
    return
  }
  await cropImage(rect)
  setToolMode('select')
}

function closeCropConfirm(): void {
  cropConfirmOpen.value = false
  pendingCropRect.value = null
}

async function confirmCropAsNewProject(): Promise<void> {
  const rect = pendingCropRect.value
  closeCropConfirm()
  if (!rect) return
  await cropImage(rect, { asNewProject: true })
  setToolMode('select')
}

async function confirmCropOverwrite(): Promise<void> {
  const rect = pendingCropRect.value
  closeCropConfirm()
  if (!rect) return
  await cropImage(rect, { asNewProject: false })
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
    appPage.value = 'edit'
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
    appPage.value = 'edit'
  } catch (err) {
    projectLoadError.value = err instanceof Error ? err.message : t('error.projectLoadFailed')
  } finally {
    projectStorageBusy.value = false
  }
}

async function onRemoveSavedProject(id: string): Promise<void> {
  const target = savedProjects.value.find((item) => item.id === id)
  const name = target?.name?.trim() || t('header.untitledProject')
  if (!window.confirm(t('confirm.deleteSavedProject', { name }))) return
  projectStorageBusy.value = true
  try {
    await removeSavedProject(id)
    await refreshSavedProjects()
  } finally {
    projectStorageBusy.value = false
  }
}

async function onExport(options: ExportOptions): Promise<void> {
  await exportProject(options)
  exportOpen.value = false
}

function refreshCommonSettingsPresets(): void {
  commonSettingsPresets.value = fetchCommonSettingsPresets()
}

function onOpenCommonSettings(): void {
  refreshCommonSettingsPresets()
  commonSettingsOpen.value = true
}

async function onSaveCommonSettings(name: string): Promise<void> {
  commonSettingsBusy.value = true
  try {
    saveCommonSettingsAs(name)
    refreshCommonSettingsPresets()
  } finally {
    commonSettingsBusy.value = false
  }
}

async function onOverwriteCommonSettings(id: string): Promise<void> {
  const target = commonSettingsPresets.value.find((preset) => preset.id === id)
  if (!target) return
  commonSettingsBusy.value = true
  try {
    saveCommonSettingsAs(target.name, id)
    refreshCommonSettingsPresets()
  } finally {
    commonSettingsBusy.value = false
  }
}

async function onApplyCommonSettings(id: string): Promise<void> {
  commonSettingsBusy.value = true
  try {
    const applied = await applyCommonSettingsPreset(id)
    if (!applied) {
      window.alert(t('error.commonSettingsNotFound'))
      return
    }
    commonSettingsOpen.value = false
  } finally {
    commonSettingsBusy.value = false
  }
}

async function onRemoveCommonSettings(id: string): Promise<void> {
  commonSettingsBusy.value = true
  try {
    removeCommonSettingsPreset(id)
    refreshCommonSettingsPresets()
  } finally {
    commonSettingsBusy.value = false
  }
}

async function onCopyClipboard(): Promise<void> {
  try {
    await copyAnnotatedImageToClipboard()
    copyJustSucceeded.value = true
    if (copyFeedbackTimer) clearTimeout(copyFeedbackTimer)
    copyFeedbackTimer = setTimeout(() => {
      copyJustSucceeded.value = false
    }, 2000)
  } catch {
    window.alert(t('error.clipboardCopyFailed'))
  }
}

function onUpdateCalloutPosition(annotationId: string, point: Point): void {
  updateAnnotation(annotationId, { calloutPosition: point })
}

function onCommitDescription(annotationId: string, description: string): void {
  updateAnnotation(annotationId, { description })
}

function onKeydown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
  if (appPage.value !== 'edit' || !hasImage.value) return

  if ((event.metaKey || event.ctrlKey) && !event.altKey && (event.key === 'z' || event.key === 'Z')) {
    if (event.shiftKey) return
    event.preventDefault()
    undoEdit()
    return
  }

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
}
</script>

<template>
  <div class="app-shell" tabindex="0" @keydown="onKeydown">
    <NavigationBar
      :active="appPage"
      :edit-available="hasImage"
      @navigate="goToPage"
    />

    <div class="app-column">
      <Toolbar
        :page="appPage"
        :project-title="activeNamedProject?.name ?? null"
        :tool-mode="state.toolMode"
        :show-sections="state.showSections"
        :is-detecting="isDetecting"
        :can-export="hasImage && !isExporting"
        :copy-just-succeeded="copyJustSucceeded"
        :has-image="hasImage"
        :show-tool-dock="showToolDock"
        :model-status="modelStatus"
        :can-undo-crop="canUndoCrop"
        @update:tool-mode="setToolMode"
        @toggle-sections="toggleShowSections"
        @copy-clipboard="onCopyClipboard"
        @export="exportOpen = true"
        @undo-crop="onUndoCrop"
        @export-project-file="onExportProjectFile"
        @open-import-project="onOpenImportProject"
        @open-project-storage="onOpenProjectStorage"
        @new-project="onNewProject"
        @rename-project="setProjectName"
      />

      <input
        ref="projectFileInputRef"
        type="file"
        accept=".json,application/json"
        hidden
        @change="onProjectFileChange"
      />
      <p v-if="projectLoadError" class="project-load-error">{{ projectLoadError }}</p>

      <main class="app-main" :class="{ 'is-gallery': appPage === 'gallery' }">
        <UploadZone
          v-if="appPage === 'gallery'"
          ref="homeRef"
          :projects="savedProjects"
          :is-busy="projectStorageBusy"
          @file="onFile"
          @open="onLoadSavedProject"
          @remove="onRemoveSavedProject"
        />

        <div v-else class="workspace">
          <aside class="panel panel-left">
            <div class="panel-section panel-section-list">
              <AnnotationList
                :annotations="sortedAnnotations"
                :selected-ids="[...state.selectedAnnotationIds]"
                @select="selectAnnotation"
                @reorder="reorderAnnotations"
                @remove="(id) => removeAnnotations([id])"
              />
            </div>
            <div class="panel-section panel-section-annotation">
              <StylePanel
                :show-project="false"
                :show-annotation="true"
                :annotation="selectedAnnotation"
                :default-font-family="state.defaultFontFamily"
                :line-style="state.lineStyle"
                :line-width="state.lineWidth"
                :line-color="state.lineColor"
                :dot-radius="state.dotRadius"
                :anchor-style="state.anchorStyle"
                :line-halo-width="state.lineHaloWidth"
                :line-halo-color="state.lineHaloColor"
                :callout-font-size="state.calloutFontSize"
                :callout-border-enabled="state.calloutBorderEnabled"
                :callout-fill-enabled="state.calloutFillEnabled"
                :callout-fill-color="state.calloutFillColor"
                :callout-fill-opacity="state.calloutFillOpacity"
                :number-style="state.numberStyle"
                :image-width="state.imageWidth"
                :image-height="state.imageHeight"
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
            :line-style="state.lineStyle"
            :line-width="state.lineWidth"
            :line-color="state.lineColor"
            :dot-color="state.lineColor"
            :dot-radius="state.dotRadius"
            :anchor-style="state.anchorStyle"
            :line-halo-width="state.lineHaloWidth"
            :line-halo-color="state.lineHaloColor"
            :callout-font-size="state.calloutFontSize"
            :callout-border-width="effectiveCalloutBorderWidth"
            :callout-fill-enabled="state.calloutFillEnabled"
            :callout-fill-color="state.calloutFillColor"
            :callout-fill-opacity="state.calloutFillOpacity"
            :font-family="state.defaultFontFamily"
            :is-detecting="isDetecting"
            :empty-hint="state.sections.length === 0"
            @clear-selection="clearSelection"
            @select-section="selectSection"
            @select-annotation="selectAnnotation"
            @annotate-section="onAnnotateSection"
            @add-annotation-at="onAddAnnotationAt"
            @update-section-rect="updateSectionRect"
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
                :default-font-family="state.defaultFontFamily"
                :line-style="state.lineStyle"
                :line-width="state.lineWidth"
                :line-color="state.lineColor"
                :dot-radius="state.dotRadius"
                :anchor-style="state.anchorStyle"
                :line-halo-width="state.lineHaloWidth"
                :line-halo-color="state.lineHaloColor"
                :callout-font-size="state.calloutFontSize"
                :callout-border-enabled="state.calloutBorderEnabled"
                :callout-fill-enabled="state.calloutFillEnabled"
                :callout-fill-color="state.calloutFillColor"
                :callout-fill-opacity="state.calloutFillOpacity"
                :number-style="state.numberStyle"
                :image-width="state.imageWidth"
                :image-height="state.imageHeight"
                @update:default-font-family="setDefaultFontFamily"
                @update:line-style="setLineStyle"
                @update:line-width="setLineWidth"
                @update:line-color="setLineColor"
                @update:dot-radius="setDotRadius"
                @update:anchor-style="setAnchorStyle"
                @update:line-halo-width="setLineHaloWidth"
                @update:line-halo-color="setLineHaloColor"
                @update:callout-font-size="setCalloutFontSize"
                @update:callout-border-enabled="setCalloutBorderEnabled"
                @update:callout-fill-enabled="setCalloutFillEnabled"
                @update:callout-fill-color="setCalloutFillColor"
                @update:callout-fill-opacity="setCalloutFillOpacity"
                @update:number-style="setNumberStyle"
                @open-presets="onOpenCommonSettings"
              />
            </div>
          </aside>
        </div>
      </main>

      <ExportDialog :open="exportOpen" @close="exportOpen = false" @export="onExport" />
      <ProjectStorageDialog
        :open="projectStorageOpen"
        :has-image="hasImage"
        :projects="savedProjects"
        :is-busy="projectStorageBusy"
        :active-project-id="activeNamedProject?.id ?? null"
        :active-project-name="activeNamedProject?.name ?? null"
        @close="projectStorageOpen = false"
        @save="onSaveNamedProject"
        @overwrite="onOverwriteSavedProject"
        @load="onLoadSavedProject"
        @remove="onRemoveSavedProject"
      />
      <CommonSettingsDialog
        :open="commonSettingsOpen"
        :presets="commonSettingsPresets"
        :is-busy="commonSettingsBusy"
        @close="commonSettingsOpen = false"
        @save="onSaveCommonSettings"
        @overwrite="onOverwriteCommonSettings"
        @apply="onApplyCommonSettings"
        @remove="onRemoveCommonSettings"
      />
      <CropConfirmDialog
        :open="cropConfirmOpen"
        @close="closeCropConfirm"
        @as-new-project="confirmCropAsNewProject"
        @overwrite="confirmCropOverwrite"
      />
    </div>
  </div>
</template>

<style scoped>
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
