'use strict'

const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')
const { dialog, shell } = require('electron')

const API_PREFIX = '/__screendesc/storage'

function homeDir() {
  // GUI-launched .app bundles often omit HOME from the process environment.
  const home = process.env.HOME || process.env.USERPROFILE || os.homedir()
  if (!home) throw new Error('Cannot resolve home directory')
  return home
}

function documentsRoot() {
  return path.join(homeDir(), 'Documents', 'ScreenDesc')
}

function autosaveDir(root) {
  return path.join(root, 'autosave')
}

function projectsDir(root) {
  return path.join(root, 'projects')
}

function projectDir(root, id) {
  return path.join(projectsDir(root), id)
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

async function readJson(targetPath) {
  if (!(await exists(targetPath))) return null
  try {
    return JSON.parse(await fs.readFile(targetPath, 'utf8'))
  } catch (error) {
    console.error('[ScreenDesc desktop storage] invalid JSON:', targetPath, error)
    return null
  }
}

async function writeJson(targetPath, value) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, JSON.stringify(value))
}

async function writeSnapshotFiles(dir, snapshot) {
  await fs.mkdir(dir, { recursive: true })
  const { imageBase64, imageMimeType, ...fields } = snapshot
  await writeJson(path.join(dir, 'data.json'), { ...fields, imageMimeType })
  await fs.writeFile(path.join(dir, 'image.bin'), Buffer.from(imageBase64, 'base64'))
}

/** Omit thumbnailBase64 to leave a previously stored thumbnail untouched. */
async function writeThumbnailFile(dir, thumbnailBase64) {
  if (!thumbnailBase64) return
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, 'thumbnail.png'), Buffer.from(thumbnailBase64, 'base64'))
}

async function readSnapshotFiles(dir) {
  const dataPath = path.join(dir, 'data.json')
  const imagePath = path.join(dir, 'image.bin')
  if (!(await exists(dataPath)) || !(await exists(imagePath))) return null
  const data = await readJson(dataPath)
  if (!data) return null
  const imageBytes = await fs.readFile(imagePath)
  return {
    ...data,
    imageBase64: imageBytes.toString('base64'),
  }
}

async function listMetas(root) {
  const dir = projectsDir(root)
  if (!(await exists(dir))) return []
  const metas = []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const meta = await readJson(path.join(dir, entry.name, 'meta.json'))
    if (meta && meta.id) metas.push(meta)
  }
  return metas.sort((left, right) => right.updatedAt - left.updatedAt)
}

/** Reveal a named project folder in the OS file manager. */
async function revealProjectById(projectId) {
  const root = documentsRoot()
  const metaPath = path.join(projectDir(root, projectId), 'meta.json')
  if (!(await exists(metaPath))) {
    throw new Error(`Project not found: ${projectId}`)
  }
  shell.showItemInFolder(metaPath)
}

function jsonResponse(res, body, status = 200) {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(payload)
}

function emptyResponse(res, status) {
  res.writeHead(status)
  res.end()
}

function binaryResponse(res, bytes, contentType) {
  res.writeHead(200, { 'content-type': contentType })
  res.end(bytes)
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks)
}

async function readBodyJson(req) {
  const buffer = await readBody(req)
  return buffer.length ? JSON.parse(buffer.toString('utf8')) : {}
}

const EXPORT_FILTERS = {
  png: [{ name: 'PNG Image', extensions: ['png'] }],
  svg: [{ name: 'SVG Image', extensions: ['svg'] }],
  json: [{ name: 'ScreenDesc Project', extensions: ['screendesc.json', 'json'] }],
}

function filtersForFilename(filename) {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.png')) return EXPORT_FILTERS.png
  if (lower.endsWith('.svg')) return EXPORT_FILTERS.svg
  return [...EXPORT_FILTERS.json, { name: 'All Files', extensions: ['*'] }]
}

/** Prompt a native save dialog, then write `bytes` to the chosen path. Returns null if canceled. */
async function saveWithDialog(browserWindow, filename, bytes) {
  const { canceled, filePath } = await dialog.showSaveDialog(browserWindow, {
    defaultPath: filename,
    filters: filtersForFilename(filename),
  })
  if (canceled || !filePath) return null
  await fs.writeFile(filePath, bytes)
  return filePath
}

/**
 * Handle a `/__screendesc/storage/*` request. Returns true if handled (response written),
 * false if the path is outside this API's prefix.
 */
