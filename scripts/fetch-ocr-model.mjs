#!/usr/bin/env node
/**
 * Ensures public/models/paddleocr/{det,rec}.tar are present.
 *
 * These are the official PP-OCRv6_small text detection / recognition
 * models (Apache-2.0), self-hosted so the app works fully offline.
 * See README.md "Model licenses" for provenance.
 */
import { createWriteStream } from 'node:fs'
import { access, mkdir, rename } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(rootDir, 'public', 'models', 'paddleocr')

const MODEL_BASE_URL =
  'https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0'

const assets = [
  { file: 'PP-OCRv6_small_det_onnx_infer.tar', role: 'text detection' },
  { file: 'PP-OCRv6_small_rec_onnx_infer.tar', role: 'text recognition' },
]

async function fileExists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function downloadFromUrl(url, destination) {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok || !response.body) {
    throw new Error(`Download failed (${response.status}): ${url}`)
  }
  const tempPath = `${destination}.partial`
  await pipeline(Readable.fromWeb(response.body), createWriteStream(tempPath))
  await rename(tempPath, destination)
}

async function main() {
  await mkdir(outDir, { recursive: true })

  for (const asset of assets) {
    const outPath = path.join(outDir, asset.file)
    if (await fileExists(outPath)) {
      console.log(`[fetch-ocr-model] using existing ${path.relative(rootDir, outPath)}`)
      continue
    }
    const url = `${MODEL_BASE_URL}/${asset.file}`
    console.log(`[fetch-ocr-model] downloading ${asset.role} model…`)
    await downloadFromUrl(url, outPath)
    console.log(`[fetch-ocr-model] ready: ${path.relative(rootDir, outPath)}`)
  }
}

main().catch((error) => {
  console.error(`[fetch-ocr-model] ${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
