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
