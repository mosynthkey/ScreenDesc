import { isDesktopApp } from '../runtime'

/**
 * Suppress CEF/webview browser chrome (Reload, Inspect, etc.) on right-click.
 * App-owned overlays (e.g. Files "Show in Finder") still work; they are not
 * the native context menu.
 */
export function installDesktopChrome(): void {
  if (!isDesktopApp || typeof window === 'undefined') return

  window.addEventListener(
    'contextmenu',
    (event) => {
      event.preventDefault()
    },
    { capture: true },
  )
}
