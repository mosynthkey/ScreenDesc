<script setup lang="ts">
import { onMounted } from 'vue'
import type {
  Annotation,
  AnnotationMode,
  CalloutSide,
  LineStyleId,
  TextStylePreset,
} from '../types/annotation'
import { TEXT_STYLE_LABELS, TEXT_STYLE_OPTIONS } from '../i18n/labels'
import { GOOGLE_FONT_OPTIONS, loadGoogleFont } from '../utils/googleFonts'
import { LINE_STYLE_OPTIONS } from '../utils/lineStyle'

const CALLOUT_FONT_SIZE_OPTIONS = [12, 14, 16, 18, 20, 24, 28, 32, 36, 40]
const DOT_RADIUS_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 2.5, label: '小' },
  { value: 4.5, label: '標準' },
  { value: 6.5, label: '大' },
  { value: 9, label: '特大' },
]
const CALLOUT_BORDER_WIDTH_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: '枠なし' },
  { value: 0.75, label: '極細' },
  { value: 1.5, label: '標準' },
  { value: 2.5, label: '太め' },
  { value: 4, label: '極太' },
]

defineProps<{
  annotation: Annotation | null
  defaultAnnotationMode: AnnotationMode
  defaultTextStyle: TextStylePreset
  defaultFontFamily: string
  lineStyle: LineStyleId
  lineColor: string
  dotColor: string
  dotRadius: number
  lineHalo: boolean
  calloutFontSize: number
  calloutBorderWidth: number
}>()

const emit = defineEmits<{
  'update:defaultAnnotationMode': [mode: AnnotationMode]
  'update:defaultTextStyle': [style: TextStylePreset]
  'update:defaultFontFamily': [fontFamily: string]
  'update:lineStyle': [style: LineStyleId]
  'update:lineColor': [color: string]
  'update:dotColor': [color: string]
  'update:dotRadius': [radius: number]
  'update:lineHalo': [enabled: boolean]
  'update:calloutFontSize': [size: number]
  'update:calloutBorderWidth': [width: number]
  patch: [
    patch: Partial<{
      textStyle: TextStylePreset
      calloutSide: CalloutSide
      description: string
    }>,
  ]
}>()

onMounted(() => {
  for (const option of GOOGLE_FONT_OPTIONS) {
    loadGoogleFont(option.family)
  }
})
</script>

