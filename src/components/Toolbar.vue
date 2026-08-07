<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { SectionVisibilityCategory, ToolMode } from '../types/annotation'
import type { AppPageId } from './NavigationBar.vue'
import { useI18n } from '../i18n'
import {
  SECTION_VISIBILITY_CATEGORIES,
  SECTION_VISIBILITY_LABEL_KEYS,
  type SectionVisibilityMap,
} from '../utils/sectionVisibility'
import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  CropIcon,
  DownloadIcon,
  FileDownIcon,
  FileUpIcon,
  FolderIcon,
  HandIcon,
  ImageIcon,
  InfoIcon,
  ListChecksIcon,
  MessageSquareIcon,
  MousePointer2Icon,
  PencilIcon,
  PlusIcon,
  ScanIcon,
  SquarePlusIcon,
  TypeIcon,
  Trash2Icon,
  XIcon,
} from '@lucide/vue'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    page: AppPageId
    projectTitle?: string | null
    toolMode: ToolMode
    sectionVisibility: SectionVisibilityMap
    isDetecting: boolean
    isRecognizingText: boolean
    canExport: boolean
    copyJustSucceeded?: boolean
    hasImage: boolean
    /** When false, hide the floating edit dock (e.g. files page while a project remains open). */
    showToolDock?: boolean
    canUndoCrop: boolean
    variations: string[]
    defaultVariationName: string
    activeVariation: string | null
  }>(),
  {
    projectTitle: null,
    copyJustSucceeded: false,
    showToolDock: true,
  },
)

const emit = defineEmits<{
  'update:toolMode': [mode: ToolMode]
  toggleSectionVisibility: [category: SectionVisibilityCategory]
  copyClipboard: []
  export: []
  undoCrop: []
  exportProjectFile: []
  duplicateProject: []
  openImportProject: []
  replaceImage: []
  newProject: []
  renameProject: [name: string]
  confirmCrop: []
  cancelCrop: []
  'update:activeVariation': [variation: string | null]
  addVariation: [name: string]
  renameDefaultVariation: [name: string]
  renameVariation: [currentName: string, nextName: string]
  removeVariation: [name: string]
}>()

const cropMenuOpen = ref(false)
const projectMenuOpen = ref(false)
const variationMenuOpen = ref(false)
const newVariationDraft = ref('')
const defaultVariationDraft = ref('')
const defaultVariationEditing = ref(false)
const variationRenameTarget = ref<string | null>(null)
const variationRenameDraft = ref('')
const variationPendingDelete = ref<string | null>(null)
const titleDraft = ref('')
const titleInputRef = ref<HTMLInputElement | null>(null)

const SECTION_VISIBILITY_ICONS = {
  'ai-region': ScanIcon,
  'ai-text': TypeIcon,
  manual: HandIcon,
} as const

const sectionVisibilityOptions = computed(() =>
  SECTION_VISIBILITY_CATEGORIES.map((category) => ({
    category,
    label: t(SECTION_VISIBILITY_LABEL_KEYS[category]),
    icon: SECTION_VISIBILITY_ICONS[category],
    checked: props.sectionVisibility[category] !== false,
  })),
)

function syncTitleDraft(): void {
  titleDraft.value = props.projectTitle?.trim() || ''
}

watch(
  () => props.projectTitle,
  () => {
    if (document.activeElement === titleInputRef.value) return
    syncTitleDraft()
  },
  { immediate: true },
)

watch(
  () => props.page,
  (page) => {
    cropMenuOpen.value = false
    projectMenuOpen.value = false
    if (page === 'edit') syncTitleDraft()
  },
)

function commitTitle(): void {
  const next = titleDraft.value.trim()
  const current = props.projectTitle?.trim() || ''
  if (!next) {
    syncTitleDraft()
    return
  }
  if (next === current) {
    titleDraft.value = next
    return
  }
  emit('renameProject', next)
}

function onTitleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    event.preventDefault()
    titleInputRef.value?.blur()
    return
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    syncTitleDraft()
    titleInputRef.value?.blur()
  }
}

function setTool(mode: ToolMode): void {
  emit('update:toolMode', mode)
}

function toggleCropMenu(): void {
  cropMenuOpen.value = !cropMenuOpen.value
}

function chooseUndoCrop(): void {
  emit('undoCrop')
  cropMenuOpen.value = false
}

function toggleProjectMenu(): void {
  projectMenuOpen.value = !projectMenuOpen.value
}

function chooseDuplicateProject(): void {
  emit('duplicateProject')
  projectMenuOpen.value = false
}

function chooseNewProject(): void {
  emit('newProject')
  projectMenuOpen.value = false
}

function chooseExportProjectFile(): void {
  emit('exportProjectFile')
  projectMenuOpen.value = false
}

function chooseImportProject(): void {
  emit('openImportProject')
  projectMenuOpen.value = false
}

function chooseReplaceImage(): void {
  emit('replaceImage')
  projectMenuOpen.value = false
}

function toggleVariationMenu(): void {
  variationMenuOpen.value = !variationMenuOpen.value
  if (variationMenuOpen.value) newVariationDraft.value = ''
  else {
    defaultVariationEditing.value = false
    variationRenameTarget.value = null
    variationPendingDelete.value = null
  }
}

function startDefaultVariationRename(): void {
  variationRenameTarget.value = null
  defaultVariationDraft.value = props.defaultVariationName
  defaultVariationEditing.value = true
}

function startVariationRename(variation: string): void {
  defaultVariationEditing.value = false
  variationRenameTarget.value = variation
  variationRenameDraft.value = variation
}

function submitVariationRename(): void {
  const currentName = variationRenameTarget.value
  const nextName = variationRenameDraft.value.trim()
  if (!currentName || !nextName) return
  emit('renameVariation', currentName, nextName)
  variationRenameTarget.value = null
}

function confirmVariationDelete(): void {
  const name = variationPendingDelete.value
  if (!name) return
  emit('removeVariation', name)
  variationPendingDelete.value = null
}

function submitDefaultVariationRename(): void {
  const name = defaultVariationDraft.value.trim()
  if (!name) return
  emit('renameDefaultVariation', name)
  defaultVariationEditing.value = false
}

function chooseVariation(variation: string | null): void {
  emit('update:activeVariation', variation)
  variationMenuOpen.value = false
}

function submitNewVariation(): void {
  const name = newVariationDraft.value.trim()
  if (!name) return
  emit('addVariation', name)
  newVariationDraft.value = ''
  variationMenuOpen.value = false
}

function handleWindowClick(event: MouseEvent): void {
  const target = event.target as HTMLElement | null
  if (cropMenuOpen.value && !target?.closest('.crop-menu-wrap')) {
    cropMenuOpen.value = false
  }
  if (projectMenuOpen.value && !target?.closest('.project-menu-wrap')) {
    projectMenuOpen.value = false
  }
  if (variationMenuOpen.value && !target?.closest('.variation-menu-wrap')) {
    variationMenuOpen.value = false
  }
}

onMounted(() => window.addEventListener('click', handleWindowClick))
onBeforeUnmount(() => window.removeEventListener('click', handleWindowClick))
</script>

