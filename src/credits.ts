export interface LibraryCredit {
  name: string
  license: string
  url: string
}

/** Runtime dependencies shown in About → Libraries & licenses. */
export const RUNTIME_LIBRARIES: LibraryCredit[] = [
  {
    name: 'Vue',
    license: 'MIT',
    url: 'https://github.com/vuejs/core',
  },
  {
    name: 'ONNX Runtime Web',
    license: 'MIT',
    url: 'https://github.com/microsoft/onnxruntime',
  },
  {
    name: 'tesseract-wasm',
    license: 'BSD-2-Clause',
    url: 'https://github.com/robertknight/tesseract-wasm',
  },
]
