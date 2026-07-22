import type { Exporter, ExportScene } from './types'
import { buildSceneSvg } from './buildSceneSvg'
import { prepareExportFontCss } from './prepareFontCss'

export const svgExporter: Exporter = {
  format: 'svg',
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
      lineWidth: scene.lineWidth,
      lineColor: scene.lineColor,
      lineOpacity: scene.lineOpacity,
      dotColor: scene.dotColor,
      dotRadius: scene.dotRadius,
      lineHaloWidth: scene.lineHaloWidth,
      calloutFontSize: scene.calloutFontSize,
      calloutBorderWidth: scene.calloutBorderWidth,
      numberStyle: scene.numberStyle,
      labelColor: scene.labelColor,
      fontFamily: scene.fontFamily,
      fontCss,
    })
    return new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  },
}
