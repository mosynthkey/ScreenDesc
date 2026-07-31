import { ref, watch } from 'vue'
import { isDesktopApp } from '../runtime'
import { persistentStorage } from '../utils/persistentStorage'
import { en, type MessageKey } from './messages/en'
import { ja } from './messages/ja'
import { zh } from './messages/zh'
import { es } from './messages/es'
import { fr } from './messages/fr'
import { de } from './messages/de'

export type Locale = 'en' | 'ja' | 'zh' | 'es' | 'fr' | 'de'
export type { MessageKey }

const catalogs: Record<Locale, Record<MessageKey, string>> = { en, ja, zh, es, fr, de }

export const LOCALE_OPTIONS: Array<{ value: Locale; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'zh', label: '中文（简体）' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
]

const LOCALE_STORAGE_KEY = 'screendesc.locale'

/** Prefer a `.desktop` message key when running the desktop build. */
export function runtimeKey(webKey: MessageKey): MessageKey {
  if (!isDesktopApp) return webKey
  const desktopKey = `${webKey}.desktop` as MessageKey
  return desktopKey in en ? desktopKey : webKey
}

function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && value in catalogs
}

/** Match the browser/OS language to one of our supported locales, defaulting to English. */
function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en'
  const lang = navigator.language.toLowerCase()
  const prefix = lang.split('-')[0]
  if (isLocale(prefix)) return prefix
  return 'en'
}

function readStoredLocale(): Locale | null {
  try {
    const raw = persistentStorage.getItem(LOCALE_STORAGE_KEY)
    return isLocale(raw) ? raw : null
  } catch {
    return null
  }
}

export const locale = ref<Locale>(readStoredLocale() ?? detectLocale())

const catalogsByLocale = catalogs

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    vars[name] !== undefined ? String(vars[name]) : `{${name}}`,
  )
}

export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const catalog = catalogsByLocale[locale.value] ?? catalogsByLocale.en
  return interpolate(catalog[key] ?? en[key] ?? key, vars)
}

/** Like `t`, but swaps in desktop-specific copy when built for the desktop app. */
export function tr(key: MessageKey, vars?: Record<string, string | number>): string {
  return t(runtimeKey(key), vars)
}

/**
 * On desktop, the stored preference isn't available until
 * `loadDesktopSettings()` resolves (see `main.ts`), which happens after this
 * module's initial synchronous read. Call once, right after that load, to
 * pick up the real value before the app mounts.
 */
export function applyStoredLocalePreference(): void {
  const stored = readStoredLocale()
  if (stored) locale.value = stored
}

export function setLocale(next: Locale): void {
  locale.value = next
  try {
    persistentStorage.setItem(LOCALE_STORAGE_KEY, next)
  } catch {
    // Ignore write failures; the in-memory choice still applies this session.
  }
}

function applyDocumentLocale(next: Locale): void {
  if (typeof document === 'undefined') return
  document.documentElement.lang = next
  document.title = t('document.title')
}

watch(locale, (next) => applyDocumentLocale(next), { immediate: true })

/** Use in Vue setup so templates re-render when locale changes. */
export function useI18n() {
  function translate(key: MessageKey, vars?: Record<string, string | number>): string {
    void locale.value
    return t(key, vars)
  }
  function translateRuntime(key: MessageKey, vars?: Record<string, string | number>): string {
    void locale.value
    return tr(key, vars)
  }
  return { t: translate, tr: translateRuntime, locale, setLocale }
}
