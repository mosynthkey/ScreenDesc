import type { Detection } from '../types/detection'

export type WorkerRequest =
  | { type: 'LOAD_MODEL'; modelData: ArrayBuffer }
  | { type: 'DETECT'; requestId: number; bitmap: ImageBitmap; confThreshold: number; iouThreshold: number }

export interface ModelLoadedMessage {
  type: 'MODEL_LOADED'
  provider: 'webgpu' | 'wasm'
}

export interface ModelErrorMessage {
  type: 'MODEL_ERROR'
  message: string
}

export interface DetectResultMessage {
  type: 'DETECT_RESULT'
  requestId: number
  detections: Detection[]
  inferenceMs: number
}

export type WorkerResponse = ModelLoadedMessage | ModelErrorMessage | DetectResultMessage
