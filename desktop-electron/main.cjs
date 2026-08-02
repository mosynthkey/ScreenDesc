'use strict'

const http = require('node:http')
const fs = require('node:fs/promises')
const path = require('node:path')
const { app, BrowserWindow, Menu, dialog } = require('electron')
const { autoUpdater } = require('electron-updater')
const { handleStorageRequest } = require('./storageApi.cjs')

const distRoot = path.join(__dirname, '..', 'dist')

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.onnx': 'application/octet-stream',
  '.tar': 'application/x-tar',
}

async function serveStatic(req, res, pathname) {
  const decoded = decodeURIComponent(pathname === '/' ? '/index.html' : pathname)
  const filePath = path.join(distRoot, decoded)
  // Never serve outside dist/ (guards against `..` path traversal).
  if (!filePath.startsWith(distRoot + path.sep)) {
    res.writeHead(403)
    res.end()
    return
  }
  try {
    const bytes = await fs.readFile(filePath)
    const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
    res.writeHead(200, { 'content-type': contentType })
    res.end(bytes)
  } catch {
    res.writeHead(404)
    res.end()
  }
}

/** Bind to a random port every launch so no port ever conflicts. */
function startLocalServer(getWindow) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1')
      void handleStorageRequest(req, res, url, getWindow()).then((handled) => {
        if (!handled) void serveStatic(req, res, url.pathname)
      })
    })
    server.listen(0, '127.0.0.1', () => {
      resolve(server)
    })
  })
}

async function createWindow() {
  const win = new BrowserWindow({
    title: 'ScreenDesc',
    width: 1280,
    height: 840,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const server = await startLocalServer(() => win)
  win.on('closed', () => server.close())

  const address = server.address()
  await win.loadURL(`http://127.0.0.1:${address.port}/`)
}

/**
 * Drop Electron's default File/Edit/View/Window menu bar. On macOS the Edit
 * menu's Cut/Copy/Paste/Undo items are kept (unlike Windows/Linux, macOS
 * routes those keyboard shortcuts through the app menu, not through Chromium
 * defaults) but trimmed to just an app-quit item plus Edit — no File/View/Window.
 */
function setupMenu() {
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null)
    return
  }
  const template = [
    { role: 'appMenu' },
    { role: 'editMenu' },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

/**
 * Silent-download, ask-before-restart update flow via electron-updater.
 * `dev-app-update.yml` doesn't exist outside a packaged build, and
 * electron-updater throws on unpackaged apps, so this is a no-op in `electron .`.
 */
function setupAutoUpdate(getWindow) {
  if (!app.isPackaged) return

  const isJa = app.getLocale().startsWith('ja')
  if (process.platform === 'win32') autoUpdater.channel = 'latest-win'
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-downloaded', (info) => {
    void dialog
      .showMessageBox(getWindow() ?? undefined, {
        type: 'info',
        buttons: isJa ? ['再起動してインストール', '後で'] : ['Restart and Install', 'Later'],
        defaultId: 0,
        cancelId: 1,
        title: isJa ? 'アップデートの準備ができました' : 'Update Ready',
        message: isJa
          ? `新しいバージョン (${info.version}) がダウンロードされました。再起動してインストールしますか？`
          : `Version ${info.version} has been downloaded. Restart now to install it?`,
      })
      .then((result) => {
        if (result.response === 0) autoUpdater.quitAndInstall()
      })
  })

  autoUpdater.on('error', (error) => {
    console.error('[auto-update] error', error)
  })

  autoUpdater.checkForUpdates().catch((error) => {
    console.error('[auto-update] checkForUpdates failed', error)
  })
}

app.whenReady().then(() => {
  setupMenu()
  void createWindow()
  setupAutoUpdate(() => BrowserWindow.getAllWindows()[0] ?? null)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
