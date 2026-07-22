import { watch } from 'vue'
import {
  clearAutosavedProject,
  loadProject,
  saveNamedProject,
  saveProject,
  type ProjectSnapshot,
} from '../utils/projectStorage'
import {
  activeNamedProject,
  applyRestoredSnapshot,
  ocrLines,
  sanitizeAnnotation,
  state,
} from './annotationStoreCore'

let restored = false
let saveTimer: ReturnType<typeof setTimeout> | null = null
let namedSaveTimer: ReturnType<typeof setTimeout> | null = null
let namedSaveDirty = false
const SESSION_SAVE_DEBOUNCE_MS = 600
const NAMED_SAVE_DEBOUNCE_MS = 2500
const NAMED_SAVE_INTERVAL_MS = 30_000

export async function buildCurrentSnapshot(): Promise<ProjectSnapshot | null> {
  if (!state.imageUrl) return null
  const imageBlob = await fetch(state.imageUrl).then((res) => res.blob())
  return {
    imageBlob,
    imageWidth: state.imageWidth,
    imageHeight: state.imageHeight,
    sections: state.sections,
    annotations: state.annotations.map(sanitizeAnnotation),
    ocrLines: ocrLines.value,
    defaultFontFamily: state.defaultFontFamily,
    lineStyle: state.lineStyle,
    lineWidth: state.lineWidth,
    lineColor: state.lineColor,
    dotColor: state.lineColor,
    dotRadius: state.dotRadius,
    anchorStyle: state.anchorStyle,
    lineHaloWidth: state.lineHaloWidth,
    lineHaloColor: state.lineHaloColor,
    calloutFontSize: state.calloutFontSize,
    calloutBorderEnabled: state.calloutBorderEnabled,
    calloutFillEnabled: state.calloutFillEnabled,
    calloutFillColor: state.calloutFillColor,
    calloutFillOpacity: state.calloutFillOpacity,
    pageBackgroundColor: state.pageBackgroundColor,
    numberStyle: state.numberStyle,
    showSections: state.showSections,
    activeNamedProjectId: activeNamedProject.value?.id ?? null,
    activeNamedProjectName: activeNamedProject.value?.name ?? null,
  }
}

export async function persistCurrentProject(): Promise<void> {
  try {
    const snapshot = await buildCurrentSnapshot()
    if (!snapshot) return
    await saveProject(snapshot)
  } catch (err) {
    console.warn('[ScreenDesc] failed to persist project', err)
  }
}

export async function persistActiveNamedProject(): Promise<void> {
  const active = activeNamedProject.value
  if (!active || !state.imageUrl) return
  try {
    const snapshot = await buildCurrentSnapshot()
    if (!snapshot) return
    await saveNamedProject(active.name, snapshot, active.id)
    namedSaveDirty = false
  } catch (err) {
    console.warn('[ScreenDesc] failed to auto-overwrite named project', err)
  }
}

export function scheduleSave(): void {
  if (!restored || !state.imageUrl) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    void persistCurrentProject()
  }, SESSION_SAVE_DEBOUNCE_MS)

  if (!activeNamedProject.value) return
  namedSaveDirty = true
  if (namedSaveTimer) clearTimeout(namedSaveTimer)
  namedSaveTimer = setTimeout(() => {
    void persistActiveNamedProject()
  }, NAMED_SAVE_DEBOUNCE_MS)
}

export function clearNamedSaveSchedule(): void {
  if (namedSaveTimer) {
    clearTimeout(namedSaveTimer)
    namedSaveTimer = null
  }
  namedSaveDirty = false
}

export function clearSessionSaveSchedule(): void {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
}

export function markNamedSaveClean(): void {
  namedSaveDirty = false
  if (namedSaveTimer) {
    clearTimeout(namedSaveTimer)
    namedSaveTimer = null
  }
}

export function isNamedSaveDirty(): boolean {
  return namedSaveDirty
}

export async function clearAutosaveStorage(): Promise<void> {
  try {
    await clearAutosavedProject()
  } catch (err) {
    console.warn('[ScreenDesc] failed to clear autosaved project', err)
  }
}

async function restorePersistedProject(): Promise<void> {
  try {
    const snapshot = await loadProject()
    if (!snapshot) return
    await applyRestoredSnapshot(snapshot.imageBlob, snapshot)
    if (snapshot.activeNamedProjectId && snapshot.activeNamedProjectName) {
      activeNamedProject.value = {
        id: snapshot.activeNamedProjectId,
        name: snapshot.activeNamedProjectName,
      }
    }
  } catch (err) {
    console.warn('[ScreenDesc] failed to restore persisted project', err)
  } finally {
    restored = true
  }
}

void restorePersistedProject()

watch(
  () => [
    state.imageUrl,
    state.sections,
    state.annotations,
    state.defaultFontFamily,
    state.lineStyle,
    state.lineWidth,
    state.lineColor,
    state.dotColor,
    state.dotRadius,
    state.anchorStyle,
    state.lineHaloWidth,
    state.lineHaloColor,
    state.calloutFontSize,
    state.calloutBorderEnabled,
    state.calloutFillEnabled,
    state.calloutFillColor,
    state.calloutFillOpacity,
    state.pageBackgroundColor,
    state.numberStyle,
    state.showSections,
  ],
  () => scheduleSave(),
  { deep: true },
)

if (typeof window !== 'undefined') {
  window.setInterval(() => {
    if (!namedSaveDirty || !activeNamedProject.value || !state.imageUrl) return
    void persistActiveNamedProject()
  }, NAMED_SAVE_INTERVAL_MS)
}
