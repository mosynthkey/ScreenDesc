import type { ExportFormat, ExportOptions } from '../../types/annotation'
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

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export type { ExportScene, Exporter }
