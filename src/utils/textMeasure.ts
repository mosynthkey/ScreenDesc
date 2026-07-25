import { canvasFont } from './googleFonts'

let sharedContext: CanvasRenderingContext2D | null = null

function getContext(): CanvasRenderingContext2D | null {
  if (sharedContext) return sharedContext
  const canvas = document.createElement('canvas')
  sharedContext = canvas.getContext('2d')
  return sharedContext
}

export function measureTextWidth(
  text: string,
  fontPx: number,
  fontFamily: string,
  fontWeight = 700,
  italic = false,
): number {
  const ctx = getContext()
  if (!ctx) return text.length * fontPx * 0.9
  ctx.font = canvasFont(fontWeight, italic, fontPx, fontFamily)
  return ctx.measureText(text).width
}

/**
 * Offset from the visual ink center down to the alphabetic baseline.
 * Use as `baselineY = centerY + measureTextBaselineFromCenter(...)`.
 */
export function measureTextBaselineFromCenter(
  text: string,
  fontPx: number,
  fontFamily: string,
  fontWeight = 700,
  italic = false,
): number {
  const ctx = getContext()
  if (!ctx) return fontPx * 0.35
  ctx.font = canvasFont(fontWeight, italic, fontPx, fontFamily)
  const sample = text.trim() || 'あAg'
  const metrics = ctx.measureText(sample)
  const ascent =
    typeof metrics.actualBoundingBoxAscent === 'number' &&
    Number.isFinite(metrics.actualBoundingBoxAscent)
      ? metrics.actualBoundingBoxAscent
      : fontPx * 0.8
  const descent =
    typeof metrics.actualBoundingBoxDescent === 'number' &&
    Number.isFinite(metrics.actualBoundingBoxDescent)
      ? metrics.actualBoundingBoxDescent
      : fontPx * 0.2
  return (ascent - descent) / 2
}
