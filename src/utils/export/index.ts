import type { ExportFormat, ExportOptions } from '../../types/annotation'
import { isDesktopApp } from '../../runtime'
import { saveExportedFile } from '../projectStorageDesktop'
import type { ExportScene, Exporter } from './types'
import { pngExporter } from './pngExporter'
import { svgExporter } from './svgExporter'

const exporters: Record<ExportFormat, Exporter> = {
  png: pngExporter,
  svg: svgExporter,
}

export async function exportScene(
  scene: Omit<ExportScene, 'options'> & { options: ExportOptions },
): Promise<Blob> {
  const exporter = exporters[scene.options.format]
  return exporter.export(scene)
}

function downloadBlobInBrowser(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * The desktop webview has no delegate to complete a browser-style
 * `<a download>` navigation, so on desktop this prompts a native save dialog
 * (via `saveExportedFile`) and writes the file to the chosen path instead.
 * A canceled dialog is a silent no-op, not an error.
 */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  if (isDesktopApp) {
    await saveExportedFile(blob, filename)
    return
  }
  downloadBlobInBrowser(blob, filename)
}

export type { ExportScene, Exporter }
