import { t } from '../i18n'

const PAD_COLOR = '#ffffff'

export type FitImageMode = 'exact' | 'crop' | 'pad'

export interface FitImageResult {
  blob: Blob
  mode: FitImageMode
  sourceWidth: number
  sourceHeight: number
}

function sourceSize(image: HTMLImageElement | ImageBitmap): {
  width: number
  height: number
} {
  if (image instanceof HTMLImageElement) {
    return { width: image.naturalWidth, height: image.naturalHeight }
  }
  return { width: image.width, height: image.height }
}

/**
 * Fit a source image into an exact target size.
 * - Same size: copy pixels as-is
 * - Larger (or equal) in both axes: scale with cover and center-crop
 * - Otherwise: scale with contain and center-pad
 */
export async function fitImageToExactSize(
  source: HTMLImageElement | ImageBitmap,
  targetWidth: number,
  targetHeight: number,
): Promise<FitImageResult> {
  const width = Math.max(1, Math.round(targetWidth))
  const height = Math.max(1, Math.round(targetHeight))
  const { width: sourceWidth, height: sourceHeight } = sourceSize(source)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error(t('error.imageFitFailed'))
  }

  let mode: FitImageMode = 'exact'

  if (sourceWidth === width && sourceHeight === height) {
    context.drawImage(source, 0, 0)
  } else if (sourceWidth >= width && sourceHeight >= height) {
    mode = 'crop'
    const scale = Math.max(width / sourceWidth, height / sourceHeight)
    const drawWidth = sourceWidth * scale
    const drawHeight = sourceHeight * scale
    const offsetX = (width - drawWidth) / 2
    const offsetY = (height - drawHeight) / 2
    context.drawImage(source, offsetX, offsetY, drawWidth, drawHeight)
  } else {
    mode = 'pad'
    context.fillStyle = PAD_COLOR
    context.fillRect(0, 0, width, height)
    const scale = Math.min(width / sourceWidth, height / sourceHeight)
    const drawWidth = sourceWidth * scale
    const drawHeight = sourceHeight * scale
    const offsetX = (width - drawWidth) / 2
    const offsetY = (height - drawHeight) / 2
    context.drawImage(source, offsetX, offsetY, drawWidth, drawHeight)
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  )
  if (!blob) {
    throw new Error(t('error.imageFitFailed'))
  }

  return { blob, mode, sourceWidth, sourceHeight }
}

export function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(t('error.imageReadFailed')))
    }
    image.src = url
  })
}
