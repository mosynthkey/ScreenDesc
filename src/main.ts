import { createApp } from 'vue'
import App from './App.vue'
import './styles/main.css'
import './i18n'
import { DEFAULT_FONT_FAMILY, loadGoogleFont } from './utils/googleFonts'
import { initCloudflareWebAnalytics } from './analytics/cloudflareWebAnalytics'
import { installAppViewportSync } from './utils/syncAppViewport'

installAppViewportSync()
loadGoogleFont(DEFAULT_FONT_FAMILY)
initCloudflareWebAnalytics()

createApp(App).mount('#app')
