import type { Point, Rect } from '../types/annotation'

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function rectCenter(rect: Rect): Point {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  }
}

export function pointInRect(point: Point, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  )
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  )
}

export function unionRects(a: Rect, b: Rect): Rect {
  const left = Math.min(a.x, b.x)
  const top = Math.min(a.y, b.y)
  const right = Math.max(a.x + a.width, b.x + b.width)
  const bottom = Math.max(a.y + a.height, b.y + b.height)
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  }
}

export function expandRect(rect: Rect, padding: number): Rect {
  return {
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  }
}

export function clampRectToBounds(
  rect: Rect,
  boundsWidth: number,
  boundsHeight: number,
): Rect {
  const x = clamp(rect.x, 0, Math.max(0, boundsWidth - 1))
  const y = clamp(rect.y, 0, Math.max(0, boundsHeight - 1))
  const width = Math.min(rect.width, boundsWidth - x)
  const height = Math.min(rect.height, boundsHeight - y)
  return {
    x,
    y,
    width: Math.max(1, width),
    height: Math.max(1, height),
  }
}

export function rectArea(rect: Rect): number {
  return Math.max(0, rect.width) * Math.max(0, rect.height)
}

export function intersectionRect(a: Rect, b: Rect): Rect | null {
  const left = Math.max(a.x, b.x)
  const top = Math.max(a.y, b.y)
  const right = Math.min(a.x + a.width, b.x + b.width)
  const bottom = Math.min(a.y + a.height, b.y + b.height)
  if (right <= left || bottom <= top) return null
  return { x: left, y: top, width: right - left, height: bottom - top }
}

export function iou(a: Rect, b: Rect): number {
  const overlap = intersectionRect(a, b)
  if (!overlap) return 0
  const overlapArea = rectArea(overlap)
  const union = rectArea(a) + rectArea(b) - overlapArea
  return union <= 0 ? 0 : overlapArea / union
}

export function containmentRatio(inner: Rect, outer: Rect): number {
  const overlap = intersectionRect(inner, outer)
  if (!overlap) return 0
  const innerArea = rectArea(inner)
  return innerArea <= 0 ? 0 : rectArea(overlap) / innerArea
}

export function normalizeRect(rect: Rect): Rect {
  const x = rect.width < 0 ? rect.x + rect.width : rect.x
  const y = rect.height < 0 ? rect.y + rect.height : rect.y
  return {
    x,
    y,
    width: Math.abs(rect.width),
    height: Math.abs(rect.height),
  }
}

export function distance(a: Point, b: Point): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}
