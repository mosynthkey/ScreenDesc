import { isDesktopApp } from '../runtime'
import { desktopStorage } from './desktopSettingsStore'

/**
 * `localStorage`-like storage for settings that must survive a restart
 * (theme, panel sizes, presets…). On desktop this is backed by
 * Documents/ScreenDesc/settings.json (see `desktopSettingsStore`) because the
 * webview's origin — and so its localStorage — changes every launch.
 */
export const persistentStorage = {
  getItem(key: string): string | null {
    return isDesktopApp ? desktopStorage.getItem(key) : localStorage.getItem(key)
  },
  setItem(key: string, value: string): void {
    if (isDesktopApp) desktopStorage.setItem(key, value)
    else localStorage.setItem(key, value)
  },
  removeItem(key: string): void {
    if (isDesktopApp) desktopStorage.removeItem(key)
    else localStorage.removeItem(key)
  },
}
