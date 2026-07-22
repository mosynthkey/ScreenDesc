import type { AnchorStyleId, Point } from '../types/annotation'
import { t } from '../i18n'
import { buildLeaderPath } from './calloutLayout'

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

/** Initial leader tangent leaves the anchor toward the label (horizontal stub). */
export function leaderLeaveUnit(anchor: Point, endX: number): Point {
  const deltaX = endX - anchor.x
  const direction = deltaX === 0 ? 1 : Math.sign(deltaX)
  return { x: direction, y: 0 }
}

export interface AnchorArrowGeometry {
  /** Base midline (| of <|), facing the label. Used as leader start for filled arrows. */
  center: Point
  tip: Point
  left: Point
  right: Point
}

/**
 * Arrow geometry centered on `anchor`.
 * Tip points at the annotated target; base faces the label.
 */
export function buildAnchorArrowGeometry(
  anchor: Point,
  endX: number,
  radius: number,
): AnchorArrowGeometry {
  const leave = leaderLeaveUnit(anchor, endX)
  const towardTargetX = -leave.x
  const towardTargetY = -leave.y
  const halfLength = Math.max(5, radius * 1.45)
  const halfWidth = Math.max(4, radius * 1.55)
  const tip: Point = {
    x: anchor.x + towardTargetX * halfLength,
    y: anchor.y + towardTargetY * halfLength,
  }
  const baseMid: Point = {
    x: anchor.x - towardTargetX * halfLength,
    y: anchor.y - towardTargetY * halfLength,
  }
  const perpX = -towardTargetY
  const perpY = towardTargetX
  return {
    center: baseMid,
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

/** Filled arrow leaves from the base; chevron continues from the tip. */
export function leaderAttachPoint(
  style: AnchorStyleId,
  geometry: AnchorArrowGeometry,
): Point {
  return style === 'chevron' ? geometry.tip : geometry.center
}

/** Leader leaves from the circle rim facing the label (same idea as the arrow base). */
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
  const { tip, left, right } = geometry
  if (style === 'chevron') {
    return `M ${left.x} ${left.y} L ${tip.x} ${tip.y} L ${right.x} ${right.y}`
  }
  return `M ${tip.x} ${tip.y} L ${left.x} ${left.y} L ${right.x} ${right.y} Z`
}

/**
 * Single path that includes the arrowhead and the leader curve, meant to be stroked.
 * Arrow: leader from base midline. Chevron: leader from tip.
 */
export function buildAnchorLeaderPath(
  style: AnchorStyleId,
  anchor: Point,
  endX: number,
  endY: number,
  radius: number,
): string {
  const geometry = buildAnchorArrowGeometry(anchor, endX, radius)
  const head = buildAnchorHeadPath(style, geometry)
  const leader = buildLeaderPath(leaderAttachPoint(style, geometry), endX, endY)
  return `${head} ${leader}`
}
