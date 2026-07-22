import type { NumberStyleId } from '../types/annotation'

export type { NumberStyleId }

const CIRCLED_DIGITS = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'
const NUMBER_STYLE_IDS: NumberStyleId[] = [
  'circled',
  'paren',
  'dotted',
  'paren-suffix',
  'plain',
  'none',
]

export const DEFAULT_NUMBER_STYLE: NumberStyleId = 'circled'

export function isNumberStyleId(value: unknown): value is NumberStyleId {
  return typeof value === 'string' && (NUMBER_STYLE_IDS as string[]).includes(value)
}

export function formatStepNumber(
  order: number,
  style: NumberStyleId = DEFAULT_NUMBER_STYLE,
): string {
  if (style === 'none') return ''
  if (style === 'circled' && order >= 1 && order <= 20) {
    return CIRCLED_DIGITS[order - 1]!
  }
  if (style === 'paren') return `(${order})`
  if (style === 'dotted') return `${order}.`
  if (style === 'paren-suffix') return `${order})`
  return String(order)
}

export function sortByOrder<T extends { order: number }>(items: T[]): T[] {
  return [...items].sort((left, right) => left.order - right.order)
}

export function numberStyleIds(): NumberStyleId[] {
  return [...NUMBER_STYLE_IDS]
}
