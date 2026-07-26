import { createApp } from 'vue'
import App from './App.vue'
import './styles/main.css'
import './i18n'
import { DEFAULT_FONT_FAMILY, loadGoogleFont } from './utils/googleFonts'
import { initCloudflareWebAnalytics } from './analytics/cloudflareWebAnalytics'
import { installAppViewportSync } from './utils/syncAppViewport'
import { installDesktopChrome } from './utils/installDesktopChrome'
import { isDesktopApp } from './runtime'
import { loadDesktopSettings } from './utils/desktopSettingsStore'
import { applyStoredThemePreference } from './composables/useTheme'

installAppViewportSync()
installDesktopChrome()
loadGoogleFont(DEFAULT_FONT_FAMILY)
initCloudflareWebAnalytics()

async function bootstrap(): Promise<void> {
  // Desktop's origin (and localStorage) changes every launch, so settings live
  // in Documents/ScreenDesc/settings.json instead — load it before mounting so
  // the theme applies without a flash of the wrong colors.
  if (isDesktopApp) {
    await loadDesktopSettings()
    applyStoredThemePreference()
  }
  createApp(App).mount('#app')
}

void bootstrap()
