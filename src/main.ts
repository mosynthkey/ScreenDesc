import { createApp } from 'vue'
import App from './App.vue'
import './styles/main.css'
import { DEFAULT_FONT_FAMILY, loadGoogleFont } from './utils/googleFonts'

loadGoogleFont(DEFAULT_FONT_FAMILY)

createApp(App).mount('#app')
