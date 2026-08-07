import type { ProjectFolder, ProjectSnapshot, SavedProjectMeta } from './projectStorageTypes'
import { buildProjectSearchText } from './projectSearch'

const DB_NAME = 'screendesc'
const DB_VERSION = 4
const AUTOSAVE_STORE = 'project'
const AUTOSAVE_KEY = 'current'
const SAVED_META_STORE = 'savedProjectsMeta'
const SAVED_DATA_STORE = 'savedProjectsData'
const SAVED_THUMB_STORE = 'savedProjectsThumbs'
const FOLDER_STORE = 'projectFolders'

export type { ProjectFolder, ProjectSnapshot, SavedProjectMeta }

/** Strip Vue proxies so structured clone (IndexedDB) accepts the snapshot. */
function toCloneableSnapshot(snapshot: ProjectSnapshot): ProjectSnapshot {
  const { imageBlob, ...fields } = snapshot
  return {
    imageBlob,
    ...(JSON.parse(JSON.stringify(fields)) as Omit<ProjectSnapshot, 'imageBlob'>),
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(AUTOSAVE_STORE)) {
        db.createObjectStore(AUTOSAVE_STORE)
      }
      if (!db.objectStoreNames.contains(SAVED_META_STORE)) {
        db.createObjectStore(SAVED_META_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(SAVED_DATA_STORE)) {
        db.createObjectStore(SAVED_DATA_STORE)
      }
      if (!db.objectStoreNames.contains(SAVED_THUMB_STORE)) {
        db.createObjectStore(SAVED_THUMB_STORE)
      }
      if (!db.objectStoreNames.contains(FOLDER_STORE)) {
        db.createObjectStore(FOLDER_STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveProject(snapshot: ProjectSnapshot): Promise<void> {
  const payload = toCloneableSnapshot(snapshot)
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(AUTOSAVE_STORE, 'readwrite')
    tx.objectStore(AUTOSAVE_STORE).put(payload, AUTOSAVE_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function loadProject(): Promise<ProjectSnapshot | null> {
  const db = await openDb()
  const result = await new Promise<ProjectSnapshot | null>((resolve, reject) => {
    const tx = db.transaction(AUTOSAVE_STORE, 'readonly')
    const request = tx.objectStore(AUTOSAVE_STORE).get(AUTOSAVE_KEY)
    request.onsuccess = () => resolve((request.result as ProjectSnapshot | undefined) ?? null)
    request.onerror = () => reject(request.error)
  })
  db.close()
  return result
}

export async function clearAutosavedProject(): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(AUTOSAVE_STORE, 'readwrite')
    tx.objectStore(AUTOSAVE_STORE).delete(AUTOSAVE_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function saveNamedProject(
  name: string,
  snapshot: ProjectSnapshot,
  id?: string,
  contentHash?: string,
  thumbnail?: Blob,
): Promise<string> {
  const projectId = id ?? crypto.randomUUID()
  const payload = toCloneableSnapshot(snapshot)
  const db = await openDb()
  const existing = id
    ? await new Promise<SavedProjectMeta | undefined>((resolve, reject) => {
        const tx = db.transaction(SAVED_META_STORE, 'readonly')
        const request = tx.objectStore(SAVED_META_STORE).get(id)
        request.onsuccess = () => resolve(request.result as SavedProjectMeta | undefined)
        request.onerror = () => reject(request.error)
      })
    : undefined
  const meta: SavedProjectMeta = {
    id: projectId,
    name,
    updatedAt: Date.now(),
    contentHash,
    folderId: existing?.folderId ?? null,
    searchText: buildProjectSearchText(snapshot),
  }
  await new Promise<void>((resolve, reject) => {
    const stores = thumbnail
      ? [SAVED_META_STORE, SAVED_DATA_STORE, SAVED_THUMB_STORE]
      : [SAVED_META_STORE, SAVED_DATA_STORE]
    const tx = db.transaction(stores, 'readwrite')
    tx.objectStore(SAVED_META_STORE).put(meta)
    tx.objectStore(SAVED_DATA_STORE).put(payload, projectId)
    // When omitted, leave any previously stored thumbnail untouched.
    if (thumbnail) tx.objectStore(SAVED_THUMB_STORE).put(thumbnail, projectId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
  return projectId
}

export async function patchSavedProjectMeta(
  id: string,
  patch: Partial<Pick<SavedProjectMeta, 'contentHash' | 'name' | 'folderId'>>,
): Promise<boolean> {
  const db = await openDb()
  const updated = await new Promise<boolean>((resolve, reject) => {
    const tx = db.transaction(SAVED_META_STORE, 'readwrite')
    const store = tx.objectStore(SAVED_META_STORE)
    const request = store.get(id)
    let found = false
    request.onsuccess = () => {
      const existing = request.result as SavedProjectMeta | undefined
      if (!existing) return
      found = true
      store.put({
        ...existing,
        ...patch,
      })
    }
    tx.oncomplete = () => resolve(found)
    tx.onerror = () => reject(tx.error)
  })
  db.close()
  return updated
}

export async function listSavedProjects(): Promise<SavedProjectMeta[]> {
  const db = await openDb()
  const metas = await new Promise<SavedProjectMeta[]>((resolve, reject) => {
    const tx = db.transaction([SAVED_META_STORE, SAVED_DATA_STORE], 'readwrite')
    const metaStore = tx.objectStore(SAVED_META_STORE)
    const dataStore = tx.objectStore(SAVED_DATA_STORE)
    const request = metaStore.getAll()
    let result: SavedProjectMeta[] = []
    request.onsuccess = () => {
      result = (request.result as SavedProjectMeta[]) ?? []
      for (const meta of result) {
        if (typeof meta.searchText === 'string') continue
        const snapshotRequest = dataStore.get(meta.id)
        snapshotRequest.onsuccess = () => {
          const snapshot = snapshotRequest.result as ProjectSnapshot | undefined
          meta.searchText = snapshot ? buildProjectSearchText(snapshot) : ''
          metaStore.put(meta)
        }
      }
    }
    tx.oncomplete = () => resolve(result)
    tx.onerror = () => reject(tx.error)
  })
  db.close()
  return metas.sort((left, right) => right.updatedAt - left.updatedAt)
}

export async function loadNamedProject(id: string): Promise<ProjectSnapshot | null> {
  const db = await openDb()
  const result = await new Promise<ProjectSnapshot | null>((resolve, reject) => {
    const tx = db.transaction(SAVED_DATA_STORE, 'readonly')
    const request = tx.objectStore(SAVED_DATA_STORE).get(id)
    request.onsuccess = () => resolve((request.result as ProjectSnapshot | undefined) ?? null)
    request.onerror = () => reject(request.error)
  })
  db.close()
  return result
}

export async function loadAllNamedProjects(): Promise<
  Array<{ meta: SavedProjectMeta; snapshot: ProjectSnapshot }>
> {
  const metas = await listSavedProjects()
  const loaded: Array<{ meta: SavedProjectMeta; snapshot: ProjectSnapshot }> = []
  for (const meta of metas) {
    const snapshot = await loadNamedProject(meta.id)
    if (snapshot) loaded.push({ meta, snapshot })
  }
  return loaded
}

export async function loadNamedProjectImageBlob(id: string): Promise<Blob | null> {
  const snapshot = await loadNamedProject(id)
  return snapshot?.imageBlob ?? null
}

export async function loadNamedProjectThumbnail(id: string): Promise<Blob | null> {
  const db = await openDb()
  const result = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(SAVED_THUMB_STORE, 'readonly')
    const request = tx.objectStore(SAVED_THUMB_STORE).get(id)
    request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null)
    request.onerror = () => reject(request.error)
  })
  db.close()
  return result
}

export async function renameNamedProject(id: string, name: string): Promise<boolean> {
  const trimmed = name.trim()
  if (!trimmed) return false

  const db = await openDb()
  const updated = await new Promise<boolean>((resolve, reject) => {
    const tx = db.transaction(SAVED_META_STORE, 'readwrite')
    const store = tx.objectStore(SAVED_META_STORE)
    const request = store.get(id)
    let found = false
    request.onsuccess = () => {
      const existing = request.result as SavedProjectMeta | undefined
      if (!existing) return
      found = true
      store.put({
        ...existing,
        name: trimmed,
        updatedAt: Date.now(),
      })
    }
    tx.oncomplete = () => resolve(found)
    tx.onerror = () => reject(tx.error)
  })
  db.close()
  return updated
}

export async function deleteNamedProject(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(
      [SAVED_META_STORE, SAVED_DATA_STORE, SAVED_THUMB_STORE],
      'readwrite',
    )
    tx.objectStore(SAVED_META_STORE).delete(id)
    tx.objectStore(SAVED_DATA_STORE).delete(id)
    tx.objectStore(SAVED_THUMB_STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function revealNamedProject(_id: string): Promise<void> {
  throw new Error('Reveal in file manager is only available in the desktop app')
}

export async function listProjectFolders(): Promise<ProjectFolder[]> {
  const db = await openDb()
  const folders = await new Promise<ProjectFolder[]>((resolve, reject) => {
    const tx = db.transaction(FOLDER_STORE, 'readonly')
    const request = tx.objectStore(FOLDER_STORE).getAll()
    request.onsuccess = () => resolve((request.result as ProjectFolder[]) ?? [])
    request.onerror = () => reject(request.error)
  })
  db.close()
  return folders
}

export async function createProjectFolder(
  name: string,
  color: string,
  parentId: string | null,
): Promise<ProjectFolder> {
  const now = Date.now()
  const folder: ProjectFolder = {
    id: crypto.randomUUID(),
    name: name.trim(),
    color,
    parentId,
    createdAt: now,
    updatedAt: now,
  }
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(FOLDER_STORE, 'readwrite')
    tx.objectStore(FOLDER_STORE).put(folder)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
  return folder
}

export async function updateProjectFolder(
  id: string,
  patch: Partial<Pick<ProjectFolder, 'name' | 'color'>>,
): Promise<boolean> {
  const db = await openDb()
  const updated = await new Promise<boolean>((resolve, reject) => {
    const tx = db.transaction(FOLDER_STORE, 'readwrite')
    const store = tx.objectStore(FOLDER_STORE)
    const request = store.get(id)
    let found = false
    request.onsuccess = () => {
      const existing = request.result as ProjectFolder | undefined
      if (!existing) return
      found = true
      store.put({ ...existing, ...patch, updatedAt: Date.now() })
    }
    tx.oncomplete = () => resolve(found)
    tx.onerror = () => reject(tx.error)
  })
  db.close()
  return updated
}

export async function moveNamedProject(id: string, folderId: string | null): Promise<boolean> {
  return patchSavedProjectMeta(id, { folderId })
}

export async function moveProjectFolder(id: string, parentId: string | null): Promise<boolean> {
  const folders = await listProjectFolders()
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  let ancestorId = parentId
  while (ancestorId) {
    if (ancestorId === id) return false
    ancestorId = byId.get(ancestorId)?.parentId ?? null
  }
  const db = await openDb()
  const moved = await new Promise<boolean>((resolve, reject) => {
    const tx = db.transaction(FOLDER_STORE, 'readwrite')
    const store = tx.objectStore(FOLDER_STORE)
    const request = store.get(id)
    let found = false
    request.onsuccess = () => {
      const existing = request.result as ProjectFolder | undefined
      if (!existing) return
      found = true
      store.put({ ...existing, parentId, updatedAt: Date.now() })
    }
    tx.oncomplete = () => resolve(found)
    tx.onerror = () => reject(tx.error)
  })
  db.close()
  return moved
}

export async function deleteProjectFolder(id: string, deleteContents = false): Promise<boolean> {
  const folders = await listProjectFolders()
  const target = folders.find((folder) => folder.id === id)
  if (!target) return false
  const deletedFolderIds = new Set([id])
  if (deleteContents) {
    let foundChild = true
    while (foundChild) {
      foundChild = false
      for (const folder of folders) {
        if (folder.parentId && deletedFolderIds.has(folder.parentId) && !deletedFolderIds.has(folder.id)) {
          deletedFolderIds.add(folder.id)
          foundChild = true
        }
      }
    }
  }
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(
      [FOLDER_STORE, SAVED_META_STORE, SAVED_DATA_STORE, SAVED_THUMB_STORE],
      'readwrite',
    )
    const folderStore = tx.objectStore(FOLDER_STORE)
    const projectStore = tx.objectStore(SAVED_META_STORE)
    for (const folderId of deletedFolderIds) folderStore.delete(folderId)
    for (const child of folders) {
      if (!deleteContents && child.parentId === id) {
        folderStore.put({ ...child, parentId: null, updatedAt: Date.now() })
      }
    }
    const request = projectStore.getAll()
    request.onsuccess = () => {
      for (const project of request.result as SavedProjectMeta[]) {
        if (!project.folderId || !deletedFolderIds.has(project.folderId)) continue
        if (deleteContents) {
          projectStore.delete(project.id)
          tx.objectStore(SAVED_DATA_STORE).delete(project.id)
          tx.objectStore(SAVED_THUMB_STORE).delete(project.id)
        } else {
          projectStore.put({ ...project, folderId: null })
        }
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
  return true
}
