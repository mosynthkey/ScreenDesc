import type {
  Annotation,
  CalloutLayoutItem,
  DocumentLayout,
  NumberStyleId,
  Point,
  Section,
} from '../types/annotation'
import { clamp, rectCenter } from './geometry'
import { formatStepNumber } from './circledNumbers'
import { measureTextWidth } from './textMeasure'
import { fontFamilyCss } from './googleFonts'
import { t } from '../i18n'

/**
 * Cubic leader: short horizontal stubs at each end, then an S-curve.
 * Nearby control points keep parallel leaders from overlapping over a long run.
 */
export function buildLeaderPath(anchor: Point, endX: number, endY: number): string {
  const dx = endX - anchor.x
  const direction = dx === 0 ? 1 : Math.sign(dx)
  const bend = Math.min(60, Math.abs(dx) / 2)
  const ctrl1X = anchor.x + direction * bend
  const ctrl2X = endX - direction * bend
  return `M ${anchor.x} ${anchor.y} C ${ctrl1X} ${anchor.y}, ${ctrl2X} ${endY}, ${endX} ${endY}`
}

const LABEL_GAP_MIN = 12
const LINE_INSET = 8
const IMAGE_GUTTER = 14
const PAGE_PAD = 8
const MIN_LABEL_WIDTH = 120
const EMPTY_SIDE_MARGIN = 32
const ELBOW_INSET = 10
const MIN_VERTICAL_MARGIN = 24

function lineHeightFor(fontSize: number): number {
  return Math.round(fontSize * 1.375)
}

function labelHPadding(fontSize: number): number {
  return Math.max(20, Math.round(fontSize * 0.55))
}

function labelVPadding(fontSize: number): number {
  return Math.max(14, Math.round(fontSize * 0.35))
}

/** Keep gaps readable as font size grows so neighboring labels do not touch. */
function labelGapFor(fontSize: number): number {
  return Math.max(LABEL_GAP_MIN, Math.round(fontSize * 0.35))
}

function sideMarginFor(maxLabelWidth: number): number {
  return maxLabelWidth + IMAGE_GUTTER + PAGE_PAD
}

function stackHeight(heights: number[], gap: number): number {
  if (heights.length === 0) return 0
  const heightsSum = heights.reduce((sum, height) => sum + height, 0)
  return heightsSum + Math.max(0, heights.length - 1) * gap
}

function verticalMarginsFor(imageHeight: number, maxStackHeight: number): {
  marginTop: number
  marginBottom: number
} {
  const minContentHeight = maxStackHeight + 2 * PAGE_PAD
  const extra = Math.max(0, minContentHeight - imageHeight)
  return {
    marginTop: MIN_VERTICAL_MARGIN + Math.ceil(extra / 2),
    marginBottom: MIN_VERTICAL_MARGIN + Math.floor(extra / 2),
  }
}

/** Single-line label sized to measured text; canvas margins grow to fit. */
function estimateLabelSize(
  description: string,
  order: number,
  fontFamily: string,
  fontSize: number,
  numberStyle: NumberStyleId,
): { width: number; height: number; lines: string[] } {
  const numberLabel = formatStepNumber(order, numberStyle)
  const prefix = numberLabel ? `${numberLabel} ` : ''
  const text = `${prefix}${description || t('callout.emptyDescription')}`
  const fontCss = fontFamilyCss(fontFamily)
  const lineHeight = lineHeightFor(fontSize)
  const textWidth = measureTextWidth(text, fontSize, fontCss) + labelHPadding(fontSize)
  return {
    width: Math.max(MIN_LABEL_WIDTH, Math.ceil(textWidth)),
    height: Math.max(lineHeight + labelVPadding(fontSize), Math.round(fontSize * 1.5)),
    lines: [text],
  }
}

function getSectionForAnnotation(
  annotation: Annotation,
  sections: Section[],
): Section | null {
  if (!annotation.sectionId) return null
  return sections.find((section) => section.id === annotation.sectionId) ?? null
}

function anchorForAnnotation(
  annotation: Annotation,
  sections: Section[],
  side: 'left' | 'right',
): Point {
  const section = getSectionForAnnotation(annotation, sections)
  if (section) {
    return {
      x:
        side === 'left'
          ? section.rect.x + LINE_INSET
          : section.rect.x + section.rect.width - LINE_INSET,
      y: rectCenter(section.rect).y,
    }
  }
  return {
    x: annotation.markerPosition.x,
    y: annotation.markerPosition.y,
  }
}

