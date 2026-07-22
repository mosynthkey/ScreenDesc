import type { LineStyleId } from '../types/annotation'
import { t } from '../i18n'

export interface LineStyleSpec {
  strokeWidth: number
  dasharray: string | null
  /** When set to `difference`, stroke color is ignored and the line inverts underlying pixels. */
  blendMode?: 'difference'
}

export const DEFAULT_LINE_WIDTH = 4.5
export const LINE_WIDTH_MIN = 1
export const LINE_WIDTH_MAX = 18

export const DEFAULT_LINE_OPACITY = 1
export const LINE_OPACITY_MIN = 0.05
export const LINE_OPACITY_MAX = 1

export function normalizeLineOpacity(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_LINE_OPACITY
  return Math.min(LINE_OPACITY_MAX, Math.max(LINE_OPACITY_MIN, value))
}

export function getLineStyleOptions(): Array<{ value: LineStyleId; label: string }> {
  return [
    { value: 'solid', label: t('lineStyle.solid') },
    { value: 'dashed', label: t('lineStyle.dashed') },
    { value: 'invert', label: t('lineStyle.invert') },
  ]
}

export function getLineStyleSpec(id: LineStyleId, strokeWidth: number): LineStyleSpec {
  const width = Math.max(LINE_WIDTH_MIN, strokeWidth)
  if (id === 'dashed') {
    const dash = Math.max(4, Math.round(width * 1.5 * 10) / 10)
    const gap = Math.max(3, Math.round(width * 10) / 10)
    return { strokeWidth: width, dasharray: `${dash} ${gap}` }
  }
  if (id === 'invert') {
    return { strokeWidth: width, dasharray: null, blendMode: 'difference' }
  }
  return { strokeWidth: width, dasharray: null }
}

/** Map legacy thin/thick ids from older project files. */
export function normalizeLineStyle(
  style: unknown,
  lineWidth?: unknown,
): { lineStyle: LineStyleId; lineWidth: number } {
  const width =
    typeof lineWidth === 'number' && Number.isFinite(lineWidth)
      ? Math.min(LINE_WIDTH_MAX, Math.max(LINE_WIDTH_MIN, lineWidth))
      : undefined

  if (style === 'dashed') {
    return { lineStyle: 'dashed', lineWidth: width ?? DEFAULT_LINE_WIDTH }
  }
  if (style === 'invert') {
    return { lineStyle: 'invert', lineWidth: width ?? DEFAULT_LINE_WIDTH }
  }
  if (style === 'thin') {
    return { lineStyle: 'solid', lineWidth: width ?? 2 }
  }
  if (style === 'thick' || style === 'solid') {
    return { lineStyle: 'solid', lineWidth: width ?? DEFAULT_LINE_WIDTH }
  }
  return { lineStyle: 'solid', lineWidth: width ?? DEFAULT_LINE_WIDTH }
}
