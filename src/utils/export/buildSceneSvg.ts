import type {
  Annotation,
  AnchorStyleId,
  CalloutLayoutItem,
  DocumentLayout,
  LineStyleId,
  Section,
} from '../../types/annotation'
import {
  buildAnchorArrowGeometry,
  buildAnchorHeadPath,
  dotLeaderAttachPoint,
  isArrowAnchorStyle,
  leaderAttachPoint,
  leaderLeaveUnit,
} from '../anchorStyle'
import { fontFamilyCss } from '../googleFonts'
import { getLineStyleSpec } from '../lineStyle'
import {
  buildLeaderPath,
  calloutLabelLineBaselineY,
  calloutLabelTextX,
  leaderAttachOnLabel,
} from '../calloutLayout'
import { resolveCalloutFill, resolveHighlightFill } from '../commonSettings'
import { measureTextBaselineFromCenter } from '../textMeasure'

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
  lineDashLength: number,
  lineDashGap: number,
  lineColor: string,
  dotColor: string,
  dotRadius: number,
  anchorStyle: AnchorStyleId,
  lineHaloWidth: number,
  lineHaloColor: string,
  calloutFontSize: number,
  calloutFontWeight: number,
  calloutFontItalic: boolean,
  calloutTextColor: string,
  calloutBorderWidth: number,
  calloutFillEnabled: boolean,
  calloutFillColor: string,
  calloutFillOpacity: number,
  calloutCornerRadius: number,
  fontFamily: string,
): string {
  const { labelPosition, labelWidth, labelHeight, lines, anchorPoint, targetCenter } = layout
  const leaderEnd = leaderAttachOnLabel(layout)
  const fontCss = fontFamilyCss(fontFamily)
  const textX = calloutLabelTextX(
    labelPosition.x,
    labelWidth,
    lines,
    calloutFontSize,
    fontCss,
    calloutFontWeight,
    calloutFontItalic,
  )
  // Native <text> only — foreignObject is stripped when SVG is rasterized via <img>/canvas.
  const tspans = lines
    .map((line, lineIndex) => {
      const baselineFromCenter = measureTextBaselineFromCenter(
        line,
        calloutFontSize,
        fontCss,
        calloutFontWeight,
        calloutFontItalic,
      )
      const y = calloutLabelLineBaselineY(
        labelPosition.y,
        labelHeight,
        lines.length,
        lineIndex,
        calloutFontSize,
        baselineFromCenter,
      )
      return `<tspan x="${textX}" y="${y}">${escapeXml(line)}</tspan>`
    })
    .join('')

  const spec = getLineStyleSpec(lineStyle, lineWidth, lineDashLength, lineDashGap)
  const isInvert = lineStyle === 'invert'
  const effectiveLineColor = isInvert ? '#ffffff' : lineColor
  const effectiveDotColor = isInvert ? '#ffffff' : dotColor
  const dasharrayAttr = spec.dasharray ? ` stroke-dasharray="${spec.dasharray}"` : ''
  const blendAttr = spec.blendMode ? ` style="mix-blend-mode:${spec.blendMode}"` : ''
  const strokeJoin = 'stroke-linecap="round" stroke-linejoin="round"'
  const fillPaint = resolveCalloutFill(calloutFillEnabled, calloutFillColor, calloutFillOpacity)
  const fillAttr =
    fillPaint.fill === 'none'
      ? 'fill="none"'
      : `fill="${fillPaint.fill}" fill-opacity="${fillPaint.fillOpacity}"`

  const leave = leaderLeaveUnit(anchorPoint, targetCenter)

  let body: string
  if (isArrowAnchorStyle(anchorStyle)) {
    // Head and leader must be separate: filling a combined path paints the open cubic.
    const geometry = buildAnchorArrowGeometry(anchorPoint, targetCenter, dotRadius)
    const head = buildAnchorHeadPath(anchorStyle, geometry)
    const leader = buildLeaderPath(
      leaderAttachPoint(anchorStyle, geometry),
      leaderEnd.x,
      leaderEnd.y,
      leave,
    )
    const fill = anchorStyle === 'arrow' ? effectiveDotColor : 'none'
    const haloWidth = spec.strokeWidth + lineHaloWidth
    const halo =
      lineHaloWidth > 0 && !isInvert
        ? `<path d="${leader}" fill="none" stroke="${lineHaloColor}" stroke-width="${haloWidth}" ${strokeJoin} />
      <path d="${head}" fill="none" stroke="${lineHaloColor}" stroke-width="${haloWidth}" ${strokeJoin} />`
        : ''
    body = `${halo}
      <path d="${head}" fill="${fill}" stroke="${effectiveLineColor}" stroke-width="${spec.strokeWidth}" ${strokeJoin} />
      <path d="${leader}" fill="none" stroke="${effectiveLineColor}" stroke-width="${spec.strokeWidth}"${dasharrayAttr} ${strokeJoin} />`
  } else if (anchorStyle === 'none') {
    const leaderStart = dotLeaderAttachPoint(anchorPoint)
    const pathD = buildLeaderPath(leaderStart, leaderEnd.x, leaderEnd.y, leave)
    const haloWidth = spec.strokeWidth + lineHaloWidth
    const haloLeader =
      lineHaloWidth > 0 && !isInvert
        ? `<path d="${pathD}" fill="none" stroke="${lineHaloColor}" stroke-width="${haloWidth}" ${strokeJoin} />`
        : ''
    body = `${haloLeader}
      <path d="${pathD}" fill="none" stroke="${effectiveLineColor}" stroke-width="${spec.strokeWidth}"${dasharrayAttr} ${strokeJoin} />`
  } else {
    const leaderStart = dotLeaderAttachPoint(anchorPoint)
    const pathD = buildLeaderPath(leaderStart, leaderEnd.x, leaderEnd.y, leave)
    const haloWidth = spec.strokeWidth + lineHaloWidth
    const haloLeader =
      lineHaloWidth > 0 && !isInvert
        ? `<path d="${pathD}" fill="none" stroke="${lineHaloColor}" stroke-width="${haloWidth}" ${strokeJoin} />`
        : ''
    const haloCircle =
      lineHaloWidth > 0 && !isInvert
        ? `<circle cx="${anchorPoint.x}" cy="${anchorPoint.y}" r="${dotRadius}" fill="none" stroke="${lineHaloColor}" stroke-width="${haloWidth}" />`
        : ''
    // Leader under the filled circle so the stroke appears to leave from the center.
    body = `${haloLeader}
      <path d="${pathD}" fill="none" stroke="${effectiveLineColor}" stroke-width="${spec.strokeWidth}"${dasharrayAttr} ${strokeJoin} />
      ${haloCircle}
      <circle cx="${anchorPoint.x}" cy="${anchorPoint.y}" r="${dotRadius}" fill="${effectiveDotColor}" stroke="${effectiveLineColor}" stroke-width="${spec.strokeWidth}" />`
  }

  return `
    <g data-callout="${annotation.id}">
      <g${blendAttr}>
        ${body}
      </g>
      <rect x="${labelPosition.x}" y="${labelPosition.y}" width="${labelWidth}" height="${labelHeight}" rx="${calloutCornerRadius}" ${fillAttr} stroke="${effectiveDotColor}" stroke-width="${calloutBorderWidth}" />
      <text font-family="${escapeXml(fontCss)}" font-size="${calloutFontSize}" font-weight="${calloutFontWeight}" font-style="${calloutFontItalic ? 'italic' : 'normal'}" fill="${calloutTextColor}">${tspans}</text>
    </g>
  `
}

