declare module 'tesseract-wasm' {
  export type IntRect = {
    left: number
    top: number
    right: number
    bottom: number
  }

  export type TextItem = {
    rect: IntRect
    flags: number
    confidence: number
    text: string
  }

  export type TextUnit = 'line' | 'word'

  export class OCRClient {
    constructor(options?: {
      workerURL?: string
      wasmBinary?: ArrayBuffer | Uint8Array
      createWorker?: (url: string) => Worker
    })
    destroy(): Promise<void>
    loadModel(model: string | ArrayBuffer): Promise<void>
    loadImage(image: ImageBitmap | ImageData): Promise<void>
    clearImage(): Promise<void>
    getTextBoxes(unit: TextUnit): Promise<TextItem[]>
    getText(): Promise<string>
  }
}
