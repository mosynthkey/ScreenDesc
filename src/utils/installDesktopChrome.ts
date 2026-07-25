import { isDesktopApp } from '../runtime'

/**
 * Best-effort page-side suppression of the browser context menu.
 * On Deno Desktop / CEF this often never runs — the host replaces the menu
 * via `BrowserWindow.showContextMenu` in `desktop/main.ts` instead.
 * @see https://docs.deno.com/runtime/desktop/menus/
 */
export function installDesktopChrome(): void {
  if (!isDesktopApp || typeof window === 'undefined') return

  const block = (event: Event) => {
    event.preventDefault()
    event.stopPropagation()
  }

  window.addEventListener('contextmenu', block, { capture: true })
  document.addEventListener('contextmenu', block, { capture: true })
  // Older CEF builds honor body oncontextmenu more reliably than addEventListener.
  document.addEventListener(
    'DOMContentLoaded',
    () => {
      document.body?.setAttribute('oncontextmenu', 'return false')
    },
    { once: true },
  )
  if (document.body) {
    document.body.setAttribute('oncontextmenu', 'return false')
  }
}
