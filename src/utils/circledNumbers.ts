const CIRCLED_DIGITS = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'

export function toCircledNumber(order: number): string {
  if (order >= 1 && order <= 20) {
    return CIRCLED_DIGITS[order - 1]!
  }
  return String(order)
}

export function sortByOrder<T extends { order: number }>(items: T[]): T[] {
  return [...items].sort((left, right) => left.order - right.order)
}
