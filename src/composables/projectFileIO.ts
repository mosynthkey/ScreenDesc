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
  createProjectFolder,
  listProjectFolders,
  listSavedProjects,
  loadAllNamedProjects,
  loadNamedProject,
  patchSavedProjectMeta,
  moveNamedProject,
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
  const folders = await listProjectFolders()
  if (loaded.length === 0) {
    throw new Error(t('error.projectBundleEmpty'))
  }
  const fileBlob = await buildProjectBundleFile(
    loaded.map(({ meta, snapshot }) => ({
      name: meta.name,
      updatedAt: meta.updatedAt,
      folderId: meta.folderId ?? null,
      imageBlob: snapshot.imageBlob,
      fields: projectFileFieldsFromSnapshot(snapshot),
    })),
    folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      color: folder.color,
      parentId: folder.parentId,
    })),
  )
  await downloadBlob(fileBlob, suggestProjectBundleFileName())
  return loaded.length
}

export type OpenProjectFileResult =
  | { kind: 'project' }
  | { kind: 'bundle'; imported: number; skipped: number }

export interface BundleImportCandidate {
  index: number
  name: string
  folderPath: string
  duplicate: boolean
}

export type ProjectFileInspection =
  | { kind: 'project' }
  | { kind: 'bundle'; candidates: BundleImportCandidate[] }

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

export async function inspectProjectFile(file: File): Promise<ProjectFileInspection> {
  const parsed = await parseScreenDescFile(file)
  if (parsed.kind === 'project') return { kind: 'project' }
  if (parsed.bundle.projects.length === 0) throw new Error(t('error.projectBundleEmpty'))

  const existingHashes = await collectExistingContentHashes()
  const foldersById = new Map((parsed.bundle.folders ?? []).map((folder) => [folder.id, folder]))
  const folderPath = (folderId: string | null | undefined): string => {
    const names: string[] = []
    const visited = new Set<string>()
    let currentId = folderId ?? null
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId)
      const folder = foldersById.get(currentId)
      if (!folder) break
      names.unshift(folder.name)
      currentId = folder.parentId
    }
    return names.join(' / ')
  }

  const candidates: BundleImportCandidate[] = []
  const hashesInBundle = new Set<string>()
  for (const [index, entry] of parsed.bundle.projects.entries()) {
    const project = await ensureProjectContentHash(entry.project)
    const hash = project.contentHash!
    const duplicate = existingHashes.has(hash) || hashesInBundle.has(hash)
    hashesInBundle.add(hash)
    candidates.push({
      index,
      name: entry.name.trim() || t('header.untitledProject'),
      folderPath: folderPath(entry.folderId),
      duplicate,
    })
  }
  return { kind: 'bundle', candidates }
}

export async function openProjectFile(
  core: StoreCore,
  file: File,
  selectedBundleIndexes?: number[],
): Promise<OpenProjectFileResult> {
  const { cropHistory, activeNamedProject } = core
  const parsed = await parseScreenDescFile(file)
  if (parsed.kind === 'bundle') {
    if (parsed.bundle.projects.length === 0) {
      throw new Error(t('error.projectBundleEmpty'))
    }
    const existingHashes = await collectExistingContentHashes()
    const selectedIndexes = new Set(
      selectedBundleIndexes ?? parsed.bundle.projects.map((_, index) => index),
    )
    const importableEntries: Array<{
      index: number
      entry: (typeof parsed.bundle.projects)[number]
      project: Awaited<ReturnType<typeof ensureProjectContentHash>>
      hash: string
    }> = []
    let skipped = 0
    for (const [index, entry] of parsed.bundle.projects.entries()) {
      if (!selectedIndexes.has(index)) continue
      const project = await ensureProjectContentHash(entry.project)
      const hash = project.contentHash!
      if (existingHashes.has(hash)) {
        skipped += 1
        continue
      }
      existingHashes.add(hash)
      importableEntries.push({ index, entry, project, hash })
    }

    const foldersById = new Map((parsed.bundle.folders ?? []).map((folder) => [folder.id, folder]))
    const requiredFolderIds = new Set<string>()
    for (const { entry } of importableEntries) {
      let folderId = entry.folderId ?? null
      while (folderId && !requiredFolderIds.has(folderId)) {
        requiredFolderIds.add(folderId)
        folderId = foldersById.get(folderId)?.parentId ?? null
      }
    }
    const folderIdMap = new Map<string, string>()
    const pendingFolders = (parsed.bundle.folders ?? []).filter((folder) =>
      requiredFolderIds.has(folder.id),
    )
    while (pendingFolders.length > 0) {
      const readyIndex = pendingFolders.findIndex(
        (folder) => !folder.parentId || folderIdMap.has(folder.parentId),
      )
      const index = readyIndex >= 0 ? readyIndex : 0
      const [folder] = pendingFolders.splice(index, 1)
      const created = await createProjectFolder(
        folder.name,
        folder.color,
        folder.parentId ? (folderIdMap.get(folder.parentId) ?? null) : null,
      )
      folderIdMap.set(folder.id, created.id)
    }
    let imported = 0
    for (const { entry, project, hash } of importableEntries) {
      const name = entry.name.trim() || t('header.untitledProject')
      const snapshot = await snapshotFromProjectFile(project)
      const projectId = await saveNamedProject(name, snapshot, undefined, hash)
      const folderId = entry.folderId ? folderIdMap.get(entry.folderId) : null
      if (folderId) await moveNamedProject(projectId, folderId)
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
