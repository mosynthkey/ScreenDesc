import { watch } from 'vue'
import {
  clearAutosavedProject,
  deleteNamedProject,
  loadProject,
  saveNamedProject,
  saveProject,
  type ProjectSnapshot,
} from '../utils/projectStorage'
import { contentHashFromSnapshot } from '../utils/projectFile'
import { defaultProjectName } from '../utils/projectName'
import { renderThumbnailBlob } from './projectThumbnail'
import type { StoreCore } from '../stores/annotationStore'

let restored = false
let saveTimer: ReturnType<typeof setTimeout> | null = null
let namedSaveTimer: ReturnType<typeof setTimeout> | null = null
let namedSaveDirty = false
const SESSION_SAVE_DEBOUNCE_MS = 600
const NAMED_SAVE_DEBOUNCE_MS = 2500
const NAMED_SAVE_INTERVAL_MS = 30_000

export async function buildCurrentSnapshot(core: StoreCore): Promise<ProjectSnapshot | null> {
  const { state } = core
  if (!state.imageUrl) return null
  const imageBlob = await fetch(state.imageUrl).then((res) => res.blob())
  return {
    imageBlob,
    imageWidth: state.imageWidth,
    imageHeight: state.imageHeight,
    sections: state.sections,
    annotations: state.annotations.map(core.sanitizeAnnotation),
    ocrLines: core.ocrLines.value,
    defaultFontFamily: state.defaultFontFamily,
    lineStyle: state.lineStyle,
    lineWidth: state.lineWidth,
    lineDashLength: state.lineDashLength,
    lineDashGap: state.lineDashGap,
    lineColor: state.lineColor,
    dotColor: state.lineColor,
    dotRadius: state.dotRadius,
    imageGutter: state.imageGutter,
    highlightMargin: state.highlightMargin,
    highlightFillEnabled: state.highlightFillEnabled,
    highlightFillOpacity: state.highlightFillOpacity,
    highlightCornerRadius: state.highlightCornerRadius,
    anchorStyle: state.anchorStyle,
    lineHaloWidth: state.lineHaloWidth,
    lineHaloColor: state.lineHaloColor,
    calloutFontSize: state.calloutFontSize,
    calloutFontWeight: state.calloutFontWeight,
    calloutFontItalic: state.calloutFontItalic,
    calloutTextColor: state.calloutTextColor,
    calloutBorderEnabled: state.calloutBorderEnabled,
    calloutFillEnabled: state.calloutFillEnabled,
    calloutFillColor: state.calloutFillColor,
    calloutFillOpacity: state.calloutFillOpacity,
    calloutCornerRadius: state.calloutCornerRadius,
    pageBackgroundColor: state.pageBackgroundColor,
    sectionVisibility: { ...state.sectionVisibility },
    variations: [...state.variations],
    activeNamedProjectId: core.activeNamedProject.value?.id ?? null,
    activeNamedProjectName: core.activeNamedProject.value?.name ?? null,
  }
}

export async function persistCurrentProject(core: StoreCore): Promise<void> {
  try {
    const snapshot = await buildCurrentSnapshot(core)
    if (!snapshot) return
    await saveProject(snapshot)
  } catch (err) {
    console.warn('[ScreenDesc] failed to persist project', err)
  }
}

/**
 * @param withThumbnail Re-renders the annotated thumbnail too. Costly (font
 * loading + SVG rasterization), so callers only pass true at natural
 * settle points (leaving the project), not on the frequent edit-debounce path.
 */
export async function persistActiveNamedProject(core: StoreCore, withThumbnail = false): Promise<void> {
  const { activeNamedProject, state } = core
  if (!activeNamedProject.value || !state.imageUrl) return
  try {
    const snapshot = await buildCurrentSnapshot(core)
    if (!snapshot) return
    // Re-read after awaits so a rename during snapshot build is not overwritten.
    const active = activeNamedProject.value
    if (!active) return
    const contentHash = await contentHashFromSnapshot(snapshot)
    const thumbnail = withThumbnail ? await renderThumbnailBlob(core) : undefined
    const latest = activeNamedProject.value
    if (!latest || latest.id !== active.id) return
    await saveNamedProject(latest.name, snapshot, latest.id, contentHash, thumbnail ?? undefined)
    namedSaveDirty = false
  } catch (err) {
    console.warn('[ScreenDesc] failed to auto-overwrite named project', err)
  }
}

let ensuringNamedProject = false

