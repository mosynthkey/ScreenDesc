import type {
  Annotation,
  LineStyleId,
  NumberStyleId,
  Section,
} from '../types/annotation'
import type { OcrLineHit } from './ocr'

const DB_NAME = 'screendesc'
const DB_VERSION = 2
const AUTOSAVE_STORE = 'project'
const AUTOSAVE_KEY = 'current'
const SAVED_META_STORE = 'savedProjectsMeta'
const SAVED_DATA_STORE = 'savedProjectsData'

export interface ProjectSnapshot {
  imageBlob: Blob
  imageWidth: number
  imageHeight: number
  sections: Section[]
  annotations: Annotation[]
  ocrLines: OcrLineHit[]
  defaultFontFamily: string
  lineStyle: LineStyleId
  lineWidth: number
  lineColor: string
  dotColor: string
  dotRadius: number
  lineHaloWidth: number
  lineHaloColor: string
  calloutFontSize: number
  calloutBorderWidth: number
  numberStyle: NumberStyleId
  showSections: boolean
  /** When set, edits auto-overwrite this named browser save. */
  activeNamedProjectId?: string | null
  activeNamedProjectName?: string | null
}

export interface SavedProjectMeta {
  id: string
  name: string
  updatedAt: number
}

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
): Promise<string> {
  const projectId = id ?? crypto.randomUUID()
  const payload = toCloneableSnapshot(snapshot)
  const meta: SavedProjectMeta = {
    id: projectId,
    name,
    updatedAt: Date.now(),
  }
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([SAVED_META_STORE, SAVED_DATA_STORE], 'readwrite')
    tx.objectStore(SAVED_META_STORE).put(meta)
    tx.objectStore(SAVED_DATA_STORE).put(payload, projectId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
  return projectId
}

export async function listSavedProjects(): Promise<SavedProjectMeta[]> {
  const db = await openDb()
  const metas = await new Promise<SavedProjectMeta[]>((resolve, reject) => {
    const tx = db.transaction(SAVED_META_STORE, 'readonly')
    const request = tx.objectStore(SAVED_META_STORE).getAll()
    request.onsuccess = () => resolve((request.result as SavedProjectMeta[]) ?? [])
    request.onerror = () => reject(request.error)
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

export async function loadNamedProjectImageBlob(id: string): Promise<Blob | null> {
  const snapshot = await loadNamedProject(id)
  return snapshot?.imageBlob ?? null
}

export async function deleteNamedProject(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([SAVED_META_STORE, SAVED_DATA_STORE], 'readwrite')
    tx.objectStore(SAVED_META_STORE).delete(id)
    tx.objectStore(SAVED_DATA_STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}