function renderSectionOutline(
  section: Section,
  document: DocumentLayout,
  lineStyle: LineStyleId,
  lineWidth: number,
  lineDashLength: number,
  lineDashGap: number,
  lineColor: string,
  lineHaloWidth: number,
  lineHaloColor: string,
  highlightMargin: number,
  highlightFillEnabled: boolean,
  highlightFillOpacity: number,
  highlightCornerRadius: number,
): string {
  const spec = getLineStyleSpec(lineStyle, lineWidth, lineDashLength, lineDashGap)
  const isInvert = lineStyle === 'invert'
  const effectiveLineColor = isInvert ? '#ffffff' : lineColor
  const dasharrayAttr = spec.dasharray ? ` stroke-dasharray="${spec.dasharray}"` : ''
  const blendAttr = spec.blendMode ? ` style="mix-blend-mode:${spec.blendMode}"` : ''
  const fillPaint = resolveHighlightFill(highlightFillEnabled, effectiveLineColor, highlightFillOpacity)
  const fillAttr =
    fillPaint.fill === 'none'
      ? 'fill="none"'
      : `fill="${fillPaint.fill}" fill-opacity="${fillPaint.fillOpacity}"`
  const x = document.marginLeft + section.rect.x - highlightMargin
  const y = document.marginTop + section.rect.y - highlightMargin
  const width = section.rect.width + highlightMargin * 2
  const height = section.rect.height + highlightMargin * 2
  const halo =
    section.outlineHaloEnabled && lineHaloWidth > 0 && !isInvert
      ? `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${highlightCornerRadius}" fill="none" stroke="${lineHaloColor}" stroke-width="${spec.strokeWidth + lineHaloWidth}" />`
      : ''
  return `${halo}<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${highlightCornerRadius}" ${fillAttr} stroke="${effectiveLineColor}" stroke-width="${spec.strokeWidth}"${dasharrayAttr}${blendAttr} />`
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
  lineDashLength: number
  lineDashGap: number
  lineColor: string
  dotColor: string
  dotRadius: number
  anchorStyle: AnchorStyleId
  lineHaloWidth: number
  lineHaloColor: string
  highlightMargin: number
  highlightFillEnabled: boolean
  highlightFillOpacity: number
  highlightCornerRadius: number
  calloutFontSize: number
  calloutFontWeight: number
  calloutFontItalic: boolean
  calloutTextColor: string
  calloutBorderWidth: number
  calloutFillEnabled: boolean
  calloutFillColor: string
  calloutFillOpacity: number
  calloutCornerRadius: number
  pageBackgroundColor: string
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
    lineDashLength,
    lineDashGap,
    lineColor,
    dotColor,
    dotRadius,
    anchorStyle,
    lineHaloWidth,
    lineHaloColor,
    highlightMargin,
    highlightFillEnabled,
    highlightFillOpacity,
    highlightCornerRadius,
    calloutFontSize,
    calloutFontWeight,
    calloutFontItalic,
    calloutTextColor,
    calloutBorderWidth,
    calloutFillEnabled,
    calloutFillColor,
    calloutFillOpacity,
    calloutCornerRadius,
    pageBackgroundColor,
    fontFamily,
    fontCss = '',
  } = params
  const width = document.marginLeft + document.imageWidth + document.marginRight
  const height = document.marginTop + document.imageHeight + document.marginBottom

  const sectionOutlines = sections
    .filter((section) => section.outlineEnabled === true)
    .map((section) =>
      renderSectionOutline(
        section,
        document,
        lineStyle,
        lineWidth,
        lineDashLength,
        lineDashGap,
        lineColor,
        lineHaloWidth,
        lineHaloColor,
        highlightMargin,
        highlightFillEnabled,
        highlightFillOpacity,
        highlightCornerRadius,
      ),
    )
    .join('')

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
        lineDashLength,
        lineDashGap,
        lineColor,
        dotColor,
        dotRadius,
        anchorStyle,
        lineHaloWidth,
        lineHaloColor,
        calloutFontSize,
        calloutFontWeight,
        calloutFontItalic,
        calloutTextColor,
        calloutBorderWidth,
        calloutFillEnabled,
        calloutFillColor,
        calloutFillOpacity,
        calloutCornerRadius,
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
  <rect width="100%" height="100%" fill="${escapeXml(pageBackgroundColor)}" />
  <image xlink:href="${escapeXml(imageHref)}" x="${document.marginLeft}" y="${document.marginTop}" width="${document.imageWidth}" height="${document.imageHeight}" preserveAspectRatio="none" />
  ${sectionOutlines}
  ${sectionGuides}
  ${callouts}
</svg>`
}
