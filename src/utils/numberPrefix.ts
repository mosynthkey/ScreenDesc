import type { Annotation, Section } from '../types/annotation'
import { referencePointForAnnotation } from './calloutLayout'

export type NumberPrefixStyle = 'circled' | 'paren' | 'dotted' | 'paren-suffix' | 'plain'
export type NumberPrefixDirection = 'list-order' | 'left-to-right' | 'top-to-bottom'

const CIRCLED_DIGITS = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'

export function formatNumberPrefix(order: number, style: NumberPrefixStyle): string {
  if (style === 'circled' && order >= 1 && order <= 20) {
    return CIRCLED_DIGITS[order - 1]!
  }
  if (style === 'paren') return `(${order})`
  if (style === 'dotted') return `${order}.`
  if (style === 'paren-suffix') return `${order})`
  return String(order)
}

export function orderAnnotationsForNumbering(
  annotations: Annotation[],
  sections: Section[],
  direction: NumberPrefixDirection,
): Annotation[] {
  if (direction === 'list-order') {
    return [...annotations].sort((left, right) => left.order - right.order)
  }
  const points = new Map(
    annotations.map((annotation) => [annotation.id, referencePointForAnnotation(annotation, sections)]),
  )
  return [...annotations].sort((left, right) => {
    const leftPoint = points.get(left.id)!
    const rightPoint = points.get(right.id)!
    if (direction === 'left-to-right') {
      return leftPoint.x - rightPoint.x || leftPoint.y - rightPoint.y
    }
    return leftPoint.y - rightPoint.y || leftPoint.x - rightPoint.x
  })
}
