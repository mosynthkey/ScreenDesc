<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { APP_LICENSE, APP_LICENSE_URL, APP_NAME, APP_VERSION } from '../appMeta'
import { RUNTIME_LIBRARIES } from '../credits'
import { LOCALE_OPTIONS, useI18n } from '../i18n'
import { useTheme, type ThemePreference } from '../composables/useTheme'
import { isDesktopApp } from '../runtime'
import { FileTextIcon, GlobeIcon, MonitorIcon, MoonIcon, PenLineIcon, SettingsIcon, SunIcon } from '@lucide/vue'

export type AppPageId = 'files' | 'edit'

defineProps<{
  active: AppPageId
  editAvailable: boolean
}>()

const emit = defineEmits<{
  navigate: [page: AppPageId]
}>()

const { t, locale, setLocale } = useI18n()
const aboutOpen = ref(false)
const settingsOpen = ref(false)
const desktopDownloadOpen = ref(false)
const baseUrl = import.meta.env.BASE_URL
const { themePreference, setThemePreference } = useTheme()

const themeOptions: Array<{ value: ThemePreference; labelKey: 'about.theme.system' | 'about.theme.light' | 'about.theme.dark' }> = [
  { value: 'system', labelKey: 'about.theme.system' },
  { value: 'light', labelKey: 'about.theme.light' },
  { value: 'dark', labelKey: 'about.theme.dark' },
]

function openAbout(): void {
  aboutOpen.value = true
}

function closeAbout(): void {
  aboutOpen.value = false
}

function openSettings(): void {
  settingsOpen.value = true
}

function closeSettings(): void {
  settingsOpen.value = false
}

function openDesktopDownload(): void {
  desktopDownloadOpen.value = true
}

function closeDesktopDownload(): void {
  desktopDownloadOpen.value = false
}

function onModalKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  if (aboutOpen.value) {
    event.preventDefault()
    closeAbout()
  } else if (settingsOpen.value) {
    event.preventDefault()
    closeSettings()
  } else if (desktopDownloadOpen.value) {
    event.preventDefault()
    closeDesktopDownload()
  }
}

onMounted(() => window.addEventListener('keydown', onModalKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onModalKeydown))
</script>

