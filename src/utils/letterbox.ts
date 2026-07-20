export interface LetterboxResult {
  data: Float32Array
  scale: number
  padX: number
  padY: number
  targetSize: number
}

/**
 * Ultralytics-compatible letterbox: pad with rgb(114,114,114).
 * Returns NCHW RGB float32 in [0, 1].
 */
export function letterboxToTensor(image: ImageBitmap, targetSize: number): LetterboxResult {
  const srcWidth = image.width
  const srcHeight = image.height

  const scale = Math.min(targetSize / srcWidth, targetSize / srcHeight)
  const resizedWidth = Math.round(srcWidth * scale)
  const resizedHeight = Math.round(srcHeight * scale)
  const padX = Math.floor((targetSize - resizedWidth) / 2)
  const padY = Math.floor((targetSize - resizedHeight) / 2)

  const canvas = new OffscreenCanvas(targetSize, targetSize)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    throw new Error('Canvas 2D context を取得できませんでした')
  }

  ctx.fillStyle = 'rgb(114, 114, 114)'
  ctx.fillRect(0, 0, targetSize, targetSize)
  ctx.drawImage(image, 0, 0, srcWidth, srcHeight, padX, padY, resizedWidth, resizedHeight)

  const { data: rgba } = ctx.getImageData(0, 0, targetSize, targetSize)
  const pixelCount = targetSize * targetSize
  const chw = new Float32Array(pixelCount * 3)

  for (let i = 0; i < pixelCount; i++) {
    const srcOffset = i * 4
    chw[i] = rgba[srcOffset] / 255 // R channel
    chw[pixelCount + i] = rgba[srcOffset + 1] / 255 // G channel
    chw[pixelCount * 2 + i] = rgba[srcOffset + 2] / 255 // B channel
  }

  return { data: chw, scale, padX, padY, targetSize }
}
