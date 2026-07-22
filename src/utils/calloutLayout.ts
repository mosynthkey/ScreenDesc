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

const LABEL_GAP = 12
const LINE_INSET = 8
const IMAGE_GUTTER = 14
const PAGE_PAD = 8
const MIN_LABEL_WIDTH = 120
const EMPTY_SIDE_MARGIN = 32
const ELBOW_INSET = 10

function lineHeightFor(fontSize: number): number {
  return Math.round(fontSize * 1.375)
}

function labelHPadding(fontSize: number): number {
  return Math.max(20, Math.round(fontSize * 0.55))
}

function sideMarginFor(maxLabelWidth: number): number {
  return maxLabelWidth + IMAGE_GUTTER + PAGE_PAD
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
    height: Math.max(lineHeight + 14, Math.round(fontSize * 1.5)),
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
 * Place labels as close as possible to each anchor's Y, stacked top-to-bottom
 * in the given input order (= annotation.order, not anchor Y) so the callout
 * numbers always read sequentially down the side of the image.
 */
function packLabelYs(
  preferredCenters: number[],
  heights: number[],
  minY: number,
  maxY: number,
): number[] {
  const count = preferredCenters.length
  if (count === 0) return []

  const order = preferredCenters.map((_, itemIndex) => itemIndex)

  const orderedHeights = order.map((itemIndex) => heights[itemIndex]!)
  const preferredTops = order.map((itemIndex) => {
    const height = heights[itemIndex]!
    return clamp(
      preferredCenters[itemIndex]! - height / 2,
      minY,
      Math.max(minY, maxY - height),
    )
  })

  const packed = [...preferredTops]

  for (let orderIndex = 1; orderIndex < count; orderIndex += 1) {
    const minTop =
      packed[orderIndex - 1]! + orderedHeights[orderIndex - 1]! + LABEL_GAP
    packed[orderIndex] = Math.max(packed[orderIndex]!, minTop)
  }

  const stackBottom = packed[count - 1]! + orderedHeights[count - 1]!
  if (stackBottom > maxY) {
    const shift = stackBottom - maxY
    for (let orderIndex = 0; orderIndex < count; orderIndex += 1) {
      packed[orderIndex] = packed[orderIndex]! - shift
    }
  }

  if (packed[0]! < minY) {
    const heightsSum = orderedHeights.reduce((sum, height) => sum + height, 0)
    const available = Math.max(0, maxY - minY - heightsSum)
    const gap = count > 1 ? Math.max(2, available / (count - 1)) : 0
    let cursorY = minY
    for (let orderIndex = 0; orderIndex < count; orderIndex += 1) {
      packed[orderIndex] = cursorY
      cursorY += orderedHeights[orderIndex]! + gap
    }
  }

  const result = new Array<number>(count)
  for (let orderIndex = 0; orderIndex < count; orderIndex += 1) {
    result[order[orderIndex]!] = packed[orderIndex]!
  }
  return result
}

function packSide(
  items: Annotation[],
  sizes: Array<{ width: number; height: number; lines: string[] }>,
  sections: Section[],
  document: DocumentLayout,
  side: 'left' | 'right',
): CalloutLayoutItem[] {
  if (items.length === 0) return []

  const anchors = items.map((annotation) =>
    anchorForAnnotation(annotation, sections, side),
  )

  const minY = document.marginTop + PAGE_PAD
  const maxY = document.marginTop + document.imageHeight - PAGE_PAD

  const preferredCenters = anchors.map(
    (anchor) => document.marginTop + anchor.y,
  )
  const autoTops = packLabelYs(
    preferredCenters,
    sizes.map((size) => size.height),
    minY,
    maxY,
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
    let labelY = autoTops[itemIndex]!

    if (annotation.calloutPosition) {
      labelX = annotation.calloutPosition.x
      labelY = annotation.calloutPosition.y
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
 * Pass only annotations that should render as callouts.
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

  const { leftItems, rightItems } = splitBySide(callouts, sections, document.imageWidth)
  const leftSizes = leftItems.map((annotation) =>
    estimateLabelSize(annotation.description, annotation.order, fontFamily, fontSize, numberStyle),
  )
  const rightSizes = rightItems.map((annotation) =>
    estimateLabelSize(annotation.description, annotation.order, fontFamily, fontSize, numberStyle),
  )

  return [
    ...packSide(leftItems, leftSizes, sections, document, 'left'),
    ...packSide(rightItems, rightSizes, sections, document, 'right'),
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
    marginTop: 24,
    marginBottom: 24,
  }
}

/** Measure labels, size side margins to fit, then pack callout layouts. */
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

  const document: DocumentLayout = {
    imageWidth,
    imageHeight,
    marginLeft: leftItems.length > 0 ? sideMarginFor(leftMax) : EMPTY_SIDE_MARGIN,
    marginRight: rightItems.length > 0 ? sideMarginFor(rightMax) : EMPTY_SIDE_MARGIN,
    marginTop: 24,
    marginBottom: 24,
  }

  return {
    document,
    layouts: [
      ...packSide(leftItems, leftSizes, sections, document, 'left'),
      ...packSide(rightItems, rightSizes, sections, document, 'right'),
    ],
  }
}
