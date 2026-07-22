export const CALLOUT_FONT_SIZE = 40
export const CALLOUT_FONT_SIZE_MIN = 16
export const CALLOUT_FONT_SIZE_MAX = 240

export const DOT_RADIUS_MIN = 1.5
export const DOT_RADIUS_MAX = 42
export const DOT_RADIUS_STEP = 0.5

/** Fallback when image size is unknown. */
export const ANCHOR_OFFSET_FALLBACK = 200
export const ANCHOR_OFFSET_STEP = 1

export function anchorOffsetExtent(imageSize: number): number {
  if (!Number.isFinite(imageSize) || imageSize <= 0) return ANCHOR_OFFSET_FALLBACK
  return Math.max(1, Math.round(imageSize))
}

export function clampAnchorOffsetAxis(
  value: number,
  imageSize: number,
): number {
  const extent = anchorOffsetExtent(imageSize)
  return Math.min(extent, Math.max(-extent, Math.round(value)))
}