let sharedContext: CanvasRenderingContext2D | null = null

function getContext(): CanvasRenderingContext2D | null {
  if (sharedContext) return sharedContext
  const canvas = document.createElement('canvas')
  sharedContext = canvas.getContext('2d')
  return sharedContext
}

/** 実際のフォントでの描画幅を測る(全角/半角混在テキストにも対応) */
export function measureTextWidth(text: string, fontPx: number, fontFamily: string): number {
  const ctx = getContext()
  if (!ctx) return text.length * fontPx * 0.9
  ctx.font = `700 ${fontPx}px ${fontFamily}`
  return ctx.measureText(text).width
}

/**
 * maxWidth に収まるように貪欲法で行分割する。
 * スペース区切りの単語がmaxWidthに収まらない場合は文字単位でも分割する(CJKの連続文字向け)。
 */
export function wrapText(
  text: string,
  fontPx: number,
  fontFamily: string,
  maxWidth: number,
): string[] {
  const words = text.split(/(\s+)/).filter((word) => word.length > 0)
  const lines: string[] = []
  let current = ''

  const pushCurrent = () => {
    if (current.length > 0) lines.push(current)
    current = ''
  }

  for (const word of words) {
    const candidate = current + word
    if (measureTextWidth(candidate, fontPx, fontFamily) <= maxWidth) {
      current = candidate
      continue
    }

    // 単語自体が1行に収まらない(CJKの連続文字など): 文字単位で詰める
    if (measureTextWidth(word, fontPx, fontFamily) > maxWidth) {
      pushCurrent()
      let chunk = ''
      for (const char of word) {
        const nextChunk = chunk + char
        if (measureTextWidth(nextChunk, fontPx, fontFamily) > maxWidth && chunk.length > 0) {
          lines.push(chunk)
          chunk = char
        } else {
          chunk = nextChunk
        }
      }
      current = chunk
      continue
    }

    pushCurrent()
    current = word
  }
  pushCurrent()

  return lines.length > 0 ? lines : ['']
}
