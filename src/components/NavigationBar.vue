<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { APP_LICENSE, APP_LICENSE_URL, APP_NAME, APP_VERSION } from '../appMeta'
import { RUNTIME_LIBRARIES } from '../credits'
import { LOCALE_OPTIONS, useI18n } from '../i18n'
import { useTheme, type ThemePreference } from '../composables/useTheme'

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

function onModalKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  if (aboutOpen.value) {
    event.preventDefault()
    closeAbout()
  } else if (settingsOpen.value) {
    event.preventDefault()
    closeSettings()
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
        <svg class="nav-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            d="M7 3.5h7.2L19.5 8.8V20a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5Z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linejoin="round"
          />
          <path
            d="M14 3.5V8a1 1 0 0 0 1 1h4.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linejoin="round"
          />
        </svg>
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
        <svg class="nav-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            d="M4 20h4.2L18.8 9.4a1.6 1.6 0 0 0 0-2.3L16.9 5.2a1.6 1.6 0 0 0-2.3 0L4 15.8V20Z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linejoin="round"
          />
          <path
            d="M13.5 6.5 17.5 10.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          />
        </svg>
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
        <svg
          class="nav-icon"
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82A1.65 1.65 0 0 0 3 14H2.91A2 2 0 0 1 3 10h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
          />
        </svg>
        <span class="nav-label">{{ t('settings.title') }}</span>
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
            <svg
              class="settings-section-icon"
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="4.5" />
              <path
                d="M12 2.8v2.1M12 19.1v2.1M21.2 12h-2.1M4.9 12H2.8M18.1 5.9l-1.5 1.5M7.4 16.6l-1.5 1.5M18.1 18.1l-1.5-1.5M7.4 7.4 5.9 5.9"
              />
            </svg>
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
              <svg
                class="settings-theme-btn-icon"
                viewBox="0 0 24 24"
                width="15"
                height="15"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <template v-if="option.value === 'system'">
                  <rect x="2.5" y="4" width="19" height="13" rx="1.6" />
                  <path d="M8.5 20.5h7M12 17v3.5" />
                </template>
                <template v-else-if="option.value === 'light'">
                  <circle cx="12" cy="12" r="4.5" />
                  <path
                    d="M12 2.8v2.1M12 19.1v2.1M21.2 12h-2.1M4.9 12H2.8M18.1 5.9l-1.5 1.5M7.4 16.6l-1.5 1.5M18.1 18.1l-1.5-1.5M7.4 7.4 5.9 5.9"
                  />
                </template>
                <template v-else>
                  <path
                    d="M20 13.2A8.5 8.5 0 1 1 10.8 4 6.8 6.8 0 0 0 20 13.2Z"
                  />
                </template>
              </svg>
              {{ t(option.labelKey) }}
            </button>
          </div>
        </section>

        <section class="settings-section" :aria-label="t('settings.language.title')">
          <h3 class="settings-section-title">
            <svg class="settings-section-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.6" />
              <path
                d="M3.5 12h17M12 3.5c2.2 2.3 3.4 5.2 3.4 8.5s-1.2 6.2-3.4 8.5c-2.2-2.3-3.4-5.2-3.4-8.5S9.8 5.8 12 3.5Z"
                fill="none"
                stroke="currentColor"
                stroke-width="1.4"
              />
            </svg>
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
