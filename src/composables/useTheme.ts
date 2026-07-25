import { readonly, ref, watch } from 'vue'

export type ThemePreference = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'screendesc.theme'

function readStoredPreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  } catch {
    // localStorage unavailable (private mode, etc.) — fall back to system.
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
    localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    // Ignore write failures; the in-memory preference still applies this session.
  }
})

export function useTheme() {
  function setThemePreference(preference: ThemePreference): void {
    themePreference.value = preference
  }

  return {
    themePreference: readonly(themePreference),
    setThemePreference,
  }
}
