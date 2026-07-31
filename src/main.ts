import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './styles/main.css'
import './i18n'
import { DEFAULT_FONT_FAMILY, loadGoogleFont } from './utils/googleFonts'
import { initGoogleAnalytics } from './analytics/googleAnalytics'
import { installAppViewportSync } from './utils/syncAppViewport'
import { isDesktopApp } from './runtime'
import { loadDesktopSettings } from './utils/desktopSettingsStore'
import { applyStoredThemePreference } from './composables/useTheme'
import { applyStoredLocalePreference } from './i18n'

installAppViewportSync()
loadGoogleFont(DEFAULT_FONT_FAMILY)
initGoogleAnalytics()

async function bootstrap(): Promise<void> {
  // Desktop's origin (and localStorage) changes every launch, so settings live
  // in Documents/ScreenDesc/settings.json instead — load it before mounting so
  // the theme applies without a flash of the wrong colors.
  if (isDesktopApp) {
    await loadDesktopSettings()
    applyStoredThemePreference()
    applyStoredLocalePreference()
  }
  const app = createApp(App)
  app.use(createPinia())
  app.mount('#app')
}

void bootstrap()