<template>
  <header class="app-header">
    <div class="header-title">
      <h1 v-if="page === 'files'" class="page-title">
        {{ t('header.filesTitle') }}
      </h1>
      <template v-else>
        <div class="project-menu-wrap">
          <button
            class="header-btn"
            type="button"
            :data-tooltip="t('tooltip.projectMenu')"
            @click.stop="toggleProjectMenu"
          >
            <FolderIcon class="header-btn-icon" :size="15" :stroke-width="1.8" aria-hidden="true" />
            <span>{{ t('button.project') }}</span>
            <ChevronDownIcon :size="14" :stroke-width="2" aria-hidden="true" />
          </button>
          <div v-if="projectMenuOpen" class="project-menu" @click.stop>
            <button
              class="project-menu-item"
              type="button"
              :disabled="!hasImage"
              @click="chooseDuplicateProject"
            >
              <CopyIcon class="project-menu-icon" :size="15" :stroke-width="1.8" aria-hidden="true" />
              <span>{{ t('menu.duplicateProject') }}</span>
            </button>
            <div class="project-menu-sep" />
            <button
              class="project-menu-item"
              type="button"
              :disabled="!hasImage"
              @click="chooseExportProjectFile"
            >
              <FileUpIcon class="project-menu-icon" :size="15" :stroke-width="1.8" aria-hidden="true" />
              <span>{{ t('menu.exportProjectFile') }}</span>
            </button>
            <button
              class="project-menu-item"
              type="button"
              :disabled="!hasImage"
              :title="t('tooltip.replaceImage')"
              @click="chooseReplaceImage"
            >
              <ImageIcon class="project-menu-icon" :size="15" :stroke-width="1.8" aria-hidden="true" />
              <span>{{ t('menu.replaceImage') }}</span>
            </button>
          </div>
        </div>
        <input
          ref="titleInputRef"
          v-model="titleDraft"
          class="project-name-input"
          type="text"
          :aria-label="t('header.projectNameAria')"
          :placeholder="t('header.untitledProject')"
          @keydown="onTitleKeydown"
          @blur="commitTitle"
        />
      </template>
    </div>

    <div v-if="page === 'files'" class="header-actions">
      <button
        class="header-btn"
        type="button"
        :data-tooltip="t('tooltip.importProjectFile')"
        @click="chooseImportProject"
      >
        <FileDownIcon class="header-btn-icon" :size="15" :stroke-width="1.8" aria-hidden="true" />
        <span>{{ t('button.importProject') }}</span>
      </button>
      <button
        class="header-btn header-btn-primary"
        type="button"
        :data-tooltip="t('tooltip.newProject')"
        @click="chooseNewProject"
      >
        <PlusIcon class="header-btn-icon" :size="15" :stroke-width="1.8" aria-hidden="true" />
        <span>{{ t('button.newProject') }}</span>
      </button>
    </div>

    <div v-else class="header-actions">
      <span v-if="isDetecting" class="status-chip">
        <span class="status-chip-spinner" aria-hidden="true" />
        {{ t('status.detectingUiElements') }}
      </span>
      <span v-else-if="isRecognizingText" class="status-chip">
        <span class="status-chip-spinner" aria-hidden="true" />
        {{ t('status.recognizingText') }}
      </span>

      <div class="variation-menu-wrap">
        <button
          class="header-btn"
          type="button"
          :data-tooltip="t('tooltip.variationMenu')"
          @click.stop="toggleVariationMenu"
        >
          <ListChecksIcon class="header-btn-icon" :size="15" :stroke-width="1.8" aria-hidden="true" />
          <span>{{ t('variation.buttonLabel', { name: activeVariation ?? defaultVariationName }) }}</span>
        </button>
        <div v-if="variationMenuOpen" class="variation-menu" @click.stop>
          <form
            v-if="defaultVariationEditing"
            class="variation-add-row"
            @submit.prevent="submitDefaultVariationRename"
          >
            <input
              v-model="defaultVariationDraft"
              class="variation-add-input"
              type="text"
              :aria-label="t('variation.renameDefault')"
              autofocus
              @keydown.esc.prevent="defaultVariationEditing = false"
            />
            <button
              class="variation-add-btn"
              type="submit"
              :disabled="!defaultVariationDraft.trim()"
              :aria-label="t('folder.save')"
            >
              <CheckIcon :size="14" :stroke-width="2" aria-hidden="true" />
            </button>
          </form>
          <div v-else class="variation-default-row">
            <button
              class="variation-menu-item"
              type="button"
              :class="{ active: activeVariation === null }"
              @click="chooseVariation(null)"
            >
              {{ defaultVariationName }}
            </button>
            <button
              class="variation-rename-btn"
              type="button"
              :aria-label="t('variation.renameDefault')"
              :title="t('variation.renameDefault')"
              @click="startDefaultVariationRename"
            >
              <PencilIcon :size="14" :stroke-width="1.8" aria-hidden="true" />
            </button>
          </div>
          <template v-for="variation in variations" :key="variation">
            <form
              v-if="variationRenameTarget === variation"
              class="variation-add-row"
              @submit.prevent="submitVariationRename"
            >
              <input
                v-model="variationRenameDraft"
                class="variation-add-input"
                type="text"
                :aria-label="t('variation.rename')"
                autofocus
                @keydown.esc.prevent="variationRenameTarget = null"
              />
              <button
                class="variation-add-btn"
                type="submit"
                :disabled="!variationRenameDraft.trim()"
                :aria-label="t('folder.save')"
              >
                <CheckIcon :size="14" :stroke-width="2" aria-hidden="true" />
              </button>
            </form>
            <div v-else class="variation-default-row">
              <button
                class="variation-menu-item"
                type="button"
                :class="{ active: activeVariation === variation }"
                @click="chooseVariation(variation)"
              >
                {{ variation }}
              </button>
              <button
                class="variation-rename-btn"
                type="button"
                :aria-label="t('variation.rename')"
                :title="t('variation.rename')"
                @click="startVariationRename(variation)"
              >
                <PencilIcon :size="14" :stroke-width="1.8" aria-hidden="true" />
              </button>
              <button
                class="variation-rename-btn danger"
                type="button"
                :aria-label="t('variation.delete')"
                :title="t('variation.delete')"
                @click="variationPendingDelete = variation"
              >
                <Trash2Icon :size="14" :stroke-width="1.8" aria-hidden="true" />
              </button>
            </div>
          </template>
          <div v-if="variationPendingDelete" class="variation-delete-confirm">
            <p>{{ t('variation.deleteConfirm', { name: variationPendingDelete }) }}</p>
            <div>
              <button type="button" class="btn btn-ghost" @click="variationPendingDelete = null">
                {{ t('confirm.cancel') }}
              </button>
              <button type="button" class="btn btn-danger" @click="confirmVariationDelete">
                {{ t('variation.delete') }}
              </button>
            </div>
          </div>
          <div class="variation-menu-sep" />
          <form class="variation-add-row" @submit.prevent="submitNewVariation">
            <input
              v-model="newVariationDraft"
              class="variation-add-input"
              type="text"
              :placeholder="t('variation.addPlaceholder')"
              :aria-label="t('variation.addPlaceholder')"
            />
            <button
              class="variation-add-btn"
              type="submit"
              :disabled="!newVariationDraft.trim()"
              :aria-label="t('variation.addButton')"
              :title="t('variation.addButton')"
            >
              <PlusIcon :size="14" :stroke-width="2" aria-hidden="true" />
            </button>
          </form>
          <div class="variation-menu-sep" />
          <div class="variation-menu-hint">
            <InfoIcon class="variation-menu-hint-icon" :size="16" :stroke-width="1.8" aria-hidden="true" />
            <span>{{ t('variation.hint') }}</span>
          </div>
        </div>
      </div>

      <button
        class="header-btn"
        type="button"
        :data-tooltip="t('tooltip.copyClipboard')"
        :disabled="!canExport"
        @click="emit('copyClipboard')"
      >
        <CopyIcon v-if="!copyJustSucceeded" class="header-btn-icon" :size="15" :stroke-width="1.8" aria-hidden="true" />
        <CheckIcon v-else class="header-btn-icon" :size="15" :stroke-width="1.8" aria-hidden="true" />
        <span>{{ copyJustSucceeded ? t('button.copied') : t('button.copyClipboard') }}</span>
      </button>
      <button
        class="header-btn header-btn-primary"
        type="button"
        :data-tooltip="t('tooltip.export')"
        :disabled="!canExport"
        @click="emit('export')"
      >
        <DownloadIcon class="header-btn-icon" :size="15" :stroke-width="1.8" aria-hidden="true" />
        <span>{{ t('button.export') }}</span>
      </button>
    </div>
  </header>

  <!-- Single floating dock: tools + modes + scan (no duplicate second bar) -->
  <div v-if="showToolDock" class="tool-dock" @keydown.stop>
    <div class="dock-bar material" role="toolbar" :aria-label="t('aria.editToolbar')">
      <div class="dock-group">
        <button
          class="tool-btn"
          :class="{ active: toolMode === 'select' }"
          type="button"
          :data-tooltip="t('tooltip.toolSelect')"
          :aria-label="t('aria.toolSelect')"
          @click="setTool('select')"
        >
          <MousePointer2Icon :size="20" :stroke-width="2" aria-hidden="true" />
        </button>

        <button
          class="tool-btn"
          :class="{ active: toolMode === 'annotate' }"
          type="button"
          :data-tooltip="t('tooltip.toolAnnotate')"
          :aria-label="t('aria.toolAnnotate')"
          @click="setTool('annotate')"
        >
          <MessageSquareIcon :size="20" :stroke-width="1.8" aria-hidden="true" />
        </button>

        <button
          class="tool-btn"
          :class="{ active: toolMode === 'add-section' }"
          type="button"
          :data-tooltip="t('tooltip.toolAddSection')"
          :aria-label="t('aria.toolAddSection')"
          @click="setTool('add-section')"
        >
          <SquarePlusIcon :size="22" :stroke-width="1.8" aria-hidden="true" />
        </button>

        <button
          class="tool-btn"
          :class="{ active: toolMode === 'crop' }"
          type="button"
          :data-tooltip="t('tooltip.toolCrop')"
          :aria-label="t('aria.toolCrop')"
          @click="setTool('crop')"
        >
          <CropIcon :size="22" :stroke-width="1.8" aria-hidden="true" />
        </button>

        <div class="crop-menu-wrap">
          <button
            class="tool-btn tool-btn-caret"
            type="button"
            :data-tooltip="t('tooltip.cropMenu')"
            :aria-label="t('aria.cropMenu')"
            @click.stop="toggleCropMenu"
          >
            <ChevronDownIcon :size="14" :stroke-width="2" aria-hidden="true" />
          </button>

          <div v-if="cropMenuOpen" class="crop-menu" @click.stop>
            <button
              class="crop-menu-item"
              type="button"
              :disabled="!canUndoCrop"
              @click="chooseUndoCrop"
            >
              {{ t('menu.undoCrop') }}
            </button>
          </div>
        </div>

        <template v-if="toolMode === 'crop'">
          <button
            class="tool-btn tool-btn-affirm"
            type="button"
            :data-tooltip="t('tooltip.cropApply')"
            :aria-label="t('aria.cropApply')"
            @click="emit('confirmCrop')"
          >
            <CheckIcon :size="20" :stroke-width="2.2" aria-hidden="true" />
          </button>
          <button
            class="tool-btn"
            type="button"
            :data-tooltip="t('tooltip.cropCancel')"
            :aria-label="t('aria.cropCancel')"
            @click="emit('cancelCrop')"
          >
            <XIcon :size="20" :stroke-width="2.2" aria-hidden="true" />
          </button>
        </template>
      </div>

      <div class="dock-sep" />

      <div class="dock-group" role="group" :aria-label="t('aria.toggleSections')">
        <button
          v-for="option in sectionVisibilityOptions"
          :key="option.category"
          class="tool-btn"
          :class="{ active: option.checked }"
          type="button"
          :data-tooltip="option.label"
          :aria-label="option.label"
          :aria-pressed="option.checked"
          @click="emit('toggleSectionVisibility', option.category)"
        >
          <component :is="option.icon" :size="20" :stroke-width="1.8" aria-hidden="true" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 18px;
  background: var(--bg-panel);
  border-bottom: 1px solid var(--line);
  backdrop-filter: var(--blur);
  -webkit-backdrop-filter: var(--blur);
  z-index: 5;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1 1 auto;
}

