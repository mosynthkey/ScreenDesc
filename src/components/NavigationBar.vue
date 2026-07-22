<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { APP_NAME, APP_VERSION } from '../appMeta'
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

function toggleAbout(): void {
  aboutOpen.value = !aboutOpen.value
}

function closeAbout(): void {
  aboutOpen.value = false
}

function handleWindowClick(event: MouseEvent): void {
  const target = event.target as HTMLElement | null
  if (aboutOpen.value && !target?.closest('.nav-about')) {
    closeAbout()
  }
}

onMounted(() => window.addEventListener('click', handleWindowClick))
onBeforeUnmount(() => window.removeEventListener('click', handleWindowClick))
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
      <div
        v-if="aboutOpen"
        class="about-popover"
        role="dialog"
        :aria-label="t('about.title')"
      >
        <div class="about-name">{{ APP_NAME }}</div>
        <p class="about-tagline">{{ t('brand.tagline') }}</p>
        <p class="about-version">{{ t('about.version', { version: APP_VERSION }) }}</p>
      </div>
      <button
        class="nav-brand"
        type="button"
        :aria-label="t('about.openAria')"
        :aria-expanded="aboutOpen"
        :title="t('about.openAria')"
        @click.stop="toggleAbout"
      >
        <span class="brand-mark" aria-hidden="true" />
      </button>
    </div>
  </nav>
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
  position: relative;
  flex: 0 0 auto;
  margin-top: auto;
  padding-top: 8px;
}

.nav-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 44px;
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
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: linear-gradient(145deg, #5ac8fa 0%, #007aff 55%, #5856d6 100%);
  box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.35);
}

.about-popover {
  position: absolute;
  left: calc(100% + 10px);
  bottom: 0;
  z-index: 60;
  width: max-content;
  min-width: 180px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
}

.about-name {
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.about-tagline {
  margin: 4px 0 0;
  color: var(--ink-secondary);
  font-size: 0.78rem;
  line-height: 1.4;
}

.about-version {
  margin: 8px 0 0;
  color: var(--ink-muted);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}
</style>
