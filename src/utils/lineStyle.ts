import type { LineStyleId } from '../types/annotation'
import { t } from '../i18n'

export interface LineStyleSpec {
  strokeWidth: number
  dasharray: string | null
  /** When set to `difference`, stroke color is ignored and the line inverts underlying pixels. */
  blendMode?: 'difference'
}

const SPECS: Record<LineStyleId, LineStyleSpec> = {
  thin: { strokeWidth: 2, dasharray: null },
  thick: { strokeWidth: 4.5, dasharray: null },
  dashed: { strokeWidth: 2, dasharray: '6 4' },
  invert: { strokeWidth: 3, dasharray: null, blendMode: 'difference' },
}

export function getLineStyleOptions(): Array<{ value: LineStyleId; label: string }> {
  return [
    { value: 'thin', label: t('lineStyle.thin') },
    { value: 'thick', label: t('lineStyle.thick') },
    { value: 'dashed', label: t('lineStyle.dashed') },
    { value: 'invert', label: t('lineStyle.invert') },
  ]
}

export function getLineStyleSpec(id: LineStyleId): LineStyleSpec {
  return SPECS[id] ?? SPECS.thin
}
