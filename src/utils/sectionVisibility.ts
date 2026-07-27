import type { Section, SectionVisibilityCategory } from '../types/annotation'
import type { MessageKey } from '../i18n'

/** Single source of truth for which categories exist, and their order in the toolbar menu. */
export const SECTION_VISIBILITY_CATEGORIES: readonly SectionVisibilityCategory[] = [
  'ai-region',
  'ai-text',
  'manual',
]

export const SECTION_VISIBILITY_LABEL_KEYS: Record<SectionVisibilityCategory, MessageKey> = {
  'ai-region': 'sectionVisibility.aiRegion',
  'ai-text': 'sectionVisibility.aiText',
  manual: 'sectionVisibility.manual',
}

export type SectionVisibilityMap = Partial<Record<SectionVisibilityCategory, boolean>>

/** Which toggle category a section falls under. */
export function categoryForSection(section: Section): SectionVisibilityCategory {
  if (section.source === 'manual') return 'manual'
  return section.kind === 'text' ? 'ai-text' : 'ai-region'
}

export function defaultSectionVisibility(): SectionVisibilityMap {
  const map: SectionVisibilityMap = {}
  for (const category of SECTION_VISIBILITY_CATEGORIES) map[category] = true
  return map
}

/** Missing entries default to visible, so old saves and future categories both show by default. */
export function isSectionVisible(section: Section, visibility: SectionVisibilityMap): boolean {
  return visibility[categoryForSection(section)] !== false
}

/**
 * Normalizes persisted visibility data, filling in any category missing from
 * `raw` (old save, or a category added after that save was written) with
 * `true`. `legacyAllHidden` covers the very first shape of this feature
 * (a single combined `showSections` boolean) — when that was `false`,
 * every category starts hidden instead of visible.
 */
export function normalizeSectionVisibility(
  raw: unknown,
  legacyAllVisible = true,
): SectionVisibilityMap {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const map: SectionVisibilityMap = {}
  for (const category of SECTION_VISIBILITY_CATEGORIES) {
    const value = source[category]
    map[category] = typeof value === 'boolean' ? value : legacyAllVisible
  }
  return map
}