function preferredSide(
  annotation: Annotation,
  sections: Section[],
  imageWidth: number,
): 'left' | 'right' {
  if (annotation.calloutSide === 'left' || annotation.calloutSide === 'right') {
    return annotation.calloutSide
  }
  const section = getSectionForAnnotation(annotation, sections)
  const x = section ? rectCenter(section.rect).x : annotation.markerPosition.x
  return x < imageWidth / 2 ? 'left' : 'right'
}

/**
 * Place labels as close as possible to each preferred Y, stacked top-to-bottom
 * in input order (= annotation.order) so numbers read sequentially down the side.
 * Caller must size vertical margins so the stack fits; gaps are never compressed.
 */
function packLabelYs(
  preferredCenters: number[],
  heights: number[],
  minY: number,
  maxY: number,
  gap: number,
): number[] {
  const count = preferredCenters.length
  if (count === 0) return []

  const preferredTops = preferredCenters.map((center, itemIndex) => {
    const height = heights[itemIndex]!
    return clamp(center - height / 2, minY, Math.max(minY, maxY - height))
  })

  const packed = [...preferredTops]
  for (let itemIndex = 1; itemIndex < count; itemIndex += 1) {
    const minTop = packed[itemIndex - 1]! + heights[itemIndex - 1]! + gap
    packed[itemIndex] = Math.max(packed[itemIndex]!, minTop)
  }

  const stackBottom = packed[count - 1]! + heights[count - 1]!
  if (stackBottom > maxY) {
    const shift = stackBottom - maxY
    for (let itemIndex = 0; itemIndex < count; itemIndex += 1) {
      packed[itemIndex] = packed[itemIndex]! - shift
    }
  }

  // If still above the band (undersized document), stack from minY with full gaps.
  if (packed[0]! < minY) {
    let cursorY = minY
    for (let itemIndex = 0; itemIndex < count; itemIndex += 1) {
      packed[itemIndex] = cursorY
      cursorY += heights[itemIndex]! + gap
    }
  }

  return packed
}

function packSide(
  items: Annotation[],
  sizes: Array<{ width: number; height: number; lines: string[] }>,
  sections: Section[],
  document: DocumentLayout,
  side: 'left' | 'right',
  gap: number,
): CalloutLayoutItem[] {
  if (items.length === 0) return []

  const anchors = items.map((annotation) =>
    anchorForAnnotation(annotation, sections, side),
  )

  const documentHeight =
    document.marginTop + document.imageHeight + document.marginBottom
  const minY = PAGE_PAD
  const maxY = documentHeight - PAGE_PAD

  const preferredCenters = items.map((annotation, itemIndex) => {
    const size = sizes[itemIndex]!
    if (annotation.calloutPosition) {
      return annotation.calloutPosition.y + size.height / 2
    }
    return document.marginTop + anchors[itemIndex]!.y
  })

  const packedTops = packLabelYs(
    preferredCenters,
    sizes.map((size) => size.height),
    minY,
    maxY,
    gap,
  )

  const layouts: CalloutLayoutItem[] = []

  for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
    const annotation = items[itemIndex]!
    const size = sizes[itemIndex]!
    const anchor = anchors[itemIndex]!

    const imageLeft = document.marginLeft
    const imageRight = document.marginLeft + document.imageWidth
    const autoLabelX =
      side === 'left'
        ? imageLeft - size.width - IMAGE_GUTTER
        : imageRight + IMAGE_GUTTER

    let labelX = autoLabelX
    const labelY = packedTops[itemIndex]!

    if (annotation.calloutPosition) {
      labelX = annotation.calloutPosition.x
      // Keep dragged labels outside the screenshot when size/margins change.
      if (side === 'left') {
        labelX = Math.min(labelX, imageLeft - size.width - IMAGE_GUTTER)
        labelX = Math.max(PAGE_PAD, labelX)
      } else {
        labelX = Math.max(labelX, imageRight + IMAGE_GUTTER)
        const maxX =
          imageRight + document.marginRight - size.width - PAGE_PAD
        labelX = Math.min(labelX, Math.max(imageRight + IMAGE_GUTTER, maxX))
      }
    }

    const labelCenterY = labelY + size.height / 2
    const elbowX =
      side === 'left'
        ? document.marginLeft - ELBOW_INSET
        : document.marginLeft + document.imageWidth + ELBOW_INSET

    layouts.push({
      annotationId: annotation.id,
      side,
      labelPosition: { x: labelX, y: labelY },
      anchorPoint: {
        x: document.marginLeft + anchor.x,
        y: document.marginTop + anchor.y,
      },
      elbowPoint: {
        x: elbowX,
        y: labelCenterY,
      },
      labelWidth: size.width,
      labelHeight: size.height,
      lines: size.lines,
    })
  }

  return layouts
}

