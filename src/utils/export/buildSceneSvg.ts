import type {
  Annotation,
  CalloutLayoutItem,
  DocumentLayout,
  LineStyleId,
  Section,
} from '../../types/annotation'
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

function renderCallout(
  annotation: Annotation,
  layout: CalloutLayoutItem,
  lineStyle: LineStyleId,
  lineWidth: number,
  lineColor: string,
  lineOpacity: number,
  dotColor: string,
  dotRadius: number,
  lineHaloWidth: number,
  lineHaloColor: string,
  calloutFontSize: number,
  calloutBorderWidth: number,
  fontFamily: string,
): string {
  const { labelPosition, labelWidth, labelHeight, lines, anchorPoint, elbowPoint } = layout
  const textX = labelPosition.x + Math.max(10, calloutFontSize * 0.28)
  const endX =
    layout.side === 'left' ? labelPosition.x + labelWidth : labelPosition.x

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
  const opacityAttr = lineOpacity < 1 ? ` stroke-opacity="${lineOpacity}"` : ''
  const haloPath =
    lineHaloWidth > 0 && !isInvert
      ? `<path d="${pathD}" fill="none" stroke="${lineHaloColor}" stroke-width="${spec.strokeWidth + lineHaloWidth}"${opacityAttr} />`
      : ''
  const dasharrayAttr = spec.dasharray ? ` stroke-dasharray="${spec.dasharray}"` : ''
  const blendAttr = spec.blendMode ? ` style="mix-blend-mode:${spec.blendMode}"` : ''

  const fillOpacityAttr = lineOpacity < 1 ? ` fill-opacity="${lineOpacity}"` : ''
  const dotHalo =
    lineHaloWidth > 0 && !isInvert
      ? `<circle cx="${anchorPoint.x}" cy="${anchorPoint.y}" r="${dotRadius + lineHaloWidth / 2}" fill="${lineHaloColor}"${fillOpacityAttr} />`
      : ''

  return `
    <g data-callout="${annotation.id}">
      ${haloPath}
      <g${blendAttr}>
        <path d="${pathD}" fill="none" stroke="${effectiveLineColor}" stroke-width="${spec.strokeWidth}"${dasharrayAttr}${opacityAttr} />
        ${dotHalo}
        <circle cx="${anchorPoint.x}" cy="${anchorPoint.y}" r="${dotRadius}" fill="${effectiveDotColor}" />
      </g>
      <rect x="${labelPosition.x}" y="${labelPosition.y}" width="${labelWidth}" height="${labelHeight}" rx="8" fill="#ffffff" stroke="${effectiveDotColor}" stroke-width="${calloutBorderWidth}" />
      <text dominant-baseline="middle" font-family="${escapeXml(fontFamilyCss(fontFamily))}" font-size="${calloutFontSize}" font-weight="700" fill="#111111">${tspans}</text>
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
  lineStyle: LineStyleId
  lineWidth: number
  lineColor: string
  lineOpacity: number
  dotColor: string
  dotRadius: number
  lineHaloWidth: number
  lineHaloColor: string
  calloutFontSize: number
  calloutBorderWidth: number
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
    lineStyle,
    lineWidth,
    lineColor,
    lineOpacity,
    dotColor,
    dotRadius,
    lineHaloWidth,
    lineHaloColor,
    calloutFontSize,
    calloutBorderWidth,
    fontFamily,
    fontCss = '',
  } = params
  const width = document.marginLeft + document.imageWidth + document.marginRight
  const height = document.marginTop + document.imageHeight + document.marginBottom

  const sectionGuides = includeSectionGuides
    ? sections
        .map(
          (section) =>
            `<rect x="${document.marginLeft + section.rect.x}" y="${document.marginTop + section.rect.y}" width="${section.rect.width}" height="${section.rect.height}" fill="none" stroke="#2bb0a6" stroke-width="1" stroke-dasharray="4 3" opacity="0.7" />`,
        )
        .join('')
    : ''

  const callouts = calloutLayouts
    .map((layout) => {
      const annotation = annotations.find((item) => item.id === layout.annotationId)
      if (!annotation) return ''
      return renderCallout(
        annotation,
        layout,
        lineStyle,
        lineWidth,
        lineColor,
        lineOpacity,
        dotColor,
        dotRadius,
        lineHaloWidth,
        lineHaloColor,
        calloutFontSize,
        calloutBorderWidth,
        fontFamily,
      )
    })
    .join('')

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
</svg>`
}