.page-title {
  margin: 0;
  flex: 0 0 auto;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
  white-space: nowrap;
}

.project-name-input {
  display: block;
  flex: 1 1 auto;
  min-width: 0;
  width: auto;
  max-width: min(360px, 42vw);
  margin: 0;
  padding: 4px 8px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
  outline: none;
  transition:
    background var(--press),
    border-color var(--press),
    box-shadow var(--press);
}

.project-name-input::placeholder {
  color: var(--ink-muted);
  font-weight: 650;
}

.project-name-input:hover {
  background: rgba(120, 120, 128, 0.08);
}

.project-name-input:focus {
  background: var(--bg-elevated);
  border-color: rgba(0, 122, 255, 0.35);
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.14);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.header-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: none;
  background: rgba(120, 120, 128, 0.12);
  color: var(--ink);
  border-radius: 980px;
  padding: 7px 14px;
  font-size: 0.8rem;
  font-weight: 590;
}

.header-btn-icon {
  flex: 0 0 auto;
  display: block;
}

.header-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.header-btn-primary {
  background: var(--accent);
  color: #fff;
}

.header-btn-primary:hover:not(:disabled) {
  background: var(--accent-strong);
}

.tool-dock {
  position: fixed;
  /* Center within the main column (right of the nav rail). */
  left: calc(var(--nav-rail-width) + (var(--app-width, 100vw) - var(--nav-rail-width)) / 2);
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 40;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
  animation: dock-rise var(--spring);
}

