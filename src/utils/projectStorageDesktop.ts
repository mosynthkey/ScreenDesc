import type { ProjectFolder, ProjectSnapshot, SavedProjectMeta } from './projectStorageTypes'
import { buildProjectSearchText } from './projectSearch'

export type { ProjectFolder, ProjectSnapshot, SavedProjectMeta }

const API_PREFIX = '/__screendesc/storage'

interface StoredSnapshot {
  imageMimeType: string
  imageBase64: string
  imageWidth: number
  imageHeight: number
  sections: ProjectSnapshot['sections']
  annotations: ProjectSnapshot['annotations']
  ocrLines: ProjectSnapshot['ocrLines']
  defaultFontFamily: string
  lineStyle: ProjectSnapshot['lineStyle']
  lineWidth: number
  lineDashLength: number
  lineDashGap: number
  lineColor: string
  dotColor: string
  dotRadius: number
  imageGutter: number
  highlightMargin: number
  highlightFillEnabled: boolean
  highlightFillOpacity: number
  highlightCornerRadius: number
  anchorStyle: ProjectSnapshot['anchorStyle']
  lineHaloWidth: number
  lineHaloColor: string
  calloutFontSize: number
  calloutFontWeight: number
  calloutFontItalic: boolean
  calloutTextColor: string
  calloutBorderEnabled: boolean
  calloutFillEnabled: boolean
  calloutFillColor: string
  calloutFillOpacity: number
  calloutCornerRadius: number
  pageBackgroundColor: string
  sectionVisibility: ProjectSnapshot['sectionVisibility']
  variations: string[]
  activeNamedProjectId?: string | null
  activeNamedProjectName?: string | null
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

async function snapshotToStored(snapshot: ProjectSnapshot): Promise<StoredSnapshot> {
  const buffer = await snapshot.imageBlob.arrayBuffer()
  const {
    imageBlob: _imageBlob,
    ...fields
  } = snapshot
  return {
    ...fields,
    imageMimeType: snapshot.imageBlob.type || 'application/octet-stream',
    imageBase64: bytesToBase64(new Uint8Array(buffer)),
  }
}

function storedToSnapshot(stored: StoredSnapshot): ProjectSnapshot {
  const { imageBase64, imageMimeType, ...fields } = stored
  const bytes = base64ToBytes(imageBase64)
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return {
    ...fields,
    imageBlob: new Blob([copy], { type: imageMimeType || 'application/octet-stream' }),
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_PREFIX}${path}`, init)
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    let message = detail
    try {
      const parsed = JSON.parse(detail) as { error?: string }
      if (parsed.error) message = parsed.error
    } catch {
      // keep raw body
    }
    throw new Error(`Desktop storage ${path} failed (${response.status}): ${message}`)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export async function saveProject(snapshot: ProjectSnapshot): Promise<void> {
  const body = await snapshotToStored(snapshot)
  await requestJson('/autosave', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function loadProject(): Promise<ProjectSnapshot | null> {
  const response = await fetch(`${API_PREFIX}/autosave`)
  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`Desktop storage /autosave failed (${response.status})`)
  }
  return storedToSnapshot((await response.json()) as StoredSnapshot)
}

export async function clearAutosavedProject(): Promise<void> {
  const response = await fetch(`${API_PREFIX}/autosave`, { method: 'DELETE' })
  if (!response.ok && response.status !== 404) {
    throw new Error(`Desktop storage clear autosave failed (${response.status})`)
  }
}

export async function saveNamedProject(
  name: string,
  snapshot: ProjectSnapshot,
  id?: string,
  contentHash?: string,
  thumbnail?: Blob,
): Promise<string> {
  const body = {
    id,
    name,
    contentHash,
    searchText: buildProjectSearchText(snapshot),
    snapshot: await snapshotToStored(snapshot),
    // Omitted means "leave the previously stored thumbnail untouched".
    thumbnailBase64: thumbnail
      ? bytesToBase64(new Uint8Array(await thumbnail.arrayBuffer()))
      : undefined,
  }
  const result = await requestJson<{ id: string }>('/projects', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return result.id
}

export async function patchSavedProjectMeta(
  id: string,
  patch: Partial<Pick<SavedProjectMeta, 'contentHash' | 'name' | 'folderId'>>,
): Promise<boolean> {
  const response = await fetch(`${API_PREFIX}/projects/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (response.status === 404) return false
  if (!response.ok) {
    throw new Error(`Desktop storage patch meta failed (${response.status})`)
  }
  return true
}

export async function listSavedProjects(): Promise<SavedProjectMeta[]> {
  return requestJson<SavedProjectMeta[]>('/projects')
}

export async function loadNamedProject(id: string): Promise<ProjectSnapshot | null> {
  const response = await fetch(`${API_PREFIX}/projects/${encodeURIComponent(id)}`)
  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`Desktop storage load project failed (${response.status})`)
  }
  return storedToSnapshot((await response.json()) as StoredSnapshot)
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
  const response = await fetch(`${API_PREFIX}/projects/${encodeURIComponent(id)}/image`)
  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`Desktop storage load image failed (${response.status})`)
  }
  return response.blob()
}

