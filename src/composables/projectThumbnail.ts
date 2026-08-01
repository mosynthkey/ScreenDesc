import { exportScene } from '../utils/export'
import { ensureGoogleFontsLoaded } from '../utils/googleFonts'
import { resolveCalloutBorderWidth } from '../utils/commonSettings'
import type { StoreCore } from '../stores/annotationStore'

const THUMBNAIL_TARGET_WIDTH = 400

/** Renders a small annotated PNG of the currently open project, for gallery thumbnails. */
export async function renderThumbnailBlob(core: StoreCore): Promise<Blob | null> {
  const { state, imageElement } = core
  if (!imageElement.value) return null
  core.refreshDocumentAndLayouts()
  const documentWidth =
    state.document.marginLeft + state.document.imageWidth + state.document.marginRight
  if (documentWidth <= 0) return null

  await ensureGoogleFontsLoaded([state.defaultFontFamily], {
    italic: state.calloutFontItalic,
  })

  return exportScene({
    image: imageElement.value,
    sections: state.sections,
    annotations: state.annotations,
    calloutLayouts: state.calloutLayouts,
    document: state.document,
    options: {
      format: 'png',
      includeSectionGuides: false,
      scale: THUMBNAIL_TARGET_WIDTH / documentWidth,
      filename: 'thumbnail',
    },
    lineStyle: state.lineStyle,
    lineWidth: state.lineWidth,
    lineDashLength: state.lineDashLength,
    lineDashGap: state.lineDashGap,
    lineColor: state.lineColor,
    dotColor: state.lineColor,
    dotRadius: state.dotRadius,
    anchorStyle: state.anchorStyle,
    lineHaloWidth: state.lineHaloWidth,
    lineHaloColor: state.lineHaloColor,
    highlightMargin: state.highlightMargin,
    highlightFillEnabled: state.highlightFillEnabled,
    highlightFillOpacity: state.highlightFillOpacity,
    highlightCornerRadius: state.highlightCornerRadius,
    calloutFontSize: state.calloutFontSize,
    calloutFontWeight: state.calloutFontWeight,
    calloutFontItalic: state.calloutFontItalic,
    calloutTextColor: state.calloutTextColor,
    calloutBorderWidth: resolveCalloutBorderWidth(state.calloutBorderEnabled, state.lineWidth),
    calloutFillEnabled: state.calloutFillEnabled,
    calloutFillColor: state.calloutFillColor,
    calloutFillOpacity: state.calloutFillOpacity,
    calloutCornerRadius: state.calloutCornerRadius,
    pageBackgroundColor: state.pageBackgroundColor,
    fontFamily: state.defaultFontFamily,
  })
}