@keyframes dock-rise {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.material {
  background: rgba(30, 30, 32, 0.72);
  color: #f5f5f7;
  backdrop-filter: blur(28px) saturate(180%);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.22),
    inset 0 0.5px 0 rgba(255, 255, 255, 0.18);
}

.dock-bar {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px;
  border-radius: 16px;
}

.dock-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.dock-sep {
  width: 1px;
  height: 26px;
  margin: 0 6px;
  background: rgba(255, 255, 255, 0.16);
}

.tool-btn {
  position: relative;
  appearance: none;
  border: none;
  background: transparent;
  color: rgba(245, 245, 247, 0.92);
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  height: 44px;
  padding: 0 8px;
}

.tool-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.tool-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.tool-btn.active {
  background: var(--accent);
  color: #fff;
  box-shadow: 0 2px 10px rgba(0, 122, 255, 0.35);
}

.crop-menu-wrap {
  position: relative;
}

.project-menu-wrap {
  position: relative;
  flex: 0 0 auto;
}

.project-menu {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  background: var(--bg-elevated);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 4px;
  min-width: 220px;
  box-shadow: var(--shadow-lg);
  z-index: 50;
}

.project-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  color: var(--ink);
  font-size: 0.82rem;
  font-weight: 590;
  padding: 9px 10px;
  border-radius: 7px;
  white-space: nowrap;
}

