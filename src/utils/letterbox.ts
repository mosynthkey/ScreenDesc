export interface LetterboxResult {
  data: Float32Array
  scale: number
  padX: number
  padY: number
  targetSize: number
}

/**
 * 画像をアスペクト比を保ったまま targetSize x targetSize にリサイズし、
 * 余白を灰色(114,114,114)でパディングする（Ultralytics YOLOの前処理と同一仕様）。
 * 戻り値の data は NCHW / RGB / [0,1] 正規化済みの Float32Array。
 */
export function letterboxToTensor(image: ImageBitmap, targetSize: number): LetterboxResult {
  const srcWidth = image.width
  const srcHeight = image.height

  const scale = Math.min(targetSize / srcWidth, targetSize / srcHeight)
  const resizedWidth = Math.round(srcWidth * scale)
  const resizedHeight = Math.round(srcHeight * scale)
  const padX = Math.floor((targetSize - resizedWidth) / 2)
  const padY = Math.floor((targetSize - resizedHeight) / 2)

  // OffscreenCanvasはWindow/Worker双方で使えるため、推論をWeb Worker内で実行できる。
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

  // RGBA(HWC) -> RGB(CHW)、かつ 0-255 -> 0-1 正規化
  for (let i = 0; i < pixelCount; i++) {
    const srcOffset = i * 4
    chw[i] = rgba[srcOffset] / 255 // R channel
    chw[pixelCount + i] = rgba[srcOffset + 1] / 255 // G channel
    chw[pixelCount * 2 + i] = rgba[srcOffset + 2] / 255 // B channel
  }

  return { data: chw, scale, padX, padY, targetSize }
}
