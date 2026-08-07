<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Toolbar from './components/Toolbar.vue'
import UploadZone from './components/UploadZone.vue'
import AnnotationCanvas from './components/AnnotationCanvas.vue'
import AnnotationList from './components/AnnotationList.vue'
import AnnotationStyleSettings from './components/AnnotationStyleSettings.vue'
import ProjectStyleSettings from './components/ProjectStyleSettings.vue'
import ExportDialog from './components/ExportDialog.vue'
import CommonSettingsDialog from './components/CommonSettingsDialog.vue'
import CropConfirmDialog from './components/CropConfirmDialog.vue'
import DeleteSavedProjectDialog from './components/DeleteSavedProjectDialog.vue'
import ReplaceDetectDialog from './components/ReplaceDetectDialog.vue'
import ImportStatusBanner from './components/ImportStatusBanner.vue'
import BundleImportDialog from './components/BundleImportDialog.vue'
import NavigationBar, { type AppPageId } from './components/NavigationBar.vue'
import { storeToRefs } from 'pinia'
import { useAnnotationStore } from './stores/annotationStore'
import type { ExportOptions, Point, Rect } from './types/annotation'
import type { ProjectFolder, SavedProjectMeta } from './utils/projectStorage'
import {
  createProjectFolder,
  deleteProjectFolder,
  listProjectFolders,
  moveNamedProject,
  moveProjectFolder,
  revealNamedProject,
  updateProjectFolder,
} from './utils/projectStorage'
import type { CommonSettingsPresetMeta } from './utils/commonSettings'
import { resolveCalloutBorderWidth } from './utils/commonSettings'
import { persistentStorage } from './utils/persistentStorage'
import { useI18n } from './i18n'
import type { BundleImportCandidate, OpenProjectFileResult } from './composables/projectFileIO'

const { t, tr } = useI18n()

