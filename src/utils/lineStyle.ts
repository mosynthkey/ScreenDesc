import type { LineStyleId } from '../types/annotation'

export interface LineStyleSpec {
  label: string
  strokeWidth: number
  dasharray: string | null
  /** When set to `difference`, stroke color is ignored and the line inverts underlying pixels. */
  blendMode?: 'difference'
}

export const LINE_STYLE_OPTIONS: Array<{ value: LineStyleId; label: string }> = [
  { value: 'thin', label: '細線' },
  { value: 'thick', label: '太線' },
  { value: 'dashed', label: '破線' },
  { value: 'invert', label: '周囲反転（背景を問わず見える）' },
]

const SPECS: Record<LineStyleId, LineStyleSpec> = {
  thin: { label: '細線', strokeWidth: 2, dasharray: null },
  thick: { label: '太線', strokeWidth: 4.5, dasharray: null },
  dashed: { label: '破線', strokeWidth: 2, dasharray: '6 4' },
  invert: { label: '周囲反転（背景を問わず見える）', strokeWidth: 3, dasharray: null, blendMode: 'difference' },
}

export function getLineStyleSpec(id: LineStyleId): LineStyleSpec {
  return SPECS[id] ?? SPECS.thin
}
