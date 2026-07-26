const API_PREFIX = '/__screendesc/storage'

// Deno.serve binds to a random port every launch, so the page's origin (and
// therefore localStorage) is different each time the desktop app starts.
// Settings that must survive a restart (theme, panel sizes, presets…) are
// mirrored to Documents/ScreenDesc/settings.json instead.
let cache: Record<string, string> = {}
let loaded = false

/** Fetch settings.json into the in-memory cache. Call once before mounting the app. */
export async function loadDesktopSettings(): Promise<void> {
  try {
    const response = await fetch(`${API_PREFIX}/settings`)
    if (response.ok) cache = (await response.json()) as Record<string, string>
  } catch {
    // Keep the empty cache; settings just fall back to their defaults this run.
  } finally {
    loaded = true
  }
}

function persist(): void {
  void fetch(`${API_PREFIX}/settings`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(cache),
  }).catch(() => {
    // Best-effort; the in-memory value still applies for the rest of this session.
  })
}

/** Drop-in replacement for the relevant parts of the `Storage` (localStorage) interface. */
export const desktopStorage = {
  getItem(key: string): string | null {
    if (!loaded) console.warn('[ScreenDesc] desktopStorage read before loadDesktopSettings() resolved')
    return cache[key] ?? null
  },
  setItem(key: string, value: string): void {
    cache[key] = value
    persist()
  },
  removeItem(key: string): void {
    delete cache[key]
    persist()
  },
}