const store = useAnnotationStore()
// Reactive state/getters need storeToRefs to survive destructuring; actions
// are plain functions and stay reactive whether destructured directly or not.
const {
  isDetecting,
  isRecognizingText,
  isExporting,
  ocrLines,
  modelStatus,
  modelDownloadProgress,
  modelError,
  modelAwaitingUse,
  hasImage,
  sortedAnnotations,
  canUndoCrop,
  activeNamedProject,
} = storeToRefs(store)
// `state` is a stable reactive object reference (not a ref), so a plain
// property read keeps it live without going through storeToRefs.
const { state } = store
const {
  loadModel,
  runSectionDetection,
  loadImageFile,
  replaceImageFile,
  flushPersistCurrentProject,
  rediscoverSectionsAfterReplace,
  clearCurrentProject,
  cropImage,
  undoCrop,
  undoEdit,
  redoEdit,
  addSection,
  setToolMode,
  setCropDraft,
  toggleSectionVisibility,
  clearSelection,
  selectSection,
  selectAnnotation,
  selectAllAnnotations,
  updateSectionRect,
  createAnnotationForSection,
  addAnnotationAtPoint,
  updateCalloutPosition,
  updateAnchorOffset,
  commitDescription,
  addVariation,
  setActiveVariation,
  nudgeCalloutPositions,
  removeAnnotations,
  reorderAnnotations,
  assignNumberPrefixes,
  clearNumberPrefixes,
  exportProject,
  copyAnnotatedImageToClipboard,
  saveProjectToFile,
  downloadAllProjectsBundle,
  openProjectFile,
  inspectProjectFile,
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
const replaceImageInputRef = ref<HTMLInputElement | null>(null)
const homeRef = ref<{ openFilePicker: () => void } | null>(null)
const appNotice = ref<{ message: string; tone: 'error' | 'info' } | null>(null)
let appNoticeTimer: ReturnType<typeof setTimeout> | undefined
const savedProjects = ref<SavedProjectMeta[]>([])
const projectFolders = ref<ProjectFolder[]>([])
const currentFolderId = ref<string | null>(null)
const projectStorageBusy = ref(false)
const commonSettingsOpen = ref(false)
const commonSettingsPresets = ref<CommonSettingsPresetMeta[]>([])
const commonSettingsBusy = ref(false)
const cropConfirmOpen = ref(false)
const pendingCropRect = ref<Rect | null>(null)
const replaceDetectOpen = ref(false)
const pendingDeleteProjectId = ref<string | null>(null)
const pendingDeleteProjectName = ref('')
const pendingDeleteProjectIsActive = ref(false)
const appPage = ref<AppPageId>('files')
const isImportingFile = ref(false)
const isInitialImageAnalysisRunning = ref(false)
const bundleImportFile = ref<File | null>(null)
const bundleImportCandidates = ref<BundleImportCandidate[]>([])
const bundleImportOpen = ref(false)

const ANNOTATION_PANE_STORAGE_KEY = 'screendesc.annotationPanePercent'
const ANNOTATION_PANE_MIN = 18
const ANNOTATION_PANE_MAX = 72
const ANNOTATION_PANE_DEFAULT = 42

function readAnnotationPanePercent(): number {
  try {
    const raw = persistentStorage.getItem(ANNOTATION_PANE_STORAGE_KEY)
    const value = Number(raw)
    if (Number.isFinite(value) && value >= ANNOTATION_PANE_MIN && value <= ANNOTATION_PANE_MAX) {
      return value
    }
  } catch {
    // Ignore storage errors (private mode, etc.).
  }
  return ANNOTATION_PANE_DEFAULT
}

const leftPanelRef = ref<HTMLElement | null>(null)
const annotationPanePercent = ref(readAnnotationPanePercent())
const isResizingLeftPane = ref(false)

function clampAnnotationPanePercent(value: number): number {
  return Math.min(ANNOTATION_PANE_MAX, Math.max(ANNOTATION_PANE_MIN, value))
}

function persistAnnotationPanePercent(value: number): void {
  try {
    persistentStorage.setItem(ANNOTATION_PANE_STORAGE_KEY, String(value))
  } catch {
    // Ignore storage errors.
  }
}

function onLeftPaneSplitterPointerDown(event: PointerEvent): void {
  if (event.button !== 0) return
  const panel = leftPanelRef.value
  if (!panel) return
  event.preventDefault()
  isResizingLeftPane.value = true
  const handle = event.currentTarget as HTMLElement
  handle.setPointerCapture(event.pointerId)

  const onPointerMove = (moveEvent: PointerEvent): void => {
    const rect = panel.getBoundingClientRect()
    if (rect.height <= 0) return
    const fromBottom = ((rect.bottom - moveEvent.clientY) / rect.height) * 100
    annotationPanePercent.value = clampAnnotationPanePercent(fromBottom)
  }

  const onPointerUp = (upEvent: PointerEvent): void => {
    handle.releasePointerCapture(upEvent.pointerId)
    handle.removeEventListener('pointermove', onPointerMove)
    handle.removeEventListener('pointerup', onPointerUp)
    handle.removeEventListener('pointercancel', onPointerUp)
    isResizingLeftPane.value = false
    persistAnnotationPanePercent(annotationPanePercent.value)
  }

  handle.addEventListener('pointermove', onPointerMove)
  handle.addEventListener('pointerup', onPointerUp)
  handle.addEventListener('pointercancel', onPointerUp)
}

const effectiveCalloutBorderWidth = computed(() =>
  resolveCalloutBorderWidth(state.calloutBorderEnabled, state.lineWidth),
)

const showToolDock = computed(() => hasImage.value && appPage.value === 'edit')
const modelReady = computed(() => modelStatus.value === 'ready')
const canOpenEdit = computed(() => hasImage.value)
const importBannerBlocking = computed(
  () =>
    isImportingFile.value ||
    (modelAwaitingUse.value && !modelReady.value && !isInitialImageAnalysisRunning.value),
)

function clearAppNotice(): void {
  appNotice.value = null
  if (appNoticeTimer) {
    clearTimeout(appNoticeTimer)
    appNoticeTimer = undefined
  }
}

function showAppNotice(message: string, tone: 'error' | 'info' = 'error'): void {
  clearAppNotice()
  appNotice.value = { message, tone }
  appNoticeTimer = setTimeout(() => {
    appNotice.value = null
    appNoticeTimer = undefined
  }, 5000)
}

function clearProjectLoadError(): void {
  clearAppNotice()
}

function showProjectLoadError(message: string): void {
  showAppNotice(message, 'error')
}

function goToPage(page: AppPageId): void {
  if (page === 'edit') {
    if (!hasImage.value) return
  }
  clearProjectLoadError()
  appPage.value = page
  if (page === 'files') void refreshProjectBrowser()
}

async function onFile(file: File): Promise<void> {
  const importStartedAt = performance.now()
  console.log('[image-import] started', { size: file.size, type: file.type })
  clearProjectLoadError()
  isImportingFile.value = true
  // Yield a frame so the loading spinner paints before the heavy work starts.
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  console.log('[image-import] loading indicator painted', {
    ms: Math.round(performance.now() - importStartedAt),
  })
  try {
    if (hasImage.value) {
      const saveStartedAt = performance.now()
      console.log('[image-import] saving current project…')
      await flushPersistCurrentProject()
      console.log('[image-import] current project saved', {
        ms: Math.round(performance.now() - saveStartedAt),
      })
    }

    const loadStartedAt = performance.now()
    console.log('[image-import] decoding image…')
    const { analysis } = await loadImageFile(file)
    console.log('[image-import] image decoded and canvas prepared', {
      ms: Math.round(performance.now() - loadStartedAt),
      totalMs: Math.round(performance.now() - importStartedAt),
    })

    appPage.value = 'edit'
    isImportingFile.value = false
    isInitialImageAnalysisRunning.value = true
    console.log('[image-import] switched to edit page', {
      totalMs: Math.round(performance.now() - importStartedAt),
    })
    await analysis
    if (currentFolderId.value) {
      await flushPersistCurrentProject()
      const projectId = activeNamedProject.value?.id
      if (projectId) await moveNamedProject(projectId, currentFolderId.value)
    }
    console.log('[image-import] background analysis completed', {
      totalMs: Math.round(performance.now() - importStartedAt),
    })
  } catch (err) {
    console.error('[image-import] failed', {
      totalMs: Math.round(performance.now() - importStartedAt),
      error: err,
    })
    showProjectLoadError(err instanceof Error ? err.message : t('error.imageReadFailed'))
  } finally {
    isImportingFile.value = false
    isInitialImageAnalysisRunning.value = false
  }
}

async function onWindowPaste(event: ClipboardEvent): Promise<void> {
  if (appPage.value !== 'files') return
  const items = event.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (!item.type.startsWith('image/')) continue
    const file = item.getAsFile()
    if (!file) return
    event.preventDefault()
    await onFile(file)
    return
  }
}

