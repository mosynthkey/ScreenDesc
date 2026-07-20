export interface Detection {
  classId: number
  className: string
  score: number
  // 元画像のピクセル座標系でのバウンディングボックス
  x: number
  y: number
  width: number
  height: number
}

export type ModelStatus = 'idle' | 'loading' | 'ready' | 'error'

export type ExecutionProviderName = 'webgpu' | 'wasm'