.project-menu-icon {
  flex: 0 0 auto;
  opacity: 0.78;
}

.project-menu-item:hover:not(:disabled) {
  background: rgba(120, 120, 128, 0.12);
}

.project-menu-item:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.project-menu-sep {
  height: 1px;
  margin: 4px 6px;
  background: var(--line);
}

.variation-menu-wrap {
  position: relative;
  flex: 0 0 auto;
}

.variation-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: var(--bg-elevated);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 4px;
  min-width: 280px;
  box-shadow: var(--shadow-lg);
  z-index: 50;
}

.variation-menu-hint {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 6px 8px 4px;
  color: var(--ink-muted);
  font-size: 0.72rem;
  line-height: 1.4;
}

.variation-menu-hint-icon {
  flex: 0 0 auto;
  margin-top: 1px;
}

.variation-menu-item {
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  color: var(--ink);
  font-size: 0.82rem;
  font-weight: 590;
  padding: 8px 10px;
  border-radius: 7px;
  white-space: nowrap;
}

.variation-menu-item:hover {
  background: rgba(120, 120, 128, 0.12);
}

.variation-menu-item.active {
  color: var(--accent-strong);
  font-weight: 700;
}

.variation-default-row {
  display: flex;
  align-items: center;
}

.variation-default-row .variation-menu-item {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
}