onMounted(() => {
  window.addEventListener('paste', onWindowPaste)
  void refreshProjectBrowser()
})
onBeforeUnmount(() => {
  window.removeEventListener('paste', onWindowPaste)
  if (copyFeedbackTimer) clearTimeout(copyFeedbackTimer)
  clearAppNotice()
})

// Only react to the image being cleared (→ back to the files list). Every
// path that loads an image (file open, paste, saved-project load) already
// navigates to 'edit' itself; auto-navigating here too would also fire for
// the silent autosave restore on startup and hijack the initial screen away
// from 'files'.
watch(hasImage, (open, wasOpen) => {
  if (open) return
  void refreshSavedProjects()
  if (wasOpen) appPage.value = 'files'
})

async function onRetryModelLoad(): Promise<void> {
  try {
    await loadModel()
    if (hasImage.value) await runSectionDetection()
  } catch {
    showAppNotice(t('status.modelLoadFailed'), 'error')
  }
}

async function onNewProject(): Promise<void> {
  if (!hasImage.value) {
    appPage.value = 'files'
    await nextTick()
    homeRef.value?.openFilePicker()
    return
  }
  clearProjectLoadError()
  projectStorageBusy.value = true
  try {
    await flushPersistCurrentProject()
    await clearCurrentProject()
    appPage.value = 'files'
    await refreshProjectBrowser()
    await nextTick()
    homeRef.value?.openFilePicker()
  } catch (err) {
    showProjectLoadError(err instanceof Error ? err.message : t('error.projectSaveFailed'))
  } finally {
    projectStorageBusy.value = false
  }
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

function onUpdateCropDraft(rect: Rect): void {
  setCropDraft(rect)
}

async function confirmCrop(): Promise<void> {
  const rect = state.cropDraft
  if (!rect) return
  await onCropImage(rect)
}

function cancelCrop(): void {
  setToolMode('select')
}

async function onExportProjectFile(): Promise<void> {
  await saveProjectToFile()
}

function onOpenImportProject(): void {
  projectFileInputRef.value?.click()
}

function onReplaceImage(): void {
  replaceImageInputRef.value?.click()
}

async function onReplaceImageChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  clearProjectLoadError()
  try {
    await replaceImageFile(file)
    replaceDetectOpen.value = true
  } catch (err) {
    showProjectLoadError(err instanceof Error ? err.message : t('error.imageReplaceFailed'))
  }
}

