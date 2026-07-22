import type { AnchorStyleId, Point } from '../types/annotation'
import { t } from '../i18n'

export type { AnchorStyleId }

export const DEFAULT_ANCHOR_STYLE: AnchorStyleId = 'dot'

const ANCHOR_STYLE_IDS: readonly AnchorStyleId[] = ['dot', 'arrow', 'chevron']

export function isAnchorStyleId(value: unknown): value is AnchorStyleId {
  return typeof value === 'string' && (ANCHOR_STYLE_IDS as readonly string[]).includes(value)
}

export function normalizeAnchorStyle(value: unknown): AnchorStyleId {
  return isAnchorStyleId(value) ? value : DEFAULT_ANCHOR_STYLE
}

export function isArrowAnchorStyle(style: AnchorStyleId): boolean {
  return style === 'arrow' || style === 'chevron'
}

export function getAnchorStyleOptions(): Array<{ value: AnchorStyleId; label: string }> {
  return [
    { value: 'dot', label: t('anchorStyle.dot') },
    { value: 'arrow', label: t('anchorStyle.arrow') },
    { value: 'chevron', label: t('anchorStyle.chevron') },
  ]
}

export function leaderLeaveUnit(anchor: Point, endX: number): Point {
  const deltaX = endX - anchor.x
  const direction = deltaX === 0 ? 1 : Math.sign(deltaX)
  return { x: direction, y: 0 }
}

export interface AnchorArrowGeometry {
  /** Notch / base midline facing the label. Leader start for filled arrows. */
  center: Point
  tip: Point
  left: Point
  right: Point
}

/**
 * Arrowhead centered on `anchor`.
 * Tip points at the annotated target; notched base faces the label.
 */
export function buildAnchorArrowGeometry(
  anchor: Point,
  endX: number,
  radius: number,
): AnchorArrowGeometry {
  const leave = leaderLeaveUnit(anchor, endX)
  const towardTargetX = -leave.x
  const towardTargetY = -leave.y
  const perpX = -towardTargetY
  const perpY = towardTargetX

  // Classic marker arrowhead: longer than wide, concave base (notch).
  const length = Math.max(11, radius * 2.35)
  const halfWidth = Math.max(4, radius * 1.05)
  const notchDepth = length * 0.22

  const tip: Point = {
    x: anchor.x + towardTargetX * length * 0.55,
    y: anchor.y + towardTargetY * length * 0.55,
  }
  const baseMid: Point = {
    x: anchor.x - towardTargetX * length * 0.45,
    y: anchor.y - towardTargetY * length * 0.45,
  }
  const notch: Point = {
    x: baseMid.x + towardTargetX * notchDepth,
    y: baseMid.y + towardTargetY * notchDepth,
  }
  return {
    center: notch,
    tip,
    left: {
      x: baseMid.x + perpX * halfWidth,
      y: baseMid.y + perpY * halfWidth,
    },
    right: {
      x: baseMid.x - perpX * halfWidth,
      y: baseMid.y - perpY * halfWidth,
    },
  }
}

/** Filled arrow leaves from the notched base; chevron continues from the tip. */
export function leaderAttachPoint(
  style: AnchorStyleId,
  geometry: AnchorArrowGeometry,
): Point {
  return style === 'chevron' ? geometry.tip : geometry.center
}

export function dotLeaderAttachPoint(
  anchor: Point,
  endX: number,
  radius: number,
): Point {
  const leave = leaderLeaveUnit(anchor, endX)
  return {
    x: anchor.x + leave.x * radius,
    y: anchor.y + leave.y * radius,
  }
}

export function buildAnchorHeadPath(
  style: AnchorStyleId,
  geometry: AnchorArrowGeometry,
): string {
  const { tip, left, right, center } = geometry
  if (style === 'chevron') {
    return `M ${left.x} ${left.y} L ${tip.x} ${tip.y} L ${right.x} ${right.y}`
  }
  return `M ${tip.x} ${tip.y} L ${left.x} ${left.y} L ${center.x} ${center.y} L ${right.x} ${right.y} Z`
}
