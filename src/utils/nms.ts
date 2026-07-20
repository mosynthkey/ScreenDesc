import type { Detection } from '../types/detection'

function iou(a: Detection, b: Detection): number {
  const ax2 = a.x + a.width
  const ay2 = a.y + a.height
  const bx2 = b.x + b.width
  const by2 = b.y + b.height

  const interX1 = Math.max(a.x, b.x)
  const interY1 = Math.max(a.y, b.y)
  const interX2 = Math.min(ax2, bx2)
  const interY2 = Math.min(ay2, by2)

  const interWidth = Math.max(0, interX2 - interX1)
  const interHeight = Math.max(0, interY2 - interY1)
  const interArea = interWidth * interHeight

  const areaA = a.width * a.height
  const areaB = b.width * b.height
  const unionArea = areaA + areaB - interArea

  return unionArea <= 0 ? 0 : interArea / unionArea
}

/** Per-class NMS (ONNX export uses `nms=False`). */
export function nonMaxSuppression(detections: Detection[], iouThreshold: number): Detection[] {
  const byClass = new Map<number, Detection[]>()
  for (const det of detections) {
    const list = byClass.get(det.classId) ?? []
    list.push(det)
    byClass.set(det.classId, list)
  }

  const kept: Detection[] = []
  for (const list of byClass.values()) {
    const sorted = [...list].sort((a, b) => b.score - a.score)
    const suppressed = new Array(sorted.length).fill(false)

    for (let i = 0; i < sorted.length; i++) {
      if (suppressed[i]) continue
      kept.push(sorted[i])
      for (let j = i + 1; j < sorted.length; j++) {
        if (suppressed[j]) continue
        if (iou(sorted[i], sorted[j]) > iouThreshold) {
          suppressed[j] = true
        }
      }
    }
  }

  return kept.sort((a, b) => b.score - a.score)
}
