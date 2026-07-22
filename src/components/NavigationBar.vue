<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { APP_LICENSE, APP_LICENSE_URL, APP_NAME, APP_VERSION } from '../appMeta'
import { RUNTIME_LIBRARIES } from '../credits'
import { useI18n } from '../i18n'

export type AppPageId = 'gallery' | 'edit'

defineProps<{
  active: AppPageId
  editAvailable: boolean
}>()

const emit = defineEmits<{
  navigate: [page: AppPageId]
}>()

const { t } = useI18n()
const aboutOpen = ref(false)
const baseUrl = import.meta.env.BASE_URL

function openAbout(): void {
  aboutOpen.value = true
}

function closeAbout(): void {
  aboutOpen.value = false
}

function onAboutKeydown(event: KeyboardEvent): void {
  if (!aboutOpen.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    closeAbout()
  }
}

onMounted(() => window.addEventListener('keydown', onAboutKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onAboutKeydown))
</script>

<template>
  <nav class="nav-rail" :aria-label="t('nav.aria')">
    <div class="nav-pages">
      <button
        class="nav-btn"
        type="button"
        :class="{ active: active === 'gallery' }"
        :aria-current="active === 'gallery' ? 'page' : undefined"
        :aria-label="t('nav.gallery')"
        :title="t('nav.gallery')"
        @click="emit('navigate', 'gallery')"
      >
        <svg class="nav-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <rect
            x="3.5"
            y="3.5"
            width="7"
            height="7"
            rx="1.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
          />
          <rect
            x="13.5"
            y="3.5"
            width="7"
            height="7"
            rx="1.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
          />
          <rect
            x="3.5"
            y="13.5"
            width="7"
            height="7"
            rx="1.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
          />
          <rect
            x="13.5"
            y="13.5"
            width="7"
            height="7"
            rx="1.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
          />
        </svg>
        <span class="nav-label">{{ t('nav.gallery') }}</span>
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
      </button>
    </div>
  </nav>

  <Teleport to="body">
    <div
      v-if="aboutOpen"
      class="modal-backdrop"
      @click.self="closeAbout"
    >
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
        <p class="about-tagline">{{ t('brand.tagline') }}</p>
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
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 52px;
  padding: 0;
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

.about-tagline {
  margin: 6px 0 0;
  color: var(--ink-secondary);
  font-size: 0.88rem;
  line-height: 1.45;
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
