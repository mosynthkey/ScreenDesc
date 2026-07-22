<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n, type MessageKey } from '../i18n'
import {
  fontsByGroup,
  loadAllGoogleFonts,
  loadGoogleFont,
  type FontGroupId,
} from '../utils/googleFonts'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [family: string]
}>()

const { t } = useI18n()

const FONT_GROUP_LABEL_KEYS: Record<FontGroupId, MessageKey> = {
  japanese: 'style.fontGroup.japanese',
  sans: 'style.fontGroup.sans',
  serif: 'style.fontGroup.serif',
  display: 'style.fontGroup.display',
}

const fontGroups = computed(() =>
  fontsByGroup().map((entry) => ({
    ...entry,
    label: t(FONT_GROUP_LABEL_KEYS[entry.group]),
  })),
)

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const listRef = ref<HTMLElement | null>(null)

watch(
  () => props.modelValue,
  (family) => {
    loadGoogleFont(family)
  },
  { immediate: true },
)

const selectedLabel = computed(() => {
  for (const group of fontGroups.value) {
    const match = group.fonts.find((font) => font.family === props.modelValue)
    if (match) return match.label
  }
  return props.modelValue
})

async function toggleOpen(): Promise<void> {
  if (open.value) {
    open.value = false
    return
  }
  loadAllGoogleFonts()
  open.value = true
  await nextTick()
  const selected = listRef.value?.querySelector<HTMLElement>('[aria-selected="true"]')
  selected?.scrollIntoView({ block: 'nearest' })
}

function choose(family: string): void {
  emit('update:modelValue', family)
  open.value = false
}

function onDocumentPointerDown(event: PointerEvent): void {
  if (!open.value || !rootRef.value) return
  if (rootRef.value.contains(event.target as Node)) return
  open.value = false
}

function onKeydown(event: KeyboardEvent): void {
  if (!open.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    open.value = false
  }
}

watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener('pointerdown', onDocumentPointerDown, true)
    document.addEventListener('keydown', onKeydown, true)
  } else {
    document.removeEventListener('pointerdown', onDocumentPointerDown, true)
    document.removeEventListener('keydown', onKeydown, true)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  document.removeEventListener('keydown', onKeydown, true)
})
</script>

<template>
  <div ref="rootRef" class="font-picker">
    <button
      class="font-picker-trigger"
      type="button"
      :aria-expanded="open"
      aria-haspopup="listbox"
      :style="{ fontFamily: `'${modelValue}', sans-serif` }"
      @click="toggleOpen"
    >
      <span class="font-picker-label">{{ selectedLabel }}</span>
      <span class="font-picker-chevron" aria-hidden="true">▾</span>
    </button>

    <div
      v-if="open"
      ref="listRef"
      class="font-picker-menu"
      role="listbox"
      :aria-label="t('style.defaultFont')"
    >
      <div v-for="group in fontGroups" :key="group.group" class="font-picker-group">
        <div class="font-picker-group-label">{{ group.label }}</div>
        <button
          v-for="option in group.fonts"
          :key="option.family"
          class="font-picker-option"
          type="button"
          role="option"
          :aria-selected="option.family === modelValue"
          :class="{ selected: option.family === modelValue }"
          :style="{ fontFamily: `'${option.family}', sans-serif` }"
          @click="choose(option.family)"
        >
          <span>{{ option.label }}</span>
          <span v-if="group.group === 'japanese'" class="font-picker-sample" aria-hidden="true">
            あア漢
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.font-picker {
  position: relative;
}

.font-picker-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  margin: 0;
  padding: 8px 10px;
  border: 1px solid var(--line-strong);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.88);
  color: var(--ink);
  font-size: 0.88rem;
  font-weight: 600;
  line-height: 1.3;
  text-align: left;
  cursor: pointer;
}

.font-picker-trigger:hover {
  border-color: var(--accent);
}

.font-picker-trigger:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.18);
}

.font-picker-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.font-picker-chevron {
  flex: 0 0 auto;
  color: var(--ink-muted);
  font-size: 0.75rem;
}

.font-picker-menu {
  position: absolute;
  z-index: 20;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  max-height: min(360px, 50vh);
  overflow: auto;
  padding: 6px;
  border: 1px solid var(--line-strong);
  border-radius: 12px;
  background: #fff;
  box-shadow: var(--shadow);
}

.font-picker-group + .font-picker-group {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--line);
}

.font-picker-group-label {
  padding: 4px 8px 6px;
  color: var(--ink-muted);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.font-picker-option {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  margin: 0;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--ink);
  font-size: 0.92rem;
  font-weight: 600;
  line-height: 1.35;
  text-align: left;
  cursor: pointer;
}

.font-picker-option:hover {
  background: rgba(120, 120, 128, 0.1);
}

.font-picker-option.selected {
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.font-picker-sample {
  flex: 0 0 auto;
  color: var(--ink-muted);
  font-size: 0.86rem;
  font-weight: 700;
}

.font-picker-option.selected .font-picker-sample {
  color: inherit;
  opacity: 0.75;
}
</style>