/** Give untitled work a date-based name so it appears with other saved files. */
export async function ensureActiveNamedProject(core: StoreCore): Promise<void> {
  const { activeNamedProject, state } = core
  if (!state.imageUrl || activeNamedProject.value || ensuringNamedProject) return
  ensuringNamedProject = true
  try {
    const snapshot = await buildCurrentSnapshot(core)
    if (!snapshot || activeNamedProject.value) return
    const name = defaultProjectName()
    const contentHash = await contentHashFromSnapshot(snapshot)
    const thumbnail = await renderThumbnailBlob(core)
    const projectId = await saveNamedProject(
      name,
      snapshot,
      undefined,
      contentHash,
      thumbnail ?? undefined,
    )
    // Re-read via .value after awaits; TS control-flow still thinks it is null here.
    const concurrent = activeNamedProject.value as { id: string; name: string } | null
    if (concurrent) {
      if (concurrent.id !== projectId) {
        await deleteNamedProject(projectId).catch(() => {})
      }
      return
    }
    activeNamedProject.value = { id: projectId, name }
    namedSaveDirty = false
    await persistCurrentProject(core)
  } catch (err) {
    console.warn('[ScreenDesc] failed to auto-name untitled project', err)
  } finally {
    ensuringNamedProject = false
  }
}

/** Flush pending debounced saves before leaving the current project. */
export async function flushPersistCurrentProject(core: StoreCore): Promise<void> {
  clearSessionSaveSchedule()
  clearNamedSaveSchedule()
  if (!core.state.imageUrl) return
  await ensureActiveNamedProject(core)
  await persistActiveNamedProject(core, true)
  await persistCurrentProject(core)
}

export function scheduleSave(core: StoreCore): void {
  if (!restored || !core.state.imageUrl) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    void (async () => {
      await ensureActiveNamedProject(core)
      await persistCurrentProject(core)
    })()
  }, SESSION_SAVE_DEBOUNCE_MS)

  namedSaveDirty = true
  if (namedSaveTimer) clearTimeout(namedSaveTimer)
  namedSaveTimer = setTimeout(() => {
    void (async () => {
      await ensureActiveNamedProject(core)
      await persistActiveNamedProject(core)
    })()
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

async function restorePersistedProject(core: StoreCore): Promise<void> {
  try {
    const snapshot = await loadProject()
    if (!snapshot) return
    await core.applyRestoredSnapshot(snapshot.imageBlob, snapshot)
    if (snapshot.activeNamedProjectId && snapshot.activeNamedProjectName) {
      core.activeNamedProject.value = {
        id: snapshot.activeNamedProjectId,
        name: snapshot.activeNamedProjectName,
      }
    }
  } catch (err) {
    console.warn('[ScreenDesc] failed to restore persisted project', err)
  } finally {
    restored = true
    if (core.state.imageUrl) scheduleSave(core)
  }
}

/**
 * One-time setup called from the store's own setup(): restores the last
 * autosaved project, then watches for edits to keep it (and the active
 * named project) saved. Not itself a store action — the store calls this
 * once after its state/actions exist, rather than every consumer having to
 * remember to.
 */
export function initializePersistence(core: StoreCore): void {
  const { state } = core

  watch(
    () => [
      state.imageUrl,
      state.sections,
      state.annotations,
      state.defaultFontFamily,
      state.lineStyle,
      state.lineWidth,
      state.lineDashLength,
      state.lineDashGap,
      state.lineColor,
      state.dotColor,
      state.dotRadius,
      state.imageGutter,
      state.highlightMargin,
      state.highlightFillEnabled,
      state.highlightFillOpacity,
      state.highlightCornerRadius,
      state.anchorStyle,
      state.lineHaloWidth,
      state.lineHaloColor,
      state.calloutFontSize,
      state.calloutFontWeight,
      state.calloutFontItalic,
      state.calloutTextColor,
      state.calloutBorderEnabled,
      state.calloutFillEnabled,
      state.calloutFillColor,
      state.calloutFillOpacity,
      state.calloutCornerRadius,
      state.pageBackgroundColor,
      state.sectionVisibility,
      state.variations,
    ],
    () => scheduleSave(core),
    { deep: true },
  )

  if (typeof window !== 'undefined') {
    window.setInterval(() => {
      if (!namedSaveDirty || !state.imageUrl) return
      void (async () => {
        await ensureActiveNamedProject(core)
        await persistActiveNamedProject(core)
      })()
    }, NAMED_SAVE_INTERVAL_MS)
  }

  void restorePersistedProject(core)
}
