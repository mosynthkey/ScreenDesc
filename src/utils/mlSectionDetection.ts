import type { Rect, Section, SectionKind } from '../types/annotation'
import type { Detection } from '../types/detection'
import type { useScreenParser } from '../composables/useScreenParser'
import { createId } from './id'
import { normalizeRect } from './geometry'

type ScreenParser = ReturnType<typeof useScreenParser>

/** ScreenParserの55クラスのうち、テキスト系として扱うクラス */
const TEXT_CLASSES = new Set(['Text', 'Heading', 'Code snippet', 'Tooltip', 'Notification'])

function classifyKind(className: string): SectionKind {
  return TEXT_CLASSES.has(className) ? 'text' : 'region'
}

function detectionToSection(detection: Detection, offsetX: number, offsetY: number): Section {
  return {
    id: createId('section'),
    rect: {
      x: detection.x + offsetX,
      y: detection.y + offsetY,
      width: detection.width,
      height: detection.height,
    },
    kind: classifyKind(detection.className),
    label: detection.className,
  }
}

/**
 * 画像(または画像内の矩形領域)をcanvasで切り出してImageBitmap化する。
 * region未指定時は画像全体。
 */
async function cropToBitmap(
  image: HTMLImageElement,
  region?: Rect,
): Promise<{ bitmap: ImageBitmap; offsetX: number; offsetY: number }> {
  if (!region) {
    const bitmap = await createImageBitmap(image)
    return { bitmap, offsetX: 0, offsetY: 0 }
  }

  const normalized = normalizeRect(region)
  const x = Math.max(0, Math.round(normalized.x))
  const y = Math.max(0, Math.round(normalized.y))
  const width = Math.max(1, Math.round(Math.min(normalized.width, image.naturalWidth - x)))
  const height = Math.max(1, Math.round(Math.min(normalized.height, image.naturalHeight - y)))

  const bitmap = await createImageBitmap(image, x, y, width, height)
  return { bitmap, offsetX: x, offsetY: y }
}

export interface DetectSectionsMLOptions {
  region?: Rect
  confThreshold?: number
  iouThreshold?: number
}

/**
 * ScreenParser(YOLO11, ブラウザ内ONNX推論)でUIセクションを検出する。
 * regionを指定すると、その矩形内だけを切り出して推論し、結果を元画像座標に戻す。
 */
export async function detectSectionsML(
  image: HTMLImageElement,
  screenParser: ScreenParser,
  options: DetectSectionsMLOptions = {},
): Promise<Section[]> {
  await screenParser.loadModel()

  const { bitmap, offsetX, offsetY } = await cropToBitmap(image, options.region)
  const detections = await screenParser.detect(bitmap, {
    confThreshold: options.confThreshold,
    iouThreshold: options.iouThreshold,
  })

  return detections.map((detection) => detectionToSection(detection, offsetX, offsetY))
}

/** ユーザーが手動で描いたセクション(ML検出を経由しない) */
export function createManualSection(rect: Rect): Section {
  return {
    id: createId('section'),
    rect: normalizeRect(rect),
    kind: 'region',
  }
}
