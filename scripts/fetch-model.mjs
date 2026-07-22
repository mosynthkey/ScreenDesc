#!/usr/bin/env node
/**
 * Ensures public/models/screenparser.onnx is present.
 *
 * Prefer an existing local file. Otherwise download via MODEL_DOWNLOAD_URL
 * or `gh release download` (tag MODEL_RELEASE_TAG, default model).
 */
import { spawnSync } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { access, mkdir, rename, unlink } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(rootDir, 'public', 'models')
const outPath = path.join(outDir, 'screenparser.onnx')
const releaseTag = process.env.MODEL_RELEASE_TAG || 'model'
const assetName = process.env.MODEL_ASSET_NAME || 'screenparser.onnx'
const defaultDownloadUrl =
  'https://github.com/mosynthkey/ScreenDesc/releases/download/model/screenparser.onnx'
const downloadUrl =
  process.env.MODEL_DOWNLOAD_URL?.trim() ||
  (process.env.CI || process.env.GITHUB_ACTIONS ? defaultDownloadUrl : '')
const force = process.env.MODEL_FORCE === '1'

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

function hasGh() {
  return spawnSync('gh', ['--version'], { stdio: 'ignore' }).status === 0
}

function downloadWithGh() {
  const result = spawnSync(
    'gh',
    [
      'release',
      'download',
      releaseTag,
      '--pattern',
      assetName,
      '--dir',
      outDir,
      '--clobber',
    ],
    { stdio: 'inherit', cwd: rootDir, env: process.env },
  )
  if (result.status !== 0) {
    throw new Error(
      `gh release download failed for tag "${releaseTag}" asset "${assetName}"`,
    )
  }
}

function printSetupHelp() {
  console.error(`[fetch-model] missing ${path.relative(rootDir, outPath)}`)
  console.error('')
  console.error('Options:')
  console.error('  • Local file: put screenparser.onnx in public/models/')
  console.error('  • From Release (gh):')
  console.error(`      MODEL_RELEASE_TAG=${releaseTag} npm run fetch-model`)
  console.error('  • Direct URL:')
  console.error('      MODEL_DOWNLOAD_URL=https://…/screenparser.onnx npm run fetch-model')
  console.error('  • Publish a Release once (from a machine that has the ONNX):')
  console.error('      ./scripts/publish-model-release.sh')
}

async function main() {
  await mkdir(outDir, { recursive: true })

  if (!force && (await fileExists(outPath))) {
    console.log(`[fetch-model] using existing ${path.relative(rootDir, outPath)}`)
    return
  }

  if (force && (await fileExists(outPath))) {
    await unlink(outPath)
  }

  if (downloadUrl) {
    console.log('[fetch-model] downloading from MODEL_DOWNLOAD_URL…')
    await downloadFromUrl(downloadUrl, outPath)
  } else if (hasGh()) {
    console.log(
      `[fetch-model] downloading ${assetName} from release ${releaseTag} via gh…`,
    )
    downloadWithGh()
  } else {
    printSetupHelp()
    process.exit(1)
  }

  if (!(await fileExists(outPath))) {
    throw new Error(`Expected model at ${outPath} after download`)
  }
  console.log(`[fetch-model] ready: ${path.relative(rootDir, outPath)}`)
}

main().catch((error) => {
  console.error(`[fetch-model] ${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
