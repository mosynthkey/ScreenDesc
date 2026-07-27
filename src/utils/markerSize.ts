export const CALLOUT_FONT_SIZE = 40
export const CALLOUT_FONT_SIZE_MIN = 16
export const CALLOUT_FONT_SIZE_MAX = 240

export const DOT_RADIUS_MIN = 1.5
export const DOT_RADIUS_MAX = 42
export const DOT_RADIUS_STEP = 0.5

/** Fallback when image size is unknown. */
export const ANCHOR_OFFSET_FALLBACK = 200
export const ANCHOR_OFFSET_STEP = 1

/** Default gap outside the section border when `anchorOutside` is on. */
export const DEFAULT_ANCHOR_OUTSIDE_GAP = 8
export const ANCHOR_OUTSIDE_GAP_MIN = 0
export const ANCHOR_OUTSIDE_GAP_MAX = 120
export const ANCHOR_OUTSIDE_GAP_STEP = 1

export function normalizeAnchorOutsideGap(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.min(
      ANCHOR_OUTSIDE_GAP_MAX,
      Math.max(ANCHOR_OUTSIDE_GAP_MIN, Math.round(value)),
    )
  }
  return DEFAULT_ANCHOR_OUTSIDE_GAP
}

/** Baseline image-to-label distance (see `requiredGutterFor` in calloutLayout.ts). */
export const DEFAULT_IMAGE_GUTTER = 30
export const IMAGE_GUTTER_MIN = 0
export const IMAGE_GUTTER_MAX = 120
export const IMAGE_GUTTER_STEP = 1

export function normalizeImageGutter(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.min(IMAGE_GUTTER_MAX, Math.max(IMAGE_GUTTER_MIN, Math.round(value)))
  }
  return DEFAULT_IMAGE_GUTTER
}

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