import type { SectionKind, TextStylePreset } from '../types/annotation'

export const SECTION_KIND_LABELS: Record<SectionKind, string> = {
  region: '領域',
  text: 'テキスト',
}

export const TEXT_STYLE_LABELS: Record<TextStylePreset, string> = {
  auto: '自動（背景に合わせる）',
  'white-black-stroke': '白文字＋黒縁',
  'black-white-stroke': '黒文字＋白縁',
  'semi-transparent-bg': '半透明背景',
  'local-invert': '周辺を反転',
  balloon: '吹き出し',
  label: 'ラベル',
}

export const TEXT_STYLE_OPTIONS = (
  Object.entries(TEXT_STYLE_LABELS) as [TextStylePreset, string][]
).map(([value, label]) => ({ value, label }))
