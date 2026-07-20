let sharedContext: CanvasRenderingContext2D | null = null

function getContext(): CanvasRenderingContext2D | null {
  if (sharedContext) return sharedContext
  const canvas = document.createElement('canvas')
  sharedContext = canvas.getContext('2d')
  return sharedContext
}

export function measureTextWidth(text: string, fontPx: number, fontFamily: string): number {
  const ctx = getContext()
  if (!ctx) return text.length * fontPx * 0.9
  ctx.font = `700 ${fontPx}px ${fontFamily}`
  return ctx.measureText(text).width
}

/** Greedy wrap; falls back to character splits for long CJK runs. */
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
