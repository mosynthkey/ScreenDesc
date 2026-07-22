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
      lineStyle: scene.lineStyle,
      lineWidth: scene.lineWidth,
      lineColor: scene.lineColor,
      dotColor: scene.dotColor,
      dotRadius: scene.dotRadius,
      lineHaloWidth: scene.lineHaloWidth,
      lineHaloColor: scene.lineHaloColor,
      calloutFontSize: scene.calloutFontSize,
      calloutBorderWidth: scene.calloutBorderWidth,
      fontFamily: scene.fontFamily,
      fontCss,
    })
    return new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  },
}
