import type { Exporter, ExportScene } from './types'
import { buildSceneSvg } from './buildSceneSvg'
import { prepareExportFontCss } from './prepareFontCss'

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Failed to rasterize export image'))
    image.src = url
  })
}

export const pngExporter: Exporter = {
  format: 'png',
  async export(scene: ExportScene): Promise<Blob> {
    const fontCss = await prepareExportFontCss(scene.fontFamily)
    const svg = buildSceneSvg({
      imageHref: scene.image.src,
      sections: scene.sections,
      annotations: scene.annotations,
      calloutLayouts: scene.calloutLayouts,
      document: scene.document,
      includeSectionGuides: scene.options.includeSectionGuides,
      annotationMode: scene.annotationMode,
      lineStyle: scene.lineStyle,
      lineColor: scene.lineColor,
      dotColor: scene.dotColor,
      dotRadius: scene.dotRadius,
      lineHalo: scene.lineHalo,
      calloutFontSize: scene.calloutFontSize,
      calloutBorderWidth: scene.calloutBorderWidth,
      fontFamily: scene.fontFamily,
      fontCss,
    })

    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const svgUrl = URL.createObjectURL(svgBlob)

    try {
      const rendered = await loadImage(svgUrl)
      const scale = scene.options.scale
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(rendered.naturalWidth * scale)
      canvas.height = Math.round(rendered.naturalHeight * scale)
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Canvas unavailable')

      context.fillStyle = '#f4f6f8'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(rendered, 0, 0, canvas.width, canvas.height)

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (result) resolve(result)
            else reject(new Error('PNG encoding failed'))
          },
          'image/png',
        )
      })
      return blob
    } finally {
      URL.revokeObjectURL(svgUrl)
    }
  },
}