async function onConfirmReplaceDetect(): Promise<void> {
  replaceDetectOpen.value = false
  try {
    await rediscoverSectionsAfterReplace()
  } catch (err) {
    showProjectLoadError(err instanceof Error ? err.message : t('error.imageReplaceFailed'))
  }
}

async function onProjectFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  await importProjectFile(file)
}

async function importProjectFile(file: File): Promise<void> {
  clearProjectLoadError()
  projectStorageBusy.value = true
  try {
    const inspection = await inspectProjectFile(file)
    if (inspection.kind === 'bundle') {
      bundleImportFile.value = file
      bundleImportCandidates.value = inspection.candidates
      bundleImportOpen.value = true
      return
    }
    await openProjectFile(file)
    appPage.value = 'edit'
  } catch (err) {
    showProjectLoadError(err instanceof Error ? err.message : t('error.projectLoadFailed'))
  } finally {
    projectStorageBusy.value = false
  }
}

function closeBundleImport(): void {
  if (projectStorageBusy.value) return
  bundleImportOpen.value = false
  bundleImportFile.value = null
  bundleImportCandidates.value = []
}

function showBundleImportResult(result: Extract<OpenProjectFileResult, { kind: 'bundle' }>): void {
  if (result.skipped > 0 && result.imported > 0) {
    showAppNotice(
      t('status.bundleImportResult', { imported: result.imported, skipped: result.skipped }),
      'info',
    )
  } else if (result.skipped > 0) {
    showAppNotice(t('status.bundleImportSkippedAll', { skipped: result.skipped }), 'info')
  } else if (result.imported > 0) {
    showAppNotice(t('status.bundleImportOk', { imported: result.imported }), 'info')
  }
}

async function importSelectedBundle(indexes: number[]): Promise<void> {
  const file = bundleImportFile.value
  if (!file || indexes.length === 0) return
  projectStorageBusy.value = true
  try {
    const result = await openProjectFile(file, indexes)
    if (result.kind !== 'bundle') return
    bundleImportOpen.value = false
    bundleImportFile.value = null
    bundleImportCandidates.value = []
    await refreshProjectBrowser()
    appPage.value = 'files'
    showBundleImportResult(result)
  } catch (err) {
    showProjectLoadError(err instanceof Error ? err.message : t('error.projectLoadFailed'))
  } finally {
    projectStorageBusy.value = false
  }
}

async function onDownloadAllProjectsBundle(): Promise<void> {
  clearProjectLoadError()
  projectStorageBusy.value = true
  try {
    await downloadAllProjectsBundle()
  } catch (err) {
    showProjectLoadError(
      err instanceof Error ? err.message : tr('error.projectBundleDownloadFailed'),
    )
  } finally {
    projectStorageBusy.value = false
  }
}

async function refreshSavedProjects(): Promise<void> {
  savedProjects.value = await fetchSavedProjects()
}

async function refreshProjectBrowser(): Promise<void> {
  const [projects, folders] = await Promise.all([fetchSavedProjects(), listProjectFolders()])
  savedProjects.value = projects
  projectFolders.value = folders
  if (currentFolderId.value && !folders.some((folder) => folder.id === currentFolderId.value)) {
    currentFolderId.value = null
  }
}

