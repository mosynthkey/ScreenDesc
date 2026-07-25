/**
 * Keep layout CSS vars in sync with the real window size.
 * Some desktop webviews (CEF) leave `vh`/`%` stuck after resize.
 */
export function syncAppViewport(): void {
  const root = document.documentElement
  root.style.setProperty('--app-width', `${window.innerWidth}px`)
  root.style.setProperty('--app-height', `${window.innerHeight}px`)
}

export function installAppViewportSync(): void {
  syncAppViewport()
  window.addEventListener('resize', syncAppViewport)
  window.visualViewport?.addEventListener('resize', syncAppViewport)
}
