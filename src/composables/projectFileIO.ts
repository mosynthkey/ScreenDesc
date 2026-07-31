import { downloadBlob } from '../utils/export'
import {
  buildProjectBundleFile,
  buildProjectFile,
  contentHashFromSnapshot,
  ensureProjectContentHash,
  parseScreenDescFile,
  projectFileFieldsFromSnapshot,
  suggestProjectBundleFileName,
  suggestProjectFileName,
  type ProjectFileData,
} from '../utils/projectFile'
import {
  deleteNamedProject,
  listSavedProjects,
  loadAllNamedProjects,
  loadNamedProject,
  patchSavedProjectMeta,
  renameNamedProject,
  saveNamedProject,
  type ProjectSnapshot,
  type SavedProjectMeta,
} from '../utils/projectStorage'
import { isContentHash } from '../utils/contentHash'
import { t } from '../i18n'
import type { StoreCore } from '../stores/annotationStore'
import {
  buildCurrentSnapshot,
  clearNamedSaveSchedule,
  isNamedSaveDirty,
  markNamedSaveClean,
  persistActiveNamedProject,
  persistCurrentProject,
} from './projectPersistence'
import { renderThumbnailBlob } from './projectThumbnail'

async function snapshotFromProjectFile(data: ProjectFileData): Promise<ProjectSnapshot> {
  const imageBlob = await fetch(data.imageDataUrl).then((res) => res.blob())
  return {
    imageBlob,
    ...projectFileFieldsFromSnapshot(data),
  }
}

export async function saveProjectToFile(core: StoreCore): Promise<void> {
  const snapshot = await buildCurrentSnapshot(core)
  if (!snapshot) return
  const fileBlob = await buildProjectFile(
    snapshot.imageBlob,
    projectFileFieldsFromSnapshot(snapshot),
  )
  await downloadBlob(fileBlob, suggestProjectFileName())
}

export async function downloadAllProjectsBundle(core: StoreCore): Promise<number> {
  if (isNamedSaveDirty()) {
    await persistActiveNamedProject(core)
  }
  const loaded = await loadAllNamedProjects()
  if (loaded.length === 0) {
    throw new Error(t('error.projectBundleEmpty'))
  }
  const fileBlob = await buildProjectBundleFile(
    loaded.map(({ meta, snapshot }) => ({
      name: meta.name,
      updatedAt: meta.updatedAt,
      imageBlob: snapshot.imageBlob,
      fields: projectFileFieldsFromSnapshot(snapshot),
    })),
  )
  await downloadBlob(fileBlob, suggestProjectBundleFileName())
  return loaded.length
}

export type OpenProjectFileResult =
  | { kind: 'project' }
  | { kind: 'bundle'; imported: number; skipped: number }

async function collectExistingContentHashes(): Promise<Set<string>> {
  const metas = await listSavedProjects()
  const hashes = new Set<string>()
  for (const meta of metas) {
    if (isContentHash(meta.contentHash)) {
      hashes.add(meta.contentHash)
      continue
    }
    const snapshot = await loadNamedProject(meta.id)
    if (!snapshot) continue
    const hash = await contentHashFromSnapshot(snapshot)
    hashes.add(hash)
    await patchSavedProjectMeta(meta.id, { contentHash: hash })
  }
  return hashes
}

export async function openProjectFile(core: StoreCore, file: File): Promise<OpenProjectFileResult> {
  const { cropHistory, activeNamedProject } = core
  const parsed = await parseScreenDescFile(file)
  if (parsed.kind === 'bundle') {
    if (parsed.bundle.projects.length === 0) {
      throw new Error(t('error.projectBundleEmpty'))
    }
    const existingHashes = await collectExistingContentHashes()
    let imported = 0
    let skipped = 0
    for (const entry of parsed.bundle.projects) {
      const project = await ensureProjectContentHash(entry.project)
      const hash = project.contentHash!
      if (existingHashes.has(hash)) {
        skipped += 1
        continue
      }
      const name = entry.name.trim() || t('header.untitledProject')
      const snapshot = await snapshotFromProjectFile(project)
      await saveNamedProject(name, snapshot, undefined, hash)
      existingHashes.add(hash)
      imported += 1
    }
    return { kind: 'bundle', imported, skipped }
  }

  const snapshot = await snapshotFromProjectFile(parsed.project)
  if (cropHistory.value) {
    URL.revokeObjectURL(cropHistory.value.imageUrl)
    cropHistory.value = null
  }
  activeNamedProject.value = null
  clearNamedSaveSchedule()
  core.clearEditUndoStack()
  await core.applyRestoredSnapshot(snapshot.imageBlob, snapshot)
  return { kind: 'project' }
}

export async function saveProjectAs(
  core: StoreCore,
  name: string,
  overwriteId?: string,
): Promise<string | null> {
  const snapshot = await buildCurrentSnapshot(core)
  if (!snapshot) return null
  const contentHash = await contentHashFromSnapshot(snapshot)
  const thumbnail = await renderThumbnailBlob(core)
  const projectId = await saveNamedProject(
    name,
    snapshot,
    overwriteId,
    contentHash,
    thumbnail ?? undefined,
  )
  core.activeNamedProject.value = { id: projectId, name }
  markNamedSaveClean()
  await persistCurrentProject(core)
  return projectId
}

export async function setProjectName(core: StoreCore, rawName: string): Promise<void> {
  const name = rawName.trim()
  if (!name) return

  const active = core.activeNamedProject.value
  if (active) {
    if (active.name === name) return
    const renamed = await renameNamedProject(active.id, name)
    if (!renamed) {
      // Disk entry missing (e.g. ephemeral session); create under the new name.
      await saveProjectAs(core, name)
      return
    }
    core.activeNamedProject.value = { id: active.id, name }
    await persistCurrentProject(core)
    return
  }

  await saveProjectAs(core, name)
}

export async function fetchSavedProjects(): Promise<SavedProjectMeta[]> {
  return listSavedProjects()
}

export async function loadSavedProject(core: StoreCore, id: string): Promise<void> {
  const { cropHistory, activeNamedProject } = core
  const snapshot = await loadNamedProject(id)
  if (!snapshot) throw new Error(t('error.savedProjectNotFound'))
  const metas = await listSavedProjects()
  const meta = metas.find((item) => item.id === id)
  if (cropHistory.value) {
    URL.revokeObjectURL(cropHistory.value.imageUrl)
    cropHistory.value = null
  }
  clearNamedSaveSchedule()
  await core.applyRestoredSnapshot(snapshot.imageBlob, snapshot)
  activeNamedProject.value = { id, name: meta?.name ?? 'Project' }
  core.clearEditUndoStack()
  await persistCurrentProject(core)
}

export async function removeSavedProject(core: StoreCore, id: string): Promise<void> {
  await deleteNamedProject(id)
  if (core.activeNamedProject.value?.id === id) {
    core.activeNamedProject.value = null
    clearNamedSaveSchedule()
    await persistCurrentProject(core)
  }
}