async function handleStorageRequest(req, res, url, browserWindow) {
  if (!url.pathname.startsWith(API_PREFIX)) return false

  const subPath = url.pathname.slice(API_PREFIX.length) // e.g. /autosave, /projects, /projects/:id
  const method = req.method || 'GET'

  try {
    const root = documentsRoot()
    await fs.mkdir(root, { recursive: true })

    if (subPath === '/settings' && method === 'GET') {
      const settings = await readJson(path.join(root, 'settings.json'))
      jsonResponse(res, settings ?? {})
      return true
    }
    if (subPath === '/settings' && method === 'PUT') {
      const settings = await readBodyJson(req)
      await writeJson(path.join(root, 'settings.json'), settings)
      emptyResponse(res, 204)
      return true
    }

    if (subPath === '/autosave' && method === 'GET') {
      const snapshot = await readSnapshotFiles(autosaveDir(root))
      if (snapshot) jsonResponse(res, snapshot)
      else emptyResponse(res, 404)
      return true
    }
    if (subPath === '/autosave' && method === 'PUT') {
      const snapshot = await readBodyJson(req)
      await writeSnapshotFiles(autosaveDir(root), snapshot)
      emptyResponse(res, 204)
      return true
    }
    if (subPath === '/autosave' && method === 'DELETE') {
      await fs.rm(autosaveDir(root), { recursive: true, force: true })
      emptyResponse(res, 204)
      return true
    }

    if (subPath === '/export' && method === 'POST') {
      const body = await readBodyJson(req)
      // Never trust a client-supplied filename as a path: take the basename only.
      const safeFilename = path.basename(body.filename)
      const bytes = Buffer.from(body.base64, 'base64')
      const savedPath = await saveWithDialog(browserWindow, safeFilename, bytes)
      jsonResponse(res, { path: savedPath, canceled: savedPath === null })
      return true
    }

    if (subPath === '/projects' && method === 'GET') {
      jsonResponse(res, await listMetas(root))
      return true
    }

    if (subPath === '/projects' && method === 'PUT') {
      const body = await readBodyJson(req)
      const projectId = body.id || crypto.randomUUID()
      const dir = projectDir(root, projectId)
      const meta = {
        id: projectId,
        name: body.name,
        updatedAt: Date.now(),
        contentHash: body.contentHash,
      }
      await writeSnapshotFiles(dir, body.snapshot)
      await writeThumbnailFile(dir, body.thumbnailBase64)
      await writeJson(path.join(dir, 'meta.json'), meta)
      jsonResponse(res, { id: projectId })
      return true
    }

    const projectMatch = subPath.match(/^\/projects\/([^/]+)(\/(image|thumbnail|reveal))?$/)
    if (projectMatch) {
      const projectId = decodeURIComponent(projectMatch[1])
      const subResource = projectMatch[3] || null
      const dir = projectDir(root, projectId)

      if (subResource === 'image' && method === 'GET') {
        const imagePath = path.join(dir, 'image.bin')
        const data = await readJson(path.join(dir, 'data.json'))
        if (!(await exists(imagePath))) {
          emptyResponse(res, 404)
          return true
        }
        const bytes = await fs.readFile(imagePath)
        binaryResponse(res, bytes, (data && data.imageMimeType) || 'application/octet-stream')
        return true
      }

      if (subResource === 'thumbnail' && method === 'GET') {
        const thumbnailPath = path.join(dir, 'thumbnail.png')
        if (!(await exists(thumbnailPath))) {
          emptyResponse(res, 404)
          return true
        }
        const bytes = await fs.readFile(thumbnailPath)
        binaryResponse(res, bytes, 'image/png')
        return true
      }

      if (subResource === 'reveal' && method === 'POST') {
        try {
          await revealProjectById(projectId)
        } catch {
          emptyResponse(res, 404)
          return true
        }
        emptyResponse(res, 204)
        return true
      }

      if (!subResource && method === 'GET') {
        const snapshot = await readSnapshotFiles(dir)
        if (snapshot) jsonResponse(res, snapshot)
        else emptyResponse(res, 404)
        return true
      }

      if (!subResource && method === 'PATCH') {
        const patch = await readBodyJson(req)
        const existing = await readJson(path.join(dir, 'meta.json'))
        if (!existing) {
          emptyResponse(res, 404)
          return true
        }
        const next = {
          ...existing,
          ...patch,
          name: typeof patch.name === 'string' && patch.name.trim() ? patch.name.trim() : existing.name,
          updatedAt: typeof patch.name === 'string' ? Date.now() : existing.updatedAt,
        }
        await writeJson(path.join(dir, 'meta.json'), next)
        jsonResponse(res, next)
        return true
      }

      if (!subResource && method === 'DELETE') {
        await fs.rm(dir, { recursive: true, force: true })
        emptyResponse(res, 204)
        return true
      }
    }

    jsonResponse(res, { error: 'Not found' }, 404)
    return true
  } catch (error) {
    console.error('[ScreenDesc desktop storage]', error)
    jsonResponse(res, { error: error instanceof Error ? error.message : String(error) }, 500)
    return true
  }
}

module.exports = { handleStorageRequest, revealProjectById, documentsRoot }
