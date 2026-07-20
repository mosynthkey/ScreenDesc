import { OCRClient } from 'tesseract-wasm'
import type { Rect } from '../types/annotation'

export interface OcrLineHit {
  rect: Rect
  text: string
  confidence: number
}

export interface OcrRunResult {
  /** Separated text groups (words clustered only when horizontally close) */
  lines: OcrLineHit[]
  fullText: string
}

const baseUrl = import.meta.env.BASE_URL

let clientPromise: Promise<OCRClient> | null = null
let wasmBinaryPromise: Promise<ArrayBuffer> | null = null

async function loadWasmBinary(): Promise<ArrayBuffer> {
  if (!wasmBinaryPromise) {
    wasmBinaryPromise = fetch(`${baseUrl}tesseract/tesseract-core.wasm`).then(async (response) => {
      if (!response.ok) throw new Error(`Failed to fetch tesseract wasm (${response.status})`)
      return response.arrayBuffer()
    })
  }
  return wasmBinaryPromise
}

async function getOcrClient(): Promise<OCRClient> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const wasmBinary = await loadWasmBinary()
      const client = new OCRClient({
        workerURL: `${baseUrl}tesseract/tesseract-worker.js`,
        wasmBinary,
      })
      // Japanese UI screenshots; jpn model also covers common Latin glyphs
      await client.loadModel(`${baseUrl}tessdata/jpn.traineddata`)
      return client
    })().catch((error) => {
      clientPromise = null
      throw error
    })
  }
  return clientPromise
}

function intRectToRect(rect: { left: number; top: number; right: number; bottom: number }): Rect {
  return {
    x: rect.left,
    y: rect.top,
    width: Math.max(1, rect.right - rect.left),
    height: Math.max(1, rect.bottom - rect.top),
  }
}

function isUsefulOcrText(text: string): boolean {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (trimmed.length < 1) return false
  if (!/[\p{L}\p{N}]/u.test(trimmed)) return false
  return true
}

function unionRects(left: Rect, right: Rect): Rect {
  const x = Math.min(left.x, right.x)
  const y = Math.min(left.y, right.y)
  const rightEdge = Math.max(left.x + left.width, right.x + right.width)
  const bottomEdge = Math.max(left.y + left.height, right.y + right.height)
  return {
    x,
    y,
    width: Math.max(1, rightEdge - x),
    height: Math.max(1, bottomEdge - y),
  }
}

function sameTextRow(left: Rect, right: Rect): boolean {
  const leftCenterY = left.y + left.height * 0.5
  const rightCenterY = right.y + right.height * 0.5
  const rowTolerance = Math.max(6, Math.min(left.height, right.height) * 0.7)
  return Math.abs(leftCenterY - rightCenterY) <= rowTolerance
}

/**
 * Merge neighboring words when the gap looks like spacing inside a phrase.
 * Wider gaps (toolbar buttons, table columns) stay separate.
 */
function clusterNearbyWords(words: OcrLineHit[]): OcrLineHit[] {
  if (words.length === 0) return []

  const ordered = [...words].sort(
    (left, right) => left.rect.y - right.rect.y || left.rect.x - right.rect.x,
  )
  const clusters: OcrLineHit[] = []
  let current = { ...ordered[0]!, rect: { ...ordered[0]!.rect } }

  for (let wordIndex = 1; wordIndex < ordered.length; wordIndex += 1) {
    const word = ordered[wordIndex]!
    const gapX = word.rect.x - (current.rect.x + current.rect.width)
    const fontSize = Math.min(current.rect.height, word.rect.height)
    // Prefer keeping phrases / labels on one row together; only split very wide gaps
    const maxGap = Math.max(48, fontSize * 5)
    const canMerge =
      sameTextRow(current.rect, word.rect) && gapX >= -4 && gapX <= maxGap

    if (canMerge) {
      current = {
        rect: unionRects(current.rect, word.rect),
        text: `${current.text} ${word.text}`.replace(/\s+/g, ' ').trim(),
        confidence: Math.min(current.confidence, word.confidence),
      }
      continue
    }

    clusters.push(current)
    current = { ...word, rect: { ...word.rect } }
  }
  clusters.push(current)
  return clusters
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

/** Build an 8-bit grayscale ImageData from a float luminance buffer. */
export function imageDataFromGray(
  gray: Float32Array,
  width: number,
  height: number,
): ImageData {
  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
    const value = Math.max(0, Math.min(255, Math.round(gray[pixelIndex] ?? 0)))
    const offset = pixelIndex * 4
    rgba[offset] = value
    rgba[offset + 1] = value
    rgba[offset + 2] = value
    rgba[offset + 3] = 255
  }
  return new ImageData(rgba, width, height)
}

async function recognizeTextFromImageData(imageData: ImageData): Promise<OcrRunResult> {
  const empty: OcrRunResult = { lines: [], fullText: '' }
  if (imageData.width < 8 || imageData.height < 8) return empty

  const client = await getOcrClient()
  await client.loadImage(imageData)

  const boxes = await client.getTextBoxes('word')
  const fullText = await client.getText()
  await client.clearImage()

  const words: OcrLineHit[] = []
  for (const item of boxes) {
    if (item.confidence < 0.35) continue
    if (!isUsefulOcrText(item.text)) continue
    words.push({
      rect: intRectToRect(item.rect),
      text: item.text.replace(/\s+/g, ' ').trim(),
      confidence: item.confidence,
    })
  }

  return {
    lines: clusterNearbyWords(words),
    fullText: fullText.trim(),
  }
}

/**
 * Run tesseract-wasm on the original image pixels (full frame).
 * Returns word clusters in absolute image coordinates.
 */
export async function recognizeTextFromImage(
  image: HTMLImageElement,
): Promise<OcrRunResult> {
  const imageData = imageElementToImageData(image)
  if (!imageData) return { lines: [], fullText: '' }
  return recognizeTextFromImageData(imageData)
}

/** OCR a contrast-enhanced (or other) grayscale buffer in local coordinates. */
export async function recognizeTextFromGray(
  gray: Float32Array,
  width: number,
  height: number,
): Promise<OcrRunResult> {
  return recognizeTextFromImageData(imageDataFromGray(gray, width, height))
}
