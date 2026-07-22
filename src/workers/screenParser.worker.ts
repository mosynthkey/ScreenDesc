import * as ort from 'onnxruntime-web/all'
import { CLASS_NAMES } from '../constants/classes'
import { letterboxToTensor } from '../utils/letterbox'
import { nonMaxSuppression } from '../utils/nms'
import type { Detection } from '../types/detection'
import type {
  WorkerRequest,
  WorkerResponse,
  ModelLoadedMessage,
  ModelErrorMessage,
  DetectResultMessage,
} from './messages'

const INPUT_SIZE = 1280

// Leave wasmPaths unset so the onnxruntime-web bundle resolves wasm via import.meta.url.
ort.env.wasm.numThreads = self.crossOriginIsolated ? navigator.hardwareConcurrency || 4 : 1

let session: ort.InferenceSession | null = null

self.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data

  if (msg.type === 'LOAD_MODEL') {
    await handleLoadModel(msg.modelData)
    return
  }

  if (msg.type === 'DETECT') {
    await handleDetect(msg.requestId, msg.bitmap, msg.confThreshold, msg.iouThreshold)
  }
})

async function handleLoadModel(modelData: ArrayBuffer) {
  const providerAttempts: Array<'webgpu' | 'wasm'> = 'gpu' in self.navigator ? ['webgpu', 'wasm'] : ['wasm']

  let lastError: unknown = null
  for (const provider of providerAttempts) {
    try {
      const newSession = await ort.InferenceSession.create(modelData, {
        executionProviders: [provider],
        graphOptimizationLevel: 'all',
      })

      // Warmup absorbs first-run shader compile / JIT cost.
      const inputName = newSession.inputNames[0]
      const dummy = new ort.Tensor('float32', new Float32Array(3 * INPUT_SIZE * INPUT_SIZE), [
        1,
        3,
        INPUT_SIZE,
        INPUT_SIZE,
      ])
      const warmupResult = await newSession.run({ [inputName]: dummy })
      dummy.dispose()
      for (const tensor of Object.values(warmupResult)) tensor.dispose()

      session = newSession
      post<ModelLoadedMessage>({ type: 'MODEL_LOADED', provider })
      return
    } catch (err) {
      lastError = err
    }
  }

  post<ModelErrorMessage>({
    type: 'MODEL_ERROR',
    message: lastError instanceof Error ? lastError.message : String(lastError),
  })
}

async function handleDetect(
  requestId: number,
  bitmap: ImageBitmap,
  confThreshold: number,
  iouThreshold: number,
) {
  if (!session) {
    post<ModelErrorMessage>({ type: 'MODEL_ERROR', message: 'Model is not loaded' })
    bitmap.close()
    return
  }

  const { data, scale, padX, padY } = letterboxToTensor(bitmap, INPUT_SIZE)
  bitmap.close()

  const inputTensor = new ort.Tensor('float32', data, [1, 3, INPUT_SIZE, INPUT_SIZE])
  const inputName = session.inputNames[0]
  const outputName = session.outputNames[0]

  const start = performance.now()
  const results = await session.run({ [inputName]: inputTensor })
  const inferenceMs = performance.now() - start
  inputTensor.dispose()

  const output = results[outputName]
  const detections = decodeOutput(output, { scale, padX, padY, confThreshold, iouThreshold })
  for (const tensor of Object.values(results)) tensor.dispose()

  post<DetectResultMessage>({ type: 'DETECT_RESULT', requestId, detections, inferenceMs })
}

interface DecodeContext {
  scale: number
  padX: number
  padY: number
  confThreshold: number
  iouThreshold: number
}

/** Decode Ultralytics YOLO detect output `[1, 4 + numClasses, numBoxes]` (NMS off at export). */
function decodeOutput(output: ort.Tensor, ctx: DecodeContext): Detection[] {
  const dims = output.dims
  if (dims.length !== 3) {
    throw new Error(`Unexpected output shape: [${dims.join(', ')}]`)
  }

  const [, numChannels, numBoxes] = dims
  const numClasses = numChannels - 4
  if (numClasses !== CLASS_NAMES.length) {
    console.warn(
      `Model class count (${numClasses}) does not match CLASS_NAMES (${CLASS_NAMES.length}).`,
    )
  }

  const buffer = output.data as Float32Array
  const detections: Detection[] = []

  for (let box = 0; box < numBoxes; box++) {
    let bestScore = -Infinity
    let bestClass = -1
    for (let c = 0; c < numClasses; c++) {
      const score = buffer[(4 + c) * numBoxes + box]
      if (score > bestScore) {
        bestScore = score
        bestClass = c
      }
    }

    if (bestScore < ctx.confThreshold) continue

    const cx = buffer[0 * numBoxes + box]
    const cy = buffer[1 * numBoxes + box]
    const w = buffer[2 * numBoxes + box]
    const h = buffer[3 * numBoxes + box]

    const x = (cx - w / 2 - ctx.padX) / ctx.scale
    const y = (cy - h / 2 - ctx.padY) / ctx.scale
    const width = w / ctx.scale
    const height = h / ctx.scale

    detections.push({
      classId: bestClass,
      className: CLASS_NAMES[bestClass] ?? `class_${bestClass}`,
      score: bestScore,
      x,
      y,
      width,
      height,
    })
  }

  return nonMaxSuppression(detections, ctx.iouThreshold)
}

function post<T extends WorkerResponse>(message: T, transfer: Transferable[] = []) {
  ;(self as unknown as Worker).postMessage(message, transfer)
}
