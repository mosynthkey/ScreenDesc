import type { Rect } from '../types/annotation'

export function findOpaquePixelBounds(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  minimumAlpha = 255,
): Rect | null {
  let left = width
  let top = height
  let right = -1
  let bottom = -1

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3]! < minimumAlpha) continue
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }

  if (right < left || bottom < top) return null
  return {
    x: left,
    y: top,
    width: right - left + 1,
    height: bottom - top + 1,
  }
}
