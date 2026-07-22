import { locale, t } from '../i18n'

/** Gallery / header default name from the current date and time. */
export function defaultProjectName(date = new Date()): string {
  const dateLocale = locale.value === 'ja' ? 'ja-JP' : 'en-US'
  const stamp = date.toLocaleString(dateLocale, {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  return t('projectStorage.defaultName', { stamp })
}
