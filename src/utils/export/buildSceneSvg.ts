import type {
  Annotation,
  AnnotationMode,
  CalloutLayoutItem,
  DocumentLayout,
  LineStyleId,
  NumberStyleId,
  Section,
} from '../../types/annotation'
import { formatStepNumber } from '../circledNumbers'
import { getMarkerVisualStyle } from '../textVisibility'
import { MARKER_FONT_SIZE, MARKER_RADIUS } from '../markerSize'
import { fontFamilyCss } from '../googleFonts'
import { getLineStyleSpec } from '../lineStyle'
import { buildLeaderPath } from '../calloutLayout'

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function strokeAttrs(fill: string, stroke: string, strokeWidth: number): string {
  if (stroke === 'none' || strokeWidth <= 0) {
    return `fill="${fill}" stroke="none"`
  }
  return `fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" paint-order="stroke" stroke-linejoin="round"`
}

function renderInlineMarker(
  annotation: Annotation,
  document: DocumentLayout,
  fontFamily: string,
  numberStyle: NumberStyleId,
  labelColor: string,
): string {
  const visual = getMarkerVisualStyle(annotation.resolvedStyle, labelColor)
  const cx = document.marginLeft + annotation.markerPosition.x
  const cy = document.marginTop + annotation.markerPosition.y
  const label = formatStepNumber(annotation.order, numberStyle)
  const parts: string[] = []
  const radius = MARKER_RADIUS

  if (visual.shape === 'label') {
    parts.push(
      `<rect x="${cx - radius}" y="${cy - radius + 2}" width="${radius * 2}" height="${radius * 2 - 4}" rx="6" fill="${visual.background}" fill-opacity="${visual.backgroundOpacity}" />`,
    )
  } else if (visual.background) {
    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${visual.background}" fill-opacity="${visual.backgroundOpacity}" />`,
    )
  }

  if (visual.useInvert) {
    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="#000" fill-opacity="0.45" />`,
    )
  }

  if (label) {
    parts.push(
      `<text x="${cx}" y="${cy + 2}" text-anchor="middle" dominant-baseline="middle" font-family="${escapeXml(fontFamilyCss(fontFamily))}" font-size="${MARKER_FONT_SIZE}" font-weight="800" ${strokeAttrs(visual.fill, visual.stroke, visual.strokeWidth)}>${label}</text>`,
    )
  }

  return `<g data-annotation="${annotation.id}">${parts.join('')}</g>`
}

function renderCallout(
  annotation: Annotation,
  layout: CalloutLayoutItem,
  lineStyle: LineStyleId,
  lineWidth: number,
  lineColor: string,
  dotColor: string,
  dotRadius: number,
  lineHalo: boolean,
  calloutFontSize: number,
  calloutBorderWidth: number,
  fontFamily: string,
): string {
  const visual = getMarkerVisualStyle(
    annotation.resolvedStyle === 'local-invert'
      ? 'black-white-stroke'
      : annotation.resolvedStyle,
  )
  const { labelPosition, labelWidth, labelHeight, lines, anchorPoint, elbowPoint } = layout
  const textX = labelPosition.x + 12
  const endX =
    layout.side === 'left'
      ? labelPosition.x + labelWidth
      : labelPosition.x

  const lineHeight = Math.round(calloutFontSize * 1.375)
  const blockHeight = lines.length * lineHeight
  const blockTop = labelPosition.y + (labelHeight - blockHeight) / 2
  const tspans = lines
    .map((line, lineIndex) => {
      const y = blockTop + lineHeight * lineIndex + lineHeight / 2
      return `<tspan x="${textX}" y="${y}">${escapeXml(line)}</tspan>`
    })
    .join('')

  const spec = getLineStyleSpec(lineStyle, lineWidth)
  const isInvert = lineStyle === 'invert'
  const effectiveLineColor = isInvert ? '#ffffff' : lineColor
  const effectiveDotColor = isInvert ? '#ffffff' : dotColor
  const pathD = buildLeaderPath(anchorPoint, endX, elbowPoint.y)
  const haloPath =
    lineHalo && !isInvert
      ? `<path d="${pathD}" fill="none" stroke="#ffffff" stroke-width="${spec.strokeWidth + 3}" />`
      : ''
  const dasharrayAttr = spec.dasharray ? ` stroke-dasharray="${spec.dasharray}"` : ''
  // Blend on the group so overlapping line+dot invert the backdrop once.
  const blendAttr = spec.blendMode ? ` style="mix-blend-mode:${spec.blendMode}"` : ''

  return `
    <g data-callout="${annotation.id}">
      ${haloPath}
      <g${blendAttr}>
        <path d="${pathD}" fill="none" stroke="${effectiveLineColor}" stroke-width="${spec.strokeWidth}"${dasharrayAttr} />
        <circle cx="${anchorPoint.x}" cy="${anchorPoint.y}" r="${dotRadius}" fill="${effectiveDotColor}" />
      </g>
      <rect x="${labelPosition.x}" y="${labelPosition.y}" width="${labelWidth}" height="${labelHeight}" rx="8" fill="#ffffff" stroke="#1f2933" stroke-width="${calloutBorderWidth}" />
      <text dominant-baseline="middle" font-family="${escapeXml(fontFamilyCss(fontFamily))}" font-size="${calloutFontSize}" font-weight="700" ${strokeAttrs('#111111', visual.stroke === 'none' ? 'none' : '#ffffff', 0)}>${tspans}</text>
    </g>
  `
}

export function buildSceneSvg(params: {
  imageHref: string
  sections: Section[]
  annotations: Annotation[]
  calloutLayouts: CalloutLayoutItem[]
  document: DocumentLayout
  includeSectionGuides: boolean
  annotationMode: AnnotationMode
  lineStyle: LineStyleId
  lineWidth: number
  lineColor: string
  dotColor: string
  dotRadius: number
  lineHalo: boolean
  calloutFontSize: number
  calloutBorderWidth: number
  numberStyle: NumberStyleId
  labelColor: string
  fontFamily: string
  /** Optional embedded @font-face CSS (data URIs) for portable export */
  fontCss?: string
}): string {
  const {
    imageHref,
    sections,
    annotations,
    calloutLayouts,
    document,
    includeSectionGuides,
    annotationMode,
    lineStyle,
    lineWidth,
    lineColor,
    dotColor,
    dotRadius,
    lineHalo,
    calloutFontSize,
    calloutBorderWidth,
    numberStyle,
    labelColor,
    fontFamily,
    fontCss = '',
  } = params
  const width =
    document.marginLeft + document.imageWidth + document.marginRight
  const height =
    document.marginTop + document.imageHeight + document.marginBottom

  const sectionGuides = includeSectionGuides
    ? sections
        .map(
          (section) =>
            `<rect x="${document.marginLeft + section.rect.x}" y="${document.marginTop + section.rect.y}" width="${section.rect.width}" height="${section.rect.height}" fill="none" stroke="#2bb0a6" stroke-width="1" stroke-dasharray="4 3" opacity="0.7" />`,
        )
        .join('')
    : ''

  const inlineMarkers =
    annotationMode === 'inline'
      ? annotations
          .map((annotation) =>
            renderInlineMarker(annotation, document, fontFamily, numberStyle, labelColor),
          )
          .join('')
      : ''

  const callouts =
    annotationMode === 'callout'
      ? calloutLayouts
          .map((layout) => {
            const annotation = annotations.find((item) => item.id === layout.annotationId)
            if (!annotation) return ''
            return renderCallout(
              annotation,
              layout,
              lineStyle,
              lineWidth,
              lineColor,
              dotColor,
              dotRadius,
              lineHalo,
              calloutFontSize,
              calloutBorderWidth,
              fontFamily,
            )
          })
          .join('')
      : ''

  const styleBlock = fontCss
    ? `<defs><style type="text/css"><![CDATA[\n${fontCss}\n]]></style></defs>`
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${styleBlock}
  <rect width="100%" height="100%" fill="#f4f6f8" />
  <image xlink:href="${escapeXml(imageHref)}" x="${document.marginLeft}" y="${document.marginTop}" width="${document.imageWidth}" height="${document.imageHeight}" preserveAspectRatio="none" />
  ${sectionGuides}
  ${callouts}
  ${inlineMarkers}
</svg>`
}
