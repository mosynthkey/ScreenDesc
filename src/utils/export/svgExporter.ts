import type { Exporter, ExportScene } from './types'
import { buildSceneSvg } from './buildSceneSvg'
import { htmlImageToPngDataUrl } from './imageDataUrl'
import { prepareExportFontCss } from './prepareFontCss'

export const svgExporter: Exporter = {
  format: 'svg',
  async export(scene: ExportScene): Promise<Blob> {
    const fontCss = await prepareExportFontCss(scene.fontFamily)
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
    return new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  },
}
