import type { SectionKind, TextStylePreset } from '../types/annotation'
import { t, type MessageKey } from './index'

const TEXT_STYLE_KEYS: Record<TextStylePreset, MessageKey> = {
  auto: 'textStyle.auto',
  'white-black-stroke': 'textStyle.whiteBlackStroke',
  'black-white-stroke': 'textStyle.blackWhiteStroke',
  'semi-transparent-bg': 'textStyle.semiTransparentBg',
  'local-invert': 'textStyle.localInvert',
  label: 'textStyle.label',
}

const SECTION_KIND_KEYS: Record<SectionKind, MessageKey> = {
  region: 'sectionKind.region',
  text: 'sectionKind.text',
}

export function sectionKindLabel(kind: SectionKind): string {
  return t(SECTION_KIND_KEYS[kind])
}

export function textStyleLabel(style: TextStylePreset): string {
  return t(TEXT_STYLE_KEYS[style])
}

export function textStyleOptions(): Array<{ value: TextStylePreset; label: string }> {
  return (Object.keys(TEXT_STYLE_KEYS) as TextStylePreset[]).map((value) => ({
    value,
    label: textStyleLabel(value),
  }))
}