export async function loadNamedProjectThumbnail(id: string): Promise<Blob | null> {
  const response = await fetch(`${API_PREFIX}/projects/${encodeURIComponent(id)}/thumbnail`)
  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`Desktop storage load thumbnail failed (${response.status})`)
  }
  return response.blob()
}

export async function renameNamedProject(id: string, name: string): Promise<boolean> {
  const trimmed = name.trim()
  if (!trimmed) return false
  return patchSavedProjectMeta(id, { name: trimmed })
}

export async function deleteNamedProject(id: string): Promise<void> {
  const response = await fetch(`${API_PREFIX}/projects/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  if (!response.ok && response.status !== 404) {
    throw new Error(`Desktop storage delete failed (${response.status})`)
  }
}

export async function revealNamedProject(id: string): Promise<void> {
  await requestJson(`/projects/${encodeURIComponent(id)}/reveal`, { method: 'POST' })
}

export async function listProjectFolders(): Promise<ProjectFolder[]> {
  return requestJson<ProjectFolder[]>('/folders')
}

export async function createProjectFolder(
  name: string,
  color: string,
  parentId: string | null,
): Promise<ProjectFolder> {
  return requestJson<ProjectFolder>('/folders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, color, parentId }),
  })
}

export async function updateProjectFolder(
  id: string,
  patch: Partial<Pick<ProjectFolder, 'name' | 'color'>>,
): Promise<boolean> {
  const response = await fetch(`${API_PREFIX}/folders/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (response.status === 404) return false
  if (!response.ok) throw new Error(`Desktop folder update failed (${response.status})`)
  return true
}

export async function deleteProjectFolder(id: string, deleteContents = false): Promise<boolean> {
  const response = await fetch(`${API_PREFIX}/folders/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deleteContents }),
  })
  if (response.status === 404) return false
  if (!response.ok) throw new Error(`Desktop folder delete failed (${response.status})`)
  return true
}

export async function moveNamedProject(id: string, folderId: string | null): Promise<boolean> {
  return patchSavedProjectMeta(id, { folderId })
}

export async function moveProjectFolder(id: string, parentId: string | null): Promise<boolean> {
  const response = await fetch(`${API_PREFIX}/folders/${encodeURIComponent(id)}/move`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ parentId }),
  })
  if (response.status === 404 || response.status === 409) return false
  if (!response.ok) throw new Error(`Desktop folder move failed (${response.status})`)
  return true
}

/**
 * Prompt a native save dialog and write the exported file to the chosen
 * path. The webview has no delegate to complete a browser-style
 * `<a download>` navigation, so downloads silently never finish otherwise.
 * Returns null if the user canceled the dialog.
 */
export async function saveExportedFile(blob: Blob, filename: string): Promise<string | null> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const result = await requestJson<{ path: string | null; canceled: boolean }>('/export', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ filename, base64: bytesToBase64(bytes) }),
  })
  return result.canceled ? null : result.path
}