async function onCreateFolder(name: string, color: string, parentId: string | null): Promise<void> {
  projectStorageBusy.value = true
  try {
    await createProjectFolder(name, color, parentId)
    await refreshProjectBrowser()
  } finally {
    projectStorageBusy.value = false
  }
}

async function onRenameFolder(id: string, name: string): Promise<void> {
  await updateProjectFolder(id, { name })
  await refreshProjectBrowser()
}

async function onRecolorFolder(id: string, color: string): Promise<void> {
  await updateProjectFolder(id, { color })
  await refreshProjectBrowser()
}

async function onRemoveFolder(id: string, deleteContents: boolean): Promise<void> {
  projectStorageBusy.value = true
  try {
    const deletedFolderIds = new Set([id])
    if (deleteContents) {
      let foundChild = true
      while (foundChild) {
        foundChild = false
        for (const folder of projectFolders.value) {
          if (
            folder.parentId &&
            deletedFolderIds.has(folder.parentId) &&
            !deletedFolderIds.has(folder.id)
          ) {
            deletedFolderIds.add(folder.id)
            foundChild = true
          }
        }
      }
    }
    const activeWillBeDeleted =
      deleteContents &&
      savedProjects.value.some(
        (project) =>
          project.id === activeNamedProject.value?.id &&
          Boolean(project.folderId && deletedFolderIds.has(project.folderId)),
      )
    await deleteProjectFolder(id, deleteContents)
    if (activeWillBeDeleted) {
      await clearCurrentProject()
      appPage.value = 'files'
    }
    await refreshProjectBrowser()
  } finally {
    projectStorageBusy.value = false
  }
}

async function onMoveProject(id: string, folderId: string | null): Promise<void> {
  await moveNamedProject(id, folderId)
  await refreshProjectBrowser()
}

async function onMoveFolder(id: string, parentId: string | null): Promise<void> {
  const moved = await moveProjectFolder(id, parentId)
  if (!moved) showAppNotice(t('folder.invalidMove'), 'error')
  await refreshProjectBrowser()
}

async function onDuplicateProject(): Promise<void> {
  if (!hasImage.value) return
  clearProjectLoadError()
  projectStorageBusy.value = true
  try {
    await flushPersistCurrentProject()
    const projects = await fetchSavedProjects()
    const source = projects.find((project) => project.id === activeNamedProject.value?.id)
    const sourceName = activeNamedProject.value?.name?.trim() || t('header.untitledProject')
    const existingNames = new Set(projects.map((project) => project.name))
    let copyName = t('project.copyName', { name: sourceName })
    let copyNumber = 2
    while (existingNames.has(copyName)) {
      copyName = t('project.copyNameNumbered', { name: sourceName, number: copyNumber })
      copyNumber += 1
    }
    const projectId = await saveProjectAs(copyName)
    if (projectId && source?.folderId) await moveNamedProject(projectId, source.folderId)
    await refreshProjectBrowser()
  } catch (err) {
    showProjectLoadError(err instanceof Error ? err.message : t('error.projectSaveFailed'))
  } finally {
    projectStorageBusy.value = false
  }
}

async function onRenameProject(name: string): Promise<void> {
  try {
    await setProjectName(name)
    await refreshSavedProjects()
  } catch (err) {
    showAppNotice(
      err instanceof Error ? err.message : t('error.projectRenameFailed'),
      'error',
    )
  }
}

async function onRevealSavedProject(id: string): Promise<void> {
  try {
    await revealNamedProject(id)
  } catch (err) {
    showAppNotice(
      err instanceof Error ? err.message : t('error.projectRevealFailed'),
      'error',
    )
  }
}

async function onLoadSavedProject(id: string): Promise<void> {
  projectStorageBusy.value = true
  clearProjectLoadError()
  try {
    await loadSavedProject(id)
    appPage.value = 'edit'
  } catch (err) {
    const message = err instanceof Error ? err.message : t('error.projectLoadFailed')
    showProjectLoadError(message)
    if (message === t('error.savedProjectNotFound')) {
      try {
        await removeSavedProject(id)
        await refreshSavedProjects()
      } catch {
        // Keep the toast; files list refresh is best-effort.
      }
    }
  } finally {
    projectStorageBusy.value = false
  }
}