function splitBySide(
  annotations: Annotation[],
  sections: Section[],
  imageWidth: number,
): { leftItems: Annotation[]; rightItems: Annotation[] } {
  const leftItems: Annotation[] = []
  const rightItems: Annotation[] = []
  for (const annotation of annotations) {
    const side = preferredSide(annotation, sections, imageWidth)
    if (side === 'left') leftItems.push(annotation)
    else rightItems.push(annotation)
  }
  return { leftItems, rightItems }
}

/**
 * Place callout labels beside the image near each target's Y.
 */
export function computeCalloutLayouts(
  annotations: Annotation[],
  sections: Section[],
  document: DocumentLayout,
  fontSize: number,
  fontFamily: string,
  numberStyle: NumberStyleId,
): CalloutLayoutItem[] {
  const callouts = [...annotations].sort((left, right) => left.order - right.order)
  if (callouts.length === 0) return []

  const gap = labelGapFor(fontSize)
  const { leftItems, rightItems } = splitBySide(callouts, sections, document.imageWidth)
  const leftSizes = leftItems.map((annotation) =>
    estimateLabelSize(annotation.description, annotation.order, fontFamily, fontSize, numberStyle),
  )
  const rightSizes = rightItems.map((annotation) =>
    estimateLabelSize(annotation.description, annotation.order, fontFamily, fontSize, numberStyle),
  )

  return [
    ...packSide(leftItems, leftSizes, sections, document, 'left', gap),
    ...packSide(rightItems, rightSizes, sections, document, 'right', gap),
  ]
}

export function createDefaultDocumentLayout(
  imageWidth: number,
  imageHeight: number,
  calloutCount: number,
  maxLabelWidth = MIN_LABEL_WIDTH,
): DocumentLayout {
  const sideMargin =
    calloutCount > 0 ? sideMarginFor(maxLabelWidth) : EMPTY_SIDE_MARGIN
  return {
    imageWidth,
    imageHeight,
    marginLeft: sideMargin,
    marginRight: sideMargin,
    marginTop: MIN_VERTICAL_MARGIN,
    marginBottom: MIN_VERTICAL_MARGIN,
  }
}

/** Measure labels, size side/vertical margins to fit, then pack callout layouts. */
export function layoutCalloutsForImage(
  annotations: Annotation[],
  sections: Section[],
  imageWidth: number,
  imageHeight: number,
  fontSize: number,
  fontFamily: string,
  numberStyle: NumberStyleId,
): { document: DocumentLayout; layouts: CalloutLayoutItem[] } {
  const callouts = [...annotations].sort((left, right) => left.order - right.order)
  if (callouts.length === 0) {
    return {
      document: createDefaultDocumentLayout(imageWidth, imageHeight, 0),
      layouts: [],
    }
  }

  const gap = labelGapFor(fontSize)
  const { leftItems, rightItems } = splitBySide(callouts, sections, imageWidth)
  const leftSizes = leftItems.map((annotation) =>
    estimateLabelSize(annotation.description, annotation.order, fontFamily, fontSize, numberStyle),
  )
  const rightSizes = rightItems.map((annotation) =>
    estimateLabelSize(annotation.description, annotation.order, fontFamily, fontSize, numberStyle),
  )

  const leftMax = leftSizes.reduce(
    (maxWidth, size) => Math.max(maxWidth, size.width),
    MIN_LABEL_WIDTH,
  )
  const rightMax = rightSizes.reduce(
    (maxWidth, size) => Math.max(maxWidth, size.width),
    MIN_LABEL_WIDTH,
  )
  const maxStack = Math.max(
    stackHeight(
      leftSizes.map((size) => size.height),
      gap,
    ),
    stackHeight(
      rightSizes.map((size) => size.height),
      gap,
    ),
  )
  const { marginTop, marginBottom } = verticalMarginsFor(imageHeight, maxStack)

  const document: DocumentLayout = {
    imageWidth,
    imageHeight,
    marginLeft: leftItems.length > 0 ? sideMarginFor(leftMax) : EMPTY_SIDE_MARGIN,
    marginRight: rightItems.length > 0 ? sideMarginFor(rightMax) : EMPTY_SIDE_MARGIN,
    marginTop,
    marginBottom,
  }

  return {
    document,
    layouts: [
      ...packSide(leftItems, leftSizes, sections, document, 'left', gap),
      ...packSide(rightItems, rightSizes, sections, document, 'right', gap),
    ],
  }
}
