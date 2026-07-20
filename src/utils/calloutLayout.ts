import type {
  Annotation,
  CalloutLayoutItem,
  DocumentLayout,
  Point,
  Section,
} from '../types/annotation'
import { clamp, rectCenter } from './geometry'
import { toCircledNumber } from './circledNumbers'
import { measureTextWidth, wrapText } from './textMeasure'
import { fontFamilyCss } from './googleFonts'

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
const LABEL_H_PADDING = 20
const MIN_LABEL_WIDTH = 120
const MAX_LABEL_WIDTH = 260
const ELBOW_INSET = 10

function lineHeightFor(fontSize: number): number {
  return Math.round(fontSize * 1.375)
}

function estimateLabelSize(
  description: string,
  order: number,
  fontFamily: string,
  fontSize: number,
): { width: number; height: number; lines: string[] } {
  const prefix = `${toCircledNumber(order)} `
  const text = `${prefix}${description || '説明'}`
  const fontCss = fontFamilyCss(fontFamily)
  const lineHeight = lineHeightFor(fontSize)
  const singleLineWidth = measureTextWidth(text, fontSize, fontCss) + LABEL_H_PADDING

  if (singleLineWidth <= MAX_LABEL_WIDTH) {
    return {
      width: Math.max(MIN_LABEL_WIDTH, Math.ceil(singleLineWidth)),
      height: Math.max(36, lineHeight + 14),
      lines: [text],
    }
  }

  const lines = wrapText(text, fontSize, fontCss, MAX_LABEL_WIDTH - LABEL_H_PADDING)
  return {
    width: MAX_LABEL_WIDTH,
    height: Math.max(36, lines.length * lineHeight + 14),
    lines,
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

  // Push down only when needed to clear the previous label
  for (let orderIndex = 1; orderIndex < count; orderIndex += 1) {
    const minTop =
      packed[orderIndex - 1]! + orderedHeights[orderIndex - 1]! + LABEL_GAP
    packed[orderIndex] = Math.max(packed[orderIndex]!, minTop)
  }

  // If the stack runs past the bottom, shift everything up together
  const stackBottom =
    packed[count - 1]! + orderedHeights[count - 1]!
  if (stackBottom > maxY) {
    const shift = stackBottom - maxY
    for (let orderIndex = 0; orderIndex < count; orderIndex += 1) {
      packed[orderIndex] = packed[orderIndex]! - shift
    }
  }

  // Still clipped at the top → not enough space; pack from top with compressed gaps
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
  sections: Section[],
  document: DocumentLayout,
  side: 'left' | 'right',
  fontSize: number,
  fontFamily: string,
): CalloutLayoutItem[] {
  if (items.length === 0) return []

  const sizes = items.map((annotation) =>
    estimateLabelSize(annotation.description, annotation.order, fontFamily, fontSize),
  )
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

    let labelX =
      side === 'left'
        ? document.marginLeft - size.width - IMAGE_GUTTER
        : document.marginLeft + document.imageWidth + IMAGE_GUTTER
    labelX = Math.max(PAGE_PAD, labelX)

    let labelY = autoTops[itemIndex]!

    if (annotation.calloutPosition) {
      labelX = annotation.calloutPosition.x
      labelY = annotation.calloutPosition.y
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
): CalloutLayoutItem[] {
  const callouts = [...annotations].sort((left, right) => left.order - right.order)

  if (callouts.length === 0) return []

  const leftItems: Annotation[] = []
  const rightItems: Annotation[] = []

  for (const annotation of callouts) {
    const side = preferredSide(annotation, sections, document.imageWidth)
    if (side === 'left') leftItems.push(annotation)
    else rightItems.push(annotation)
  }

  return [
    ...packSide(leftItems, sections, document, 'left', fontSize, fontFamily),
    ...packSide(rightItems, sections, document, 'right', fontSize, fontFamily),
  ]
}

export function createDefaultDocumentLayout(
  imageWidth: number,
  imageHeight: number,
  calloutCount: number,
): DocumentLayout {
  // Tight margin: label width + gutter, not a wide empty band
  const sideMargin =
    calloutCount > 0 ? MAX_LABEL_WIDTH + IMAGE_GUTTER + PAGE_PAD : 32
  return {
    imageWidth,
    imageHeight,
    marginLeft: sideMargin,
    marginRight: sideMargin,
    marginTop: 24,
    marginBottom: 24,
  }
}
