#!/usr/bin/env node
/**
 * Copies the ONNX Runtime Web WASM binary into public/ort/ so PaddleOCR.js's
 * OCR worker can load it from same-origin instead of falling back to a CDN
 * (see src/utils/ocr.ts, ortOptions.wasmPaths). Runs on every `npm install`
 * since it just mirrors a file already present in node_modules.
 */
import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = path.join(rootDir, 'node_modules', 'onnxruntime-web', 'dist')
const outDir = path.join(rootDir, 'public', 'ort')

// Single-threaded-capable SIMD build; works with or without COOP/COEP
// (GitHub Pages doesn't send those headers, so threading stays off).
const files = ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs']

async function main() {
  await mkdir(outDir, { recursive: true })
  for (const file of files) {
    await copyFile(path.join(srcDir, file), path.join(outDir, file))
  }
  console.log(`[copy-ort-assets] ready: ${path.relative(rootDir, outDir)}`)
}

main().catch((error) => {
  console.error(`[copy-ort-assets] ${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