function onRemoveSavedProject(id: string): void {
  const target = savedProjects.value.find((item) => item.id === id)
  pendingDeleteProjectId.value = id
  pendingDeleteProjectName.value = target?.name?.trim() || t('header.untitledProject')
  pendingDeleteProjectIsActive.value = activeNamedProject.value?.id === id
}

function closeDeleteSavedProject(): void {
  pendingDeleteProjectId.value = null
  pendingDeleteProjectName.value = ''
  pendingDeleteProjectIsActive.value = false
}

async function confirmDeleteSavedProject(): Promise<void> {
  const id = pendingDeleteProjectId.value
  if (!id) return
  const isActiveProject = pendingDeleteProjectIsActive.value
  closeDeleteSavedProject()
  projectStorageBusy.value = true
  try {
    await removeSavedProject(id)
    if (isActiveProject) {
      await clearCurrentProject()
      appPage.value = 'files'
    }
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

function onKeydown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
  if (appPage.value !== 'edit' || !hasImage.value) return

  if ((event.metaKey || event.ctrlKey) && !event.altKey && (event.key === 'z' || event.key === 'Z')) {
    event.preventDefault()
    if (event.shiftKey) redoEdit()
    else undoEdit()
    return
  }

  if (event.ctrlKey && !event.metaKey && !event.altKey && (event.key === 'y' || event.key === 'Y')) {
    event.preventDefault()
    redoEdit()
    return
  }

  if ((event.metaKey || event.ctrlKey) && !event.altKey && (event.key === 'a' || event.key === 'A')) {
    event.preventDefault()
    selectAllAnnotations()
    return
  }

  if (state.toolMode === 'crop') {
    if (event.key === 'Enter') {
      event.preventDefault()
      void confirmCrop()
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      cancelCrop()
      return
    }
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
      :edit-available="canOpenEdit"
      @navigate="goToPage"
    />

    <ImportStatusBanner
      :blocking="importBannerBlocking"
      :status="modelStatus"
      :progress="modelDownloadProgress"
      :error-message="modelError"
      :is-detecting="isDetecting"
      :is-recognizing-text="isRecognizingText"
      @retry="onRetryModelLoad"
    />

    <div class="app-column">
      <Toolbar
        :page="appPage"
        :project-title="activeNamedProject?.name ?? null"
        :tool-mode="state.toolMode"
        :section-visibility="state.sectionVisibility"
        :is-detecting="isDetecting"
        :is-recognizing-text="isRecognizingText"
        :can-export="hasImage && !isExporting"
        :copy-just-succeeded="copyJustSucceeded"
        :has-image="hasImage"
        :show-tool-dock="showToolDock"
        :can-undo-crop="canUndoCrop"
        :variations="[...state.variations]"
        :active-variation="state.activeVariation"
        @update:tool-mode="setToolMode"
        @toggle-section-visibility="toggleSectionVisibility"
        @copy-clipboard="onCopyClipboard"
        @export="exportOpen = true"
        @undo-crop="onUndoCrop"
        @duplicate-project="onDuplicateProject"
        @export-project-file="onExportProjectFile"
        @open-import-project="onOpenImportProject"
        @replace-image="onReplaceImage"
        @new-project="onNewProject"
        @rename-project="onRenameProject"
        @confirm-crop="confirmCrop"
        @cancel-crop="cancelCrop"
        @update:active-variation="setActiveVariation"
        @add-variation="addVariation"
      />

      <input
        ref="projectFileInputRef"
        type="file"
        accept=".screendesc,.screendesc.json,.screendesc-bundle.json,.json,application/json"
        hidden
        @change="onProjectFileChange"
      />
      <input
        ref="replaceImageInputRef"
        type="file"
        accept="image/*"
        hidden
        @change="onReplaceImageChange"
      />
      <div
        v-if="appNotice"
        class="app-notice"
        :class="appNotice.tone === 'info' ? 'is-info' : 'is-error'"
        :role="appNotice.tone === 'error' ? 'alert' : 'status'"
      >
        <span>{{ appNotice.message }}</span>
        <button
          class="app-notice-dismiss"
          type="button"
          :aria-label="t('error.dismiss')"
          @click="clearAppNotice"
        >
          ×
        </button>
      </div>

      <main class="app-main" :class="{ 'is-files': appPage === 'files' }">
        <UploadZone
          v-if="appPage === 'files'"
          ref="homeRef"
          :projects="savedProjects"
          :folders="projectFolders"
          :current-folder-id="currentFolderId"
          :active-project-id="activeNamedProject?.id ?? null"
          :is-busy="projectStorageBusy"
          @file="onFile"
          @import-project="importProjectFile"
          @open="onLoadSavedProject"
          @remove="onRemoveSavedProject"
          @download-bundle="onDownloadAllProjectsBundle"
          @reveal="onRevealSavedProject"
          @navigate-folder="currentFolderId = $event"
          @create-folder="onCreateFolder"
          @rename-folder="onRenameFolder"
          @recolor-folder="onRecolorFolder"
          @remove-folder="onRemoveFolder"
          @move-project="onMoveProject"
          @move-folder="onMoveFolder"
        />

        <div v-else class="workspace">
          <aside
            ref="leftPanelRef"
            class="panel panel-left"
            :class="{ 'is-resizing-pane': isResizingLeftPane }"
          >
            <div class="panel-section panel-section-list">
              <AnnotationList
                :annotations="sortedAnnotations"
                :selected-ids="[...state.selectedAnnotationIds]"
                :active-variation="state.activeVariation"
                @select="selectAnnotation"
                @reorder="reorderAnnotations"
                @assign-numbers="assignNumberPrefixes"
                @clear-numbers="clearNumberPrefixes"
                @remove="(id) => removeAnnotations([id])"
              />
            </div>
            <div
              class="panel-splitter"
              role="separator"
              aria-orientation="horizontal"
              :aria-valuenow="Math.round(annotationPanePercent)"
              :aria-valuemin="ANNOTATION_PANE_MIN"
              :aria-valuemax="ANNOTATION_PANE_MAX"
              :aria-label="t('annotationList.resizePane')"
              :title="t('annotationList.resizePane')"
              tabindex="0"
              @pointerdown="onLeftPaneSplitterPointerDown"
            />
            <div
              class="panel-section panel-section-annotation"
              :style="{ flex: `0 0 ${annotationPanePercent}%` }"
            >
              <AnnotationStyleSettings />
            </div>
          </aside>

          <AnnotationCanvas
            :image-url="state.imageUrl!"
            :document="state.document"
            :sections="[...state.sections]"
            :annotations="[...state.annotations]"
            :active-variation="state.activeVariation"
            :callout-layouts="state.calloutLayouts.map((item) => ({ ...item, lines: [...item.lines] }))"
            :selected-section-ids="[...state.selectedSectionIds]"
            :selected-annotation-ids="[...state.selectedAnnotationIds]"
            :tool-mode="state.toolMode"
            :section-visibility="state.sectionVisibility"
            :ocr-lines="[...ocrLines]"
            :line-style="state.lineStyle"
            :line-width="state.lineWidth"
            :line-dash-length="state.lineDashLength"
            :line-dash-gap="state.lineDashGap"
            :line-color="state.lineColor"
            :dot-color="state.lineColor"
            :dot-radius="state.dotRadius"
            :anchor-style="state.anchorStyle"
            :line-halo-width="state.lineHaloWidth"
            :line-halo-color="state.lineHaloColor"
            :highlight-margin="state.highlightMargin"
            :highlight-fill-enabled="state.highlightFillEnabled"
            :highlight-fill-opacity="state.highlightFillOpacity"
            :highlight-corner-radius="state.highlightCornerRadius"
            :callout-font-size="state.calloutFontSize"
            :callout-font-weight="state.calloutFontWeight"
            :callout-font-italic="state.calloutFontItalic"
            :callout-text-color="state.calloutTextColor"
            :callout-border-width="effectiveCalloutBorderWidth"
            :callout-fill-enabled="state.calloutFillEnabled"
            :callout-fill-color="state.calloutFillColor"
            :callout-fill-opacity="state.calloutFillOpacity"
            :callout-corner-radius="state.calloutCornerRadius"
            :page-background-color="state.pageBackgroundColor"
            :font-family="state.defaultFontFamily"
            :is-detecting="isDetecting"
            :empty-hint="state.sections.length === 0"
            :crop-draft="state.cropDraft"
            @clear-selection="clearSelection"
            @select-section="selectSection"
            @select-annotation="selectAnnotation"
            @annotate-section="onAnnotateSection"
            @add-annotation-at="onAddAnnotationAt"
            @update-section-rect="updateSectionRect"
            @update-callout-position="updateCalloutPosition"
            @nudge-callout-positions="nudgeCalloutPositions"
            @update-anchor-offset="updateAnchorOffset"
            @add-section="onAddSection"
            @commit-description="commitDescription"
            @crop-image="onCropImage"
            @update-crop-draft="onUpdateCropDraft"
          />

          <aside class="panel">
            <div class="panel-section">
              <ProjectStyleSettings @open-presets="onOpenCommonSettings" />
            </div>
          </aside>
        </div>
      </main>

      <ExportDialog :open="exportOpen" @close="exportOpen = false" @export="onExport" />
      <BundleImportDialog
        :open="bundleImportOpen"
        :candidates="bundleImportCandidates"
        :is-busy="projectStorageBusy"
        @close="closeBundleImport"
        @import="importSelectedBundle"
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
      <DeleteSavedProjectDialog
        :open="pendingDeleteProjectId !== null"
        :project-name="pendingDeleteProjectName"
        :is-active-project="pendingDeleteProjectIsActive"
        @close="closeDeleteSavedProject"
        @confirm="confirmDeleteSavedProject"
      />
      <ReplaceDetectDialog
        :open="replaceDetectOpen"
        @close="replaceDetectOpen = false"
        @confirm="onConfirmReplaceDetect"
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

.panel-left.is-resizing-pane {
  cursor: row-resize;
  user-select: none;
}

.panel-section-list {
  flex: 1 1 0;
  min-height: 72px;
  overflow: auto;
  border-bottom: none;
  padding-left: 0;
  padding-right: 0;
}

.panel-splitter {
  flex: 0 0 7px;
  position: relative;
  z-index: 2;
  margin: 0;
  border: none;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  background: rgba(120, 120, 128, 0.08);
  cursor: row-resize;
  touch-action: none;
}

.panel-splitter::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 28px;
  height: 3px;
  border-radius: 999px;
  background: rgba(120, 120, 128, 0.35);
  transform: translate(-50%, -50%);
}

.panel-splitter:hover,
.panel-left.is-resizing-pane .panel-splitter {
  background: var(--accent-soft);
}

.panel-splitter:hover::after,
.panel-left.is-resizing-pane .panel-splitter::after {
  background: var(--accent);
}

.panel-splitter:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.panel-section-annotation {
  min-height: 96px;
  overflow: auto;
  border-bottom: none;
  border-top: none;
}

.app-notice {
  position: fixed;
  top: 64px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: min(520px, calc(100vw - 32px));
  border-radius: 10px;
  padding: 8px 10px 8px 14px;
  font-size: 0.82rem;
  font-weight: 590;
  box-shadow: var(--shadow);
}

.app-notice.is-error {
  background: var(--danger-soft);
  color: var(--danger);
  border: 1px solid rgba(255, 59, 48, 0.3);
}

.app-notice.is-info {
  background: var(--accent-soft);
  color: var(--accent-strong);
  border: 1px solid rgba(0, 122, 255, 0.28);
}

.app-notice-dismiss {
  flex: 0 0 auto;
  margin: 0;
  padding: 0 6px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
}

.app-notice.is-error .app-notice-dismiss:hover {
  background: rgba(255, 59, 48, 0.12);
}

.app-notice.is-info .app-notice-dismiss:hover {
  background: rgba(0, 122, 255, 0.12);
}
</style>
