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
export const LINE_WIDTH_MAX = 54

export const DEFAULT_LINE_HALO_WIDTH = 0
export const LINE_HALO_WIDTH_MIN = 0
export const LINE_HALO_WIDTH_MAX = 36
export const DEFAULT_LINE_HALO_COLOR = '#ffffff'

export const LINE_DASH_LENGTH_MIN = 1
export const LINE_DASH_LENGTH_MAX = 80
export const LINE_DASH_GAP_MIN = 1
export const LINE_DASH_GAP_MAX = 80

/** Dash segment length that matches the pre-configurable auto-scaled look for a given stroke width. */
export function defaultLineDashLength(lineWidth: number): number {
  return Math.max(4, Math.round(Math.max(LINE_WIDTH_MIN, lineWidth) * 1.5 * 10) / 10)
}

/** Gap length that matches the pre-configurable auto-scaled look for a given stroke width. */
export function defaultLineDashGap(lineWidth: number): number {
  return Math.max(3, Math.round(Math.max(LINE_WIDTH_MIN, lineWidth) * 10) / 10)
}

export function normalizeLineHaloWidth(width: unknown): number {
  if (typeof width === 'number' && Number.isFinite(width)) {
    return Math.min(LINE_HALO_WIDTH_MAX, Math.max(LINE_HALO_WIDTH_MIN, width))
  }
  return DEFAULT_LINE_HALO_WIDTH
}

/** `raw` missing (old saves, never-customized projects) falls back to the width-scaled default. */
export function normalizeLineDashLength(raw: unknown, lineWidth: number): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.min(LINE_DASH_LENGTH_MAX, Math.max(LINE_DASH_LENGTH_MIN, raw))
  }
  return defaultLineDashLength(lineWidth)
}

/** `raw` missing (old saves, never-customized projects) falls back to the width-scaled default. */
export function normalizeLineDashGap(raw: unknown, lineWidth: number): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.min(LINE_DASH_GAP_MAX, Math.max(LINE_DASH_GAP_MIN, raw))
  }
  return defaultLineDashGap(lineWidth)
}

export function normalizeLineHaloColor(value: unknown): string {
  if (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)) return value
  return DEFAULT_LINE_HALO_COLOR
}

export function getLineStyleOptions(): Array<{ value: LineStyleId; label: string }> {
  return [
    { value: 'solid', label: t('lineStyle.solid') },
    { value: 'dashed', label: t('lineStyle.dashed') },
    { value: 'invert', label: t('lineStyle.invert') },
  ]
}

export function getLineStyleSpec(
  id: LineStyleId,
  strokeWidth: number,
  dashLength?: number,
  dashGap?: number,
): LineStyleSpec {
  const width = Math.max(LINE_WIDTH_MIN, strokeWidth)
  if (id === 'dashed') {
    const dash = dashLength ?? defaultLineDashLength(width)
    const gap = dashGap ?? defaultLineDashGap(width)
    return { strokeWidth: width, dasharray: `${dash} ${gap}` }
  }
  if (id === 'invert') {
    return { strokeWidth: width, dasharray: null, blendMode: 'difference' }
  }
  return { strokeWidth: width, dasharray: null }
}

export function normalizeLineStyle(
  style: unknown,
  lineWidth?: unknown,
): { lineStyle: LineStyleId; lineWidth: number } {
  const width =
    typeof lineWidth === 'number' && Number.isFinite(lineWidth)
      ? Math.min(LINE_WIDTH_MAX, Math.max(LINE_WIDTH_MIN, lineWidth))
      : DEFAULT_LINE_WIDTH

  if (style === 'dashed') return { lineStyle: 'dashed', lineWidth: width }
  if (style === 'invert') return { lineStyle: 'invert', lineWidth: width }
  return { lineStyle: 'solid', lineWidth: width }
}
