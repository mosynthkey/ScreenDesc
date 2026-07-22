import type { Exporter, ExportScene } from './types'
import { buildSceneSvg } from './buildSceneSvg'
import { htmlImageToPngDataUrl } from './imageDataUrl'
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
    // Embed pixels so nested blob: URLs still render when the SVG is rasterized.
    const imageHref = await htmlImageToPngDataUrl(scene.image)
    const svg = buildSceneSvg({
      imageHref,
      sections: scene.sections,
      annotations: scene.annotations,
      calloutLayouts: scene.calloutLayouts,
      document: scene.document,
      includeSectionGuides: scene.options.includeSectionGuides,
      lineStyle: scene.lineStyle,
      lineWidth: scene.lineWidth,
      lineColor: scene.lineColor,
      dotColor: scene.dotColor,
      dotRadius: scene.dotRadius,
      anchorStyle: scene.anchorStyle,
      lineHaloWidth: scene.lineHaloWidth,
      lineHaloColor: scene.lineHaloColor,
      calloutFontSize: scene.calloutFontSize,
      calloutFontWeight: scene.calloutFontWeight,
      calloutFontItalic: scene.calloutFontItalic,
      calloutBorderWidth: scene.calloutBorderWidth,
      calloutFillEnabled: scene.calloutFillEnabled,
      calloutFillColor: scene.calloutFillColor,
      calloutFillOpacity: scene.calloutFillOpacity,
      pageBackgroundColor: scene.pageBackgroundColor,
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

      context.fillStyle = scene.pageBackgroundColor
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