.variation-rename-btn {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--ink-muted);
}

.variation-rename-btn:hover {
  background: rgba(120, 120, 128, 0.12);
  color: var(--ink);
}

.variation-rename-btn.danger:hover {
  color: var(--danger);
}

.variation-delete-confirm {
  margin: 4px;
  padding: 9px;
  border: 1px solid color-mix(in srgb, var(--danger) 35%, var(--line));
  border-radius: 8px;
  background: color-mix(in srgb, var(--danger) 7%, var(--bg-elevated));
}

.variation-delete-confirm p {
  margin: 0 0 8px;
  font-size: 0.78rem;
  line-height: 1.4;
}

.variation-delete-confirm > div {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.variation-delete-confirm .btn {
  min-height: 28px;
  padding: 4px 9px;
  font-size: 0.75rem;
}

.variation-menu-sep {
  height: 1px;
  margin: 4px 6px;
  background: var(--line);
}

.variation-add-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 4px 2px;
}

.variation-add-input {
  flex: 1;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid var(--line-strong);
  border-radius: 7px;
  background: var(--input-bg);
  color: var(--ink);
  font-size: 0.8rem;
}

.variation-add-btn {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 7px;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
}

.variation-add-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.tool-btn-caret {
  min-width: 22px;
  width: 22px;
  padding: 0;
  margin-left: -4px;
}

.tool-btn-affirm {
  color: #34c759;
}

.tool-btn-affirm:hover {
  background: rgba(52, 199, 89, 0.16);
}

.crop-menu {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(30, 30, 32, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  padding: 4px;
  min-width: 160px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.3);
  z-index: 50;
}

.crop-menu-item {
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  color: #f5f5f7;
  font-size: 0.8rem;
  padding: 8px 10px;
  border-radius: 6px;
  white-space: nowrap;
}

.crop-menu-item:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
}

.crop-menu-item:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* Custom tooltips — native title is slow and inconsistent */
.tool-btn[data-tooltip]::after,
.header-btn[data-tooltip]::after {
  content: attr(data-tooltip);
  position: absolute;
  left: 50%;
  bottom: calc(100% + 10px);
  transform: translateX(-50%) translateY(4px);
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(28, 28, 30, 0.92);
  color: #f5f5f7;
  font-size: 0.72rem;
  font-weight: 590;
  letter-spacing: -0.01em;
  white-space: nowrap;
  line-height: 1.3;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.22);
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 120ms ease,
    transform 120ms ease;
  transition-delay: 0ms;
  z-index: 60;
}

.header-btn[data-tooltip]::after {
  bottom: auto;
  top: calc(100% + 8px);
  transform: translateX(-50%) translateY(-4px);
}

.tool-btn[data-tooltip]:hover::after,
.tool-btn[data-tooltip]:focus-visible::after,
.header-btn[data-tooltip]:hover::after,
.header-btn[data-tooltip]:focus-visible::after {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
  transition-delay: 280ms;
}

.tool-btn[data-tooltip]:disabled:hover::after {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .tool-dock {
    animation: none;
  }

  .tool-btn[data-tooltip]::after,
  .header-btn[data-tooltip]::after {
    transition: none;
  }
}

@media (max-width: 720px) {
  .tool-dock {
    bottom: 12px;
    width: min(100vw - 16px, 420px);
  }

  .dock-bar {
    justify-content: center;
    width: 100%;
  }
}
</style>
