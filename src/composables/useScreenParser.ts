import { ref } from 'vue'
import type { Detection, ModelStatus } from '../types/detection'
import type { WorkerRequest, WorkerResponse } from '../workers/messages'

const MODEL_URL = `${import.meta.env.BASE_URL}models/screenparser.onnx`

export interface DetectOptions {
  confThreshold?: number
  iouThreshold?: number
}

async function fetchModelWithProgress(
  url: string,
  onProgress: (ratio: number) => void,
): Promise<ArrayBuffer> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Model download failed (${response.status})`)
  }

  const total = Number(response.headers.get('content-length')) || 0
  if (!response.body) {
    const buffer = await response.arrayBuffer()
    onProgress(1)
    return buffer
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    chunks.push(value)
    received += value.byteLength
    if (total > 0) onProgress(Math.min(1, received / total))
  }

  const merged = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  onProgress(1)
  return merged.buffer
}

export function useScreenParser() {
  const status = ref<ModelStatus>('idle')
  const error = ref<string | null>(null)
  const downloadProgress = ref(0)
  const executionProvider = ref<string | null>(null)
  const inferenceMs = ref<number | null>(null)

  let worker: Worker | null = null
  let nextRequestId = 0
  const pending = new Map<number, { resolve: (d: Detection[]) => void; reject: (e: unknown) => void }>()
  const modelWaiters: Array<{ resolve: () => void; reject: (e: unknown) => void }> = []
  let loadPromise: Promise<void> | null = null

  function ensureWorker(): Worker {
    if (worker) return worker
    worker = new Worker(new URL('../workers/screenParser.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data
      if (msg.type === 'MODEL_LOADED') {
        executionProvider.value = msg.provider
        status.value = 'ready'
        downloadProgress.value = 1
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

  function loadModel(): Promise<void> {
    if (status.value === 'ready') return Promise.resolve()
    if (loadPromise) return loadPromise

    status.value = 'downloading'
    error.value = null
    downloadProgress.value = 0

    loadPromise = (async () => {
      const waitForWorker = new Promise<void>((resolve, reject) => {
        modelWaiters.push({ resolve, reject })
      })

      try {
        const modelData = await fetchModelWithProgress(MODEL_URL, (ratio) => {
          downloadProgress.value = ratio
        })
        status.value = 'loading'
        const req: WorkerRequest = { type: 'LOAD_MODEL', modelData }
        ensureWorker().postMessage(req, [modelData])
        await waitForWorker
      } catch (err) {
        status.value = 'error'
        error.value = err instanceof Error ? err.message : String(err)
        loadPromise = null
        for (const { reject } of modelWaiters) reject(err)
        modelWaiters.length = 0
        throw err
      }
    })()

    return loadPromise
  }

  function detect(bitmap: ImageBitmap, options: DetectOptions = {}): Promise<Detection[]> {
    if (status.value !== 'ready') {
      bitmap.close()
      return Promise.reject(new Error('Model is not loaded. Call loadModel() first.'))
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
      ensureWorker().postMessage(req, [bitmap])
    })
  }

  function dispose() {
    worker?.terminate()
    worker = null
    status.value = 'idle'
    downloadProgress.value = 0
    pending.clear()
    loadPromise = null
  }

  return {
    status,
    error,
    downloadProgress,
    executionProvider,
    inferenceMs,
    loadModel,
    detect,
    dispose,
  }
}
