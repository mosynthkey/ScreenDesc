import { ref } from 'vue'
import type { Detection, ModelStatus } from '../types/detection'
import type { WorkerRequest, WorkerResponse } from '../workers/messages'

const MODEL_URL = `${import.meta.env.BASE_URL}models/screenparser.onnx`

export interface DetectOptions {
  confThreshold?: number
  iouThreshold?: number
}

export function useScreenParser() {
  const status = ref<ModelStatus>('idle')
  const error = ref<string | null>(null)
  const executionProvider = ref<string | null>(null)
  const inferenceMs = ref<number | null>(null)

  let worker: Worker | null = null
  let nextRequestId = 0
  const pending = new Map<number, { resolve: (d: Detection[]) => void; reject: (e: unknown) => void }>()
  const modelWaiters: Array<{ resolve: () => void; reject: (e: unknown) => void }> = []
  let loadPromise: Promise<void> | null = null

  function ensureWorker(): Worker {
    if (worker) return worker
    // Web Worker上で推論を行うことで、モデルロードや推論中もUIスレッドをブロックしない。
    worker = new Worker(new URL('../workers/screenParser.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data
      if (msg.type === 'MODEL_LOADED') {
        executionProvider.value = msg.provider
        status.value = 'ready'
        for (const { resolve } of modelWaiters) resolve()
        modelWaiters.length = 0
      } else if (msg.type === 'MODEL_ERROR') {
        status.value = 'error'
        error.value = msg.message
        for (const { reject } of pending.values()) reject(new Error(msg.message))
        pending.clear()
        for (const { reject } of modelWaiters) reject(new Error(msg.message))
        modelWaiters.length = 0
        loadPromise = null
      } else if (msg.type === 'DETECT_RESULT') {
        inferenceMs.value = msg.inferenceMs
        const entry = pending.get(msg.requestId)
        if (entry) {
          entry.resolve(msg.detections)
          pending.delete(msg.requestId)
        }
      }
    })
    return worker
  }

  /** モデルロードを開始し、readyになるまで待てるPromiseを返す(既にready/loading中なら再利用) */
  function loadModel(): Promise<void> {
    if (status.value === 'ready') return Promise.resolve()
    if (loadPromise) return loadPromise

    status.value = 'loading'
    error.value = null
    loadPromise = new Promise<void>((resolve, reject) => {
      modelWaiters.push({ resolve, reject })
    })
    const req: WorkerRequest = { type: 'LOAD_MODEL', modelUrl: MODEL_URL }
    ensureWorker().postMessage(req)
    return loadPromise
  }

  function detect(bitmap: ImageBitmap, options: DetectOptions = {}): Promise<Detection[]> {
    if (status.value !== 'ready') {
      bitmap.close()
      return Promise.reject(new Error('モデルが読み込まれていません。先に loadModel() を呼んでください。'))
    }

    const requestId = nextRequestId++
    const req: WorkerRequest = {
      type: 'DETECT',
      requestId,
      bitmap,
      confThreshold: options.confThreshold ?? 0.1,
      iouThreshold: options.iouThreshold ?? 0.45,
    }

    return new Promise<Detection[]>((resolve, reject) => {
      pending.set(requestId, { resolve, reject })
      // ImageBitmapはtransferでworkerへ所有権ごと渡す(コピー不要で高速)
      ensureWorker().postMessage(req, [bitmap])
    })
  }

  function dispose() {
    worker?.terminate()
    worker = null
    status.value = 'idle'
    pending.clear()
    loadPromise = null
  }

  return {
    status,
    error,
    executionProvider,
    inferenceMs,
    loadModel,
    detect,
    dispose,
  }
}
