export interface Detection {
  classId: number
  className: string
  score: number
  /** Bounding box in source-image pixel coordinates. */
  x: number
  y: number
  width: number
  height: number
}

export type ModelStatus = 'idle' | 'loading' | 'ready' | 'error'
