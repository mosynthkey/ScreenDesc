import { ref, watch } from 'vue'
import { isDesktopApp } from '../runtime'
import { en, type MessageKey } from './messages/en'
import { ja } from './messages/ja'

export type Locale = 'en' | 'ja'
export type { MessageKey }

const catalogs: Record<Locale, Record<MessageKey, string>> = { en, ja }

/** Prefer a `.desktop` message key when running the desktop build. */
export function runtimeKey(webKey: MessageKey): MessageKey {
  if (!isDesktopApp) return webKey
  const desktopKey = `${webKey}.desktop` as MessageKey
  return desktopKey in en ? desktopKey : webKey
}

function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return 'ja'
  return navigator.language.toLowerCase().startsWith('ja') ? 'ja' : 'en'
}

export const locale = ref<Locale>(detectLocale())

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

/** Like `t`, but swaps in desktop-specific copy when built for Deno Desktop. */
export function tr(key: MessageKey, vars?: Record<string, string | number>): string {
  return t(runtimeKey(key), vars)
}

export function setLocale(next: Locale): void {
  locale.value = next
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