<template>
  <nav class="nav-rail" :aria-label="t('nav.aria')">
    <div class="nav-pages">
      <button
        class="nav-btn"
        type="button"
        :class="{ active: active === 'files' }"
        :aria-current="active === 'files' ? 'page' : undefined"
        :aria-label="t('nav.files')"
        :title="t('nav.files')"
        @click="emit('navigate', 'files')"
      >
        <FileTextIcon class="nav-icon" :size="20" :stroke-width="1.8" aria-hidden="true" />
        <span class="nav-label">{{ t('nav.files') }}</span>
      </button>

      <button
        class="nav-btn"
        type="button"
        :class="{ active: active === 'edit' }"
        :aria-current="active === 'edit' ? 'page' : undefined"
        :aria-label="t('nav.edit')"
        :title="editAvailable ? t('nav.edit') : t('nav.editDisabledHint')"
        :disabled="!editAvailable"
        @click="emit('navigate', 'edit')"
      >
        <PenLineIcon class="nav-icon" :size="20" :stroke-width="1.8" aria-hidden="true" />
        <span class="nav-label">{{ t('nav.edit') }}</span>
      </button>
    </div>

    <div class="nav-about">
      <button
        class="nav-btn"
        type="button"
        :aria-label="t('settings.openAria')"
        :aria-expanded="settingsOpen"
        :title="t('settings.openAria')"
        @click="openSettings"
      >
        <SettingsIcon class="nav-icon" :size="20" :stroke-width="1.8" aria-hidden="true" />
        <span class="nav-label">{{ t('settings.title') }}</span>
      </button>
      <button
        v-if="!isDesktopApp"
        class="nav-btn"
        :aria-label="t('nav.desktopApp')"
        :aria-expanded="desktopDownloadOpen"
        :title="t('nav.desktopApp')"
        type="button"
        @click="openDesktopDownload"
      >
        <MonitorIcon class="nav-icon" :size="20" :stroke-width="1.8" aria-hidden="true" />
        <span class="nav-label">{{ t('nav.desktopApp') }}</span>
      </button>
      <button
        class="nav-brand"
        type="button"
        :aria-label="t('about.openAria')"
        :aria-expanded="aboutOpen"
        :title="t('about.openAria')"
        @click="openAbout"
      >
        <img
          class="brand-mark"
          :src="`${baseUrl}icon.png`"
          alt=""
          width="36"
          height="36"
          decoding="async"
        />
        <span class="brand-version">v{{ APP_VERSION }}</span>
      </button>
    </div>
  </nav>

  <Teleport to="body">
    <div v-if="aboutOpen" class="modal-backdrop">
      <div
        class="modal about-modal"
        role="dialog"
        aria-modal="true"
        :aria-label="t('about.title')"
      >
        <img
          class="about-mark"
          :src="`${baseUrl}icon.png`"
          alt=""
          width="72"
          height="72"
          decoding="async"
        />
        <h2 class="about-name">{{ APP_NAME }}</h2>
        <p class="about-version">{{ t('about.version', { version: APP_VERSION }) }}</p>
        <p class="about-app-license">
          <a
            class="about-app-license-link"
            :href="APP_LICENSE_URL"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ t('about.appLicense', { license: APP_LICENSE }) }}
          </a>
        </p>
        <p class="about-copyright">{{ t('about.copyright') }}</p>

        <section class="about-libraries" :aria-label="t('about.librariesTitle')">
          <h3 class="about-libraries-title">{{ t('about.librariesTitle') }}</h3>
          <ul class="about-library-list">
            <li v-for="library in RUNTIME_LIBRARIES" :key="library.name" class="about-library-item">
              <a
                class="about-library-name"
                :href="library.url"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ library.name }}
              </a>
              <span class="about-library-license">
                {{ t('about.licenseLabel', { license: library.license }) }}
              </span>
            </li>
          </ul>
        </section>

        <div class="modal-actions">
          <button class="btn btn-primary" type="button" @click="closeAbout">
            {{ t('about.close') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <Teleport to="body">
    <div v-if="desktopDownloadOpen" class="modal-backdrop">
      <div
        class="modal desktop-download-modal"
        role="dialog"
        aria-modal="true"
        :aria-label="t('desktopDownload.title')"
      >
        <h2>{{ t('desktopDownload.title') }}</h2>
        <p>{{ t('desktopDownload.description') }}</p>
        <div class="desktop-download-actions">
          <a
            class="desktop-download-btn"
            href="https://github.com/mosynthkey/ScreenDesc/releases/latest/download/ScreenDesc-macOS.dmg"
          >
            <svg viewBox="0 0 456.008 560.035" fill="currentColor" aria-hidden="true">
              <path d="M380.844 297.529c.787 84.752 74.349 112.955 75.164 113.314-.622 1.988-11.754 40.191-38.756 79.652-23.343 34.117-47.568 68.107-85.731 68.811-37.499.691-49.557-22.236-92.429-22.236-42.859 0-56.256 21.533-91.753 22.928-36.837 1.395-64.889-36.891-88.424-70.883-48.093-69.53-84.846-196.475-35.496-282.165 24.516-42.554 68.328-69.501 115.882-70.192 36.173-.69 70.315 24.336 92.429 24.336 22.1 0 63.59-30.096 107.208-25.676 18.26.76 69.517 7.376 102.429 55.552-2.652 1.644-61.159 35.704-60.523 106.559M310.369 89.418C329.926 65.745 343.089 32.79 339.498 0 311.308 1.133 277.22 18.785 257 42.445c-18.121 20.952-33.991 54.487-29.709 86.628 31.421 2.431 63.52-15.967 83.078-39.655" />
            </svg>
            <span>{{ t('desktopDownload.macOS') }}</span>
          </a>
          <a
            class="desktop-download-btn"
            href="https://github.com/mosynthkey/ScreenDesc/releases/latest/download/ScreenDesc-Windows.exe"
          >
            <svg viewBox="0 0 256 257" fill="currentColor" aria-hidden="true">
              <path d="M0 36.357L104.62 22.11l.045 100.914-104.57.595L0 36.358zm104.57 98.293l.08 101.002L.081 221.275l-.006-87.302 104.494.677zm12.682-114.405L255.968 0v121.74l-138.716 1.1V20.246zM256 135.6l-.033 121.191-138.716-19.578-.194-101.84L256 135.6z" />
            </svg>
            <span>{{ t('desktopDownload.windows') }}</span>
          </a>
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary" type="button" @click="closeDesktopDownload">
            {{ t('about.close') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <Teleport to="body">
    <div v-if="settingsOpen" class="modal-backdrop">
      <div
        class="modal settings-modal"
        role="dialog"
        aria-modal="true"
        :aria-label="t('settings.title')"
      >
        <h2 class="settings-title">{{ t('settings.title') }}</h2>

        <section class="settings-section" :aria-label="t('about.theme.title')">
          <h3 class="settings-section-title">
            <SunIcon class="settings-section-icon" :size="16" :stroke-width="1.8" aria-hidden="true" />
            {{ t('about.theme.title') }}
          </h3>
          <div class="settings-theme-buttons" role="group" :aria-label="t('about.theme.title')">
            <button
              v-for="option in themeOptions"
              :key="option.value"
              type="button"
              class="settings-theme-btn"
              :class="{ active: themePreference === option.value }"
              :aria-pressed="themePreference === option.value"
              @click="setThemePreference(option.value)"
            >
              <MonitorIcon v-if="option.value === 'system'" class="settings-theme-btn-icon" :size="15" :stroke-width="1.8" aria-hidden="true" />
              <SunIcon v-else-if="option.value === 'light'" class="settings-theme-btn-icon" :size="15" :stroke-width="1.8" aria-hidden="true" />
              <MoonIcon v-else class="settings-theme-btn-icon" :size="15" :stroke-width="1.8" aria-hidden="true" />
              {{ t(option.labelKey) }}
            </button>
          </div>
        </section>

        <section class="settings-section" :aria-label="t('settings.language.title')">
          <h3 class="settings-section-title">
            <GlobeIcon class="settings-section-icon" :size="16" :stroke-width="1.6" aria-hidden="true" />
            {{ t('settings.language.title') }}
          </h3>
          <div class="settings-language-list" role="group" :aria-label="t('settings.language.title')">
            <button
              v-for="option in LOCALE_OPTIONS"
              :key="option.value"
              type="button"
              class="settings-language-btn"
              :class="{ active: locale === option.value }"
              :aria-pressed="locale === option.value"
              @click="setLocale(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </section>

        <div class="modal-actions">
          <button class="btn btn-primary" type="button" @click="closeSettings">
            {{ t('about.close') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.nav-rail {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  padding: 12px 8px;
  height: 100%;
  min-height: 0;
  background: var(--bg-panel);
  backdrop-filter: var(--blur);
  -webkit-backdrop-filter: var(--blur);
  border-right: 1px solid var(--line);
}

.nav-pages {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1 1 auto;
  min-height: 0;
}

.nav-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  min-height: 56px;
  padding: 8px 4px;
  border: none;
  border-radius: 12px;
  background: transparent;
  color: var(--ink-secondary);
  text-decoration: none;
  cursor: pointer;
  transition:
    background var(--press),
    color var(--press);
}

.nav-btn:hover:not(:disabled) {
  background: rgba(120, 120, 128, 0.12);
  color: var(--ink);
}

.nav-btn.active {
  background: var(--accent-soft);
  color: var(--accent);
}

.nav-btn:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}

.nav-icon {
  flex: 0 0 auto;
}

.nav-label {
  font-size: 0.58rem;
  font-weight: 650;
  letter-spacing: 0;
  line-height: 1.15;
  text-align: center;
  white-space: nowrap;
}

.nav-about {
  flex: 0 0 auto;
  margin-top: auto;
  padding-top: 8px;
}

.nav-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  width: 100%;
  height: auto;
  padding: 8px 0;
  border: none;
  border-radius: 12px;
  background: transparent;
  cursor: pointer;
  transition: background var(--press);
}

.nav-brand:hover {
  background: rgba(120, 120, 128, 0.12);
}

.brand-mark {
  display: block;
  width: 36px;
  height: 36px;
  border-radius: 9px;
  object-fit: cover;
}

.brand-version {
  font-size: 0.62rem;
  font-weight: 590;
  letter-spacing: 0.01em;
  color: var(--ink-muted);
  font-variant-numeric: tabular-nums;
}

.about-modal {
  width: min(400px, calc(100vw - 32px));
  max-height: min(860px, calc(100vh - 48px));
  overflow: auto;
  text-align: center;
}

.about-mark {
  display: block;
  width: 72px;
  height: 72px;
  margin: 0 auto 14px;
  border-radius: 16px;
  object-fit: cover;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
}

.about-name {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.about-version {
  margin: 12px 0 0;
  color: var(--ink-muted);
  font-size: 0.82rem;
  font-variant-numeric: tabular-nums;
}

.about-app-license {
  margin: 6px 0 0;
}

.about-app-license-link {
  color: var(--ink-muted);
  font-size: 0.82rem;
  font-weight: 600;
  text-decoration: none;
}

.about-app-license-link:hover {
  color: var(--accent-strong);
  text-decoration: underline;
}

.about-copyright {
  margin: 8px 0 0;
  color: var(--ink-muted);
  font-size: 0.76rem;
  line-height: 1.4;
}

.settings-modal {
  width: min(400px, calc(100vw - 32px));
  max-height: min(860px, calc(100vh - 48px));
  overflow: auto;
  text-align: left;
}

.desktop-download-modal {
  width: min(440px, calc(100vw - 32px));
}

.desktop-download-modal h2 {
  margin: 0;
  font-size: 1.08rem;
}

.desktop-download-modal > p {
  margin: 10px 0 18px;
  color: var(--ink-secondary);
  font-size: 0.88rem;
  line-height: 1.65;
}

.desktop-download-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.desktop-download-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  min-height: 48px;
  padding: 10px 14px;
  border: 1px solid var(--line-strong);
  border-radius: 11px;
  background: var(--bg-elevated);
  color: var(--ink);
  font-size: 0.86rem;
  font-weight: 650;
  text-decoration: none;
}

.desktop-download-btn:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.desktop-download-btn svg {
  width: 17px;
  height: 18px;
  flex: 0 0 auto;
}

.settings-title {
  margin: 0 0 4px;
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.settings-section {
  margin: 18px 0 0;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}

.settings-section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 10px;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.settings-section-icon {
  flex: 0 0 auto;
  color: var(--ink-muted);
}

.settings-theme-buttons {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.settings-language-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.settings-theme-btn,
.settings-language-btn {
  margin: 0;
  padding: 7px 10px;
  border: 1px solid var(--line-strong);
  border-radius: 10px;
  background: var(--bg-elevated);
  color: var(--ink-muted);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background var(--spring),
    border-color var(--spring),
    color var(--spring);
}

.settings-theme-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 7px 6px;
}

.settings-theme-btn-icon {
  flex: 0 0 auto;
}

.settings-theme-btn:hover,
.settings-language-btn:hover {
  border-color: var(--accent);
  color: var(--ink);
}

.settings-theme-btn.active,
.settings-language-btn.active {
  border-color: rgba(0, 122, 255, 0.45);
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.about-libraries {
  margin: 18px 0 0;
  padding-top: 14px;
  border-top: 1px solid var(--line);
  text-align: left;
}

.about-libraries-title {
  margin: 0 0 10px;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.about-library-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.about-library-item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(120, 120, 128, 0.08);
}

.about-library-name {
  min-width: 0;
  color: var(--ink);
  font-size: 0.84rem;
  font-weight: 600;
  text-decoration: none;
}

.about-library-name:hover {
  color: var(--accent);
  text-decoration: underline;
}

.about-library-license {
  flex: 0 0 auto;
  color: var(--ink-muted);
  font-size: 0.72rem;
  font-weight: 550;
  white-space: nowrap;
}

.about-modal .modal-actions {
  justify-content: center;
  margin-top: 16px;
}
</style>
