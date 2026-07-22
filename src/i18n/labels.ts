import type { SectionKind } from '../types/annotation'
import { t, type MessageKey } from './index'

const SECTION_KIND_KEYS: Record<SectionKind, MessageKey> = {
  region: 'sectionKind.region',
  text: 'sectionKind.text',
}

export function sectionKindLabel(kind: SectionKind): string {
  return t(SECTION_KIND_KEYS[kind])
}
