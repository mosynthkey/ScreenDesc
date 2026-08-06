import { PaddleOCR } from '@paddleocr/paddleocr-js'
import type { Rect } from '../types/annotation'

export interface OcrLineHit {
  rect: Rect
  text: string
  confidence: number
}

export interface OcrRunResult {
  /** Text lines as detected by PaddleOCR (already grouped, no word clustering needed) */
  lines: OcrLineHit[]
  fullText: string
}

const baseUrl = import.meta.env.BASE_URL

type OcrClient = Awaited<ReturnType<typeof PaddleOCR.create>>

let clientPromise: Promise<OcrClient> | null = null

/** Torn down right after every recognize call, to keep this out of memory between analyses. */
async function disposeOcrClient(): Promise<void> {
  const promise = clientPromise
  clientPromise = null
  if (!promise) return
  try {
    const client = await promise
    await client.dispose()
  } catch {
    // Client never finished initializing — nothing to dispose.
  }
}

async function getOcrClient(): Promise<OcrClient> {
  if (!clientPromise) {
    console.log('[ocr] initializing PaddleOCR client…')
    clientPromise = PaddleOCR.create({
      // PP-OCRv6_small; Japanese UI screenshots (also covers Latin glyphs).
      lang: 'japan',
      worker: true,
      ortOptions: {
        backend: 'auto',
        wasmPaths: `${baseUrl}ort/`,
      },
      textDetectionModelName: 'PP-OCRv6_small_det',
      textDetectionModelAsset: {
        url: `${baseUrl}models/paddleocr/PP-OCRv6_small_det_onnx_infer.tar`,
      },
      textRecognitionModelName: 'PP-OCRv6_small_rec',
      textRecognitionModelAsset: {
        url: `${baseUrl}models/paddleocr/PP-OCRv6_small_rec_onnx_infer.tar`,
      },
    })
      .then((client) => {
        console.log('[ocr] client ready', client.getInitializationSummary?.())
        return client
      })
      .catch((error) => {
        clientPromise = null
        console.error('[ocr] failed to initialize PaddleOCR client', error)
        throw error
      })
  }
  return clientPromise
}

function polygonToRect(poly: [number, number][]): Rect {
  const xs = poly.map(([x]) => x)
  const ys = poly.map(([, y]) => y)
  const left = Math.min(...xs)
  const top = Math.min(...ys)
  const right = Math.max(...xs)
  const bottom = Math.max(...ys)
  return {
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  }
}

function isUsefulOcrText(text: string): boolean {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (trimmed.length < 1) return false
  if (!/[\p{L}\p{N}]/u.test(trimmed)) return false
  return true
}

async function recognizeTextFromImageData(imageData: ImageData): Promise<OcrRunResult> {
  const empty: OcrRunResult = { lines: [], fullText: '' }
  if (imageData.width < 8 || imageData.height < 8) return empty

  let result: Awaited<ReturnType<OcrClient['predict']>>[number] | undefined
  try {
    const client = await getOcrClient()
    console.log('[ocr] running predict()', { width: imageData.width, height: imageData.height })
    const started = performance.now()
    ;[result] = await client.predict(imageData)
    console.log('[ocr] predict() done', {
      ms: Math.round(performance.now() - started),
      itemCount: result?.items.length ?? 0,
      items: result?.items.map((item) => ({ text: item.text, score: item.score })),
      metrics: result?.metrics,
      runtime: result?.runtime,
    })
  } catch (error) {
    console.error('[ocr] predict() failed', error)
    return empty
  } finally {
    await disposeOcrClient()
  }
  if (!result) return empty

  const lines: OcrLineHit[] = []
  for (const item of result.items) {
    if (item.score < 0.35) continue
    if (!isUsefulOcrText(item.text)) continue
    lines.push({
      rect: polygonToRect(item.poly),
      text: item.text.replace(/\s+/g, ' ').trim(),
      confidence: item.score,
    })
  }
  console.log('[ocr] kept lines after filtering', lines)

  return {
    lines,
    fullText: lines.map((line) => line.text).join('\n'),
  }
}

function imageElementToImageData(image: HTMLImageElement): ImageData | null {
  const width = image.naturalWidth
  const height = image.naturalHeight
  if (width < 8 || height < 8) return null

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  context.imageSmoothingEnabled = false
  context.drawImage(image, 0, 0)
  return context.getImageData(0, 0, width, height)
}

export async function recognizeTextFromImage(
  image: HTMLImageElement,
): Promise<OcrRunResult> {
  const imageData = imageElementToImageData(image)
  if (!imageData) return { lines: [], fullText: '' }
  return recognizeTextFromImageData(imageData)
}