<template>
  <div>
    <div class="settings-group settings-group-project">
      <h3 class="panel-title">
        <span class="title-icon" aria-hidden="true">⚙</span>
        プロジェクト全体の設定
      </h3>
      <div class="field">
        <label>配置方法</label>
        <select
          :value="defaultAnnotationMode"
          @change="emit('update:defaultAnnotationMode', ($event.target as HTMLSelectElement).value as AnnotationMode)"
        >
          <option value="inline">画像内番号</option>
          <option value="callout">コールアウト</option>
        </select>
      </div>
      <div v-if="defaultAnnotationMode === 'callout'" class="field">
        <label>引き出し線の太さ・線種</label>
        <select
          :value="lineStyle"
          @change="emit('update:lineStyle', ($event.target as HTMLSelectElement).value as LineStyleId)"
        >
          <option v-for="option in LINE_STYLE_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>
      <div v-if="defaultAnnotationMode === 'callout' && lineStyle !== 'invert'" class="field">
        <label>引き出し線・両端の丸の色</label>
        <div class="color-row">
          <label class="color-swatch">
            線
            <input
              type="color"
              :value="lineColor"
              @input="emit('update:lineColor', ($event.target as HTMLInputElement).value)"
            />
          </label>
          <label class="color-swatch">
            丸
            <input
              type="color"
              :value="dotColor"
              @input="emit('update:dotColor', ($event.target as HTMLInputElement).value)"
            />
          </label>
        </div>
      </div>
      <div v-if="defaultAnnotationMode === 'callout'" class="field">
        <label>始点・終点の丸の大きさ</label>
        <select
          :value="dotRadius"
          @change="emit('update:dotRadius', Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="option in DOT_RADIUS_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>
      <label v-if="defaultAnnotationMode === 'callout' && lineStyle !== 'invert'" class="check field">
        <input
          type="checkbox"
          :checked="lineHalo"
          @change="emit('update:lineHalo', ($event.target as HTMLInputElement).checked)"
        />
        線に白い縁取りを付ける(背景が濃い時に見やすくする)
      </label>
      <div v-if="defaultAnnotationMode === 'callout'" class="field">
        <label>コールアウトの文字サイズ</label>
        <select
          :value="calloutFontSize"
          @change="emit('update:calloutFontSize', Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="size in CALLOUT_FONT_SIZE_OPTIONS" :key="size" :value="size">
            {{ size }}px
          </option>
        </select>
      </div>
      <div v-if="defaultAnnotationMode === 'callout'" class="field">
        <label>コールアウト枠の太さ</label>
        <select
          :value="calloutBorderWidth"
          @change="emit('update:calloutBorderWidth', Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="option in CALLOUT_BORDER_WIDTH_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>
      <div class="field">
        <label>デフォルトの文字スタイル</label>
        <select
          :value="defaultTextStyle"
          @change="emit('update:defaultTextStyle', ($event.target as HTMLSelectElement).value as TextStylePreset)"
        >
          <option v-for="option in TEXT_STYLE_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>
      <div class="field" style="margin-bottom: 0">
        <label>デフォルトのフォント（Google Fonts）</label>
        <select
          :value="defaultFontFamily"
          @change="emit('update:defaultFontFamily', ($event.target as HTMLSelectElement).value)"
        >
          <option
            v-for="option in GOOGLE_FONT_OPTIONS"
            :key="option.family"
            :value="option.family"
            :style="{ fontFamily: `'${option.family}', sans-serif` }"
          >
            {{ option.label }}
          </option>
        </select>
      </div>
    </div>

    <div v-if="annotation" class="settings-group settings-group-annotation">
      <h3 class="panel-title">
        <span class="title-icon" aria-hidden="true">✎</span>
        選択中の注釈
      </h3>
      <div class="field">
        <label>文字スタイル</label>
        <select
          :value="annotation.textStyle"
          @change="emit('patch', { textStyle: ($event.target as HTMLSelectElement).value as TextStylePreset })"
        >
          <option v-for="option in TEXT_STYLE_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>
      <div v-if="defaultAnnotationMode === 'callout'" class="field">
        <label>コールアウトの位置</label>
        <select
          :value="annotation.calloutSide"
          @change="emit('patch', { calloutSide: ($event.target as HTMLSelectElement).value as CalloutSide })"
        >
          <option value="auto">自動</option>
          <option value="left">左</option>
          <option value="right">右</option>
        </select>
      </div>
      <div class="field" style="margin-bottom: 0">
        <label>説明</label>
        <textarea
          :value="annotation.description"
          placeholder="例: ［保存］をクリック"
          @input="emit('patch', { description: ($event.target as HTMLTextAreaElement).value })"
        />
      </div>
      <p class="hint" style="margin-top: 10px; margin-bottom: 0">
        適用スタイル: <strong>{{ TEXT_STYLE_LABELS[annotation.resolvedStyle] }}</strong>
      </p>
    </div>
    <p v-else class="hint">注釈を選択すると、スタイルと説明を編集できます。</p>
  </div>
</template>

<style scoped>
.settings-group {
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 14px;
  background: rgba(120, 120, 128, 0.05);
}

.settings-group + .settings-group,
.settings-group + p.hint {
  margin-top: 14px;
}

.settings-group .panel-title {
  display: flex;
  align-items: center;
  gap: 6px;
}

.settings-group-annotation {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.settings-group-annotation .panel-title {
  color: var(--accent-strong);
}

.title-icon {
  font-size: 0.85em;
  opacity: 0.8;
}

.color-row {
  display: flex;
  gap: 16px;
}

.color-swatch {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.78rem;
  font-weight: 590;
  color: var(--ink-muted);
}

.color-swatch input[type='color'] {
  width: 36px;
  height: 28px;
  padding: 2px;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.8);
  cursor: pointer;
}

.check {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  font-size: 0.82rem;
  cursor: pointer;
}
</style>
