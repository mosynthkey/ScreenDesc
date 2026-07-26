import { readonly, ref, watch } from 'vue'
import { persistentStorage } from '../utils/persistentStorage'

export type ThemePreference = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'screendesc.theme'

function readStoredPreference(): ThemePreference {
  try {
    const raw = persistentStorage.getItem(STORAGE_KEY)
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  } catch {
    // Storage unavailable (private mode, etc.) — fall back to system.
  }
  return 'system'
}

function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement
  if (preference === 'system') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', preference)
  }
}

const themePreference = ref<ThemePreference>(readStoredPreference())
applyTheme(themePreference.value)

watch(themePreference, (preference) => {
  applyTheme(preference)
  try {
    persistentStorage.setItem(STORAGE_KEY, preference)
  } catch {
    // Ignore write failures; the in-memory preference still applies this session.
  }
})

/**
 * On desktop, the stored preference isn't available until
 * `loadDesktopSettings()` resolves (see `main.ts`), which happens after this
 * module's initial synchronous read. Call once, right after that load, to
 * pick up the real value before the app mounts.
 */
export function applyStoredThemePreference(): void {
  themePreference.value = readStoredPreference()
}

export function useTheme() {
  function setThemePreference(preference: ThemePreference): void {
    themePreference.value = preference
  }

  return {
    themePreference: readonly(themePreference),
    setThemePreference,
  }
}
