import type {
  Annotation,
  CalloutLayoutItem,
  CalloutSide,
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

export type ResolvedCalloutSide = Exclude<CalloutSide, 'auto'>

const CALLOUT_SIDES: readonly CalloutSide[] = ['left', 'right', 'top', 'bottom', 'auto']

export function isCalloutSide(value: unknown): value is CalloutSide {
  return typeof value === 'string' && (CALLOUT_SIDES as readonly string[]).includes(value)
}

export function normalizeCalloutSide(value: unknown): CalloutSide {
  return isCalloutSide(value) ? value : 'auto'
}

/**
 * Cubic leader with a single bend (C-curve). Leaves along the dominant axis
 * toward the label, then curves into the attachment point.
 */
export function buildLeaderPath(start: Point, endX: number, endY: number): string {
  const dx = endX - start.x
  const dy = endY - start.y
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)

  if (absDy > absDx) {
    const direction = dy === 0 ? 1 : Math.sign(dy)
    const stub = Math.min(
      absDy * 0.55,
      48,
      Math.max(8, absDy * 0.35),
      absDx > 0 ? absDx * 0.45 + 10 : absDy,
    )
    const elbowY = start.y + direction * stub
    return `M ${start.x} ${start.y} C ${start.x} ${elbowY}, ${endX} ${elbowY}, ${endX} ${endY}`
  }

  const direction = dx === 0 ? 1 : Math.sign(dx)
  const stub = Math.min(
    absDx * 0.55,
    48,
    Math.max(8, absDx * 0.35),
    absDy > 0 ? absDy * 0.45 + 10 : absDx,
  )
  const elbowX = start.x + direction * stub
  return `M ${start.x} ${start.y} C ${elbowX} ${start.y}, ${elbowX} ${endY}, ${endX} ${endY}`
}

export function leaderAttachOnLabel(layout: CalloutLayoutItem): Point {
  const labelCenterX = layout.labelPosition.x + layout.labelWidth / 2
  const labelCenterY = layout.labelPosition.y + layout.labelHeight / 2
  if (layout.side === 'top') {
    return {
      x: labelCenterX,
      y: layout.labelPosition.y + layout.labelHeight,
    }
  }
  if (layout.side === 'bottom') {
    return {
      x: labelCenterX,
      y: layout.labelPosition.y,
    }
  }
  return {
    x:
      layout.anchorPoint.x < labelCenterX
        ? layout.labelPosition.x
        : layout.labelPosition.x + layout.labelWidth,
    y: labelCenterY,
  }
}

function documentSize(document: DocumentLayout): { width: number; height: number } {
  return {
    width: document.marginLeft + document.imageWidth + document.marginRight,
    height: document.marginTop + document.imageHeight + document.marginBottom,
  }
}

function clampLabelTopLeft(
  point: Point,
  labelWidth: number,
  labelHeight: number,
  document: DocumentLayout,
): Point {
  const { width, height } = documentSize(document)
  const maxX = Math.max(PAGE_PAD, width - PAGE_PAD - labelWidth)
  const maxY = Math.max(PAGE_PAD, height - PAGE_PAD - labelHeight)
  return {
    x: clamp(point.x, PAGE_PAD, maxX),
    y: clamp(point.y, PAGE_PAD, maxY),
  }
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

function labelGapFor(fontSize: number): number {
  return Math.max(LABEL_GAP_MIN, Math.round(fontSize * 0.35))
}

function sideMarginFor(maxLabelWidth: number): number {
  return maxLabelWidth + IMAGE_GUTTER + PAGE_PAD
}

function bandMarginFor(maxLabelHeight: number): number {
  return maxLabelHeight + IMAGE_GUTTER + PAGE_PAD
}

function stackExtent(sizes: number[], gap: number): number {
  if (sizes.length === 0) return 0
  const sizesSum = sizes.reduce((sum, size) => sum + size, 0)
  return sizesSum + Math.max(0, sizes.length - 1) * gap
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

function estimateLabelSize(
  description: string,
  order: number,
  fontFamily: string,
  fontSize: number,
  fontWeight: number,
  fontItalic: boolean,
  numberStyle: NumberStyleId,
): { width: number; height: number; lines: string[] } {
  const numberLabel = formatStepNumber(order, numberStyle)
  const prefix = numberLabel ? `${numberLabel} ` : ''
  const text = `${prefix}${description || t('callout.emptyDescription')}`
  const fontCss = fontFamilyCss(fontFamily)
  const lineHeight = lineHeightFor(fontSize)
  const textWidth =
    measureTextWidth(text, fontSize, fontCss, fontWeight, fontItalic) +
    labelHPadding(fontSize)
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
  side: ResolvedCalloutSide,
  imageWidth: number,
  imageHeight: number,
): Point {
  const section = getSectionForAnnotation(annotation, sections)
  const offset = annotation.anchorOffset
  let baseX: number
  let baseY: number
  if (section) {
    if (side === 'left') {
      baseX = section.rect.x + LINE_INSET
      baseY = rectCenter(section.rect).y
    } else if (side === 'right') {
      baseX = section.rect.x + section.rect.width - LINE_INSET
      baseY = rectCenter(section.rect).y
    } else if (side === 'top') {
      baseX = rectCenter(section.rect).x
      baseY = section.rect.y + LINE_INSET
    } else {
      baseX = rectCenter(section.rect).x
      baseY = section.rect.y + section.rect.height - LINE_INSET
    }
  } else {
    baseX = annotation.markerPosition.x
    baseY = annotation.markerPosition.y
  }
  return {
    x: clamp(baseX + offset.x, 0, imageWidth),
    y: clamp(baseY + offset.y, 0, imageHeight),
  }
}

function referencePointForAnnotation(
  annotation: Annotation,
  sections: Section[],
): Point {
  const section = getSectionForAnnotation(annotation, sections)
  return section ? rectCenter(section.rect) : { ...annotation.markerPosition }
}

/** Pick the image edge closest to the marker (ties keep left → right → top → bottom). */
export function preferredSide(
  annotation: Annotation,
  sections: Section[],
  imageWidth: number,
  imageHeight: number,
): ResolvedCalloutSide {
  if (
    annotation.calloutSide === 'left' ||
    annotation.calloutSide === 'right' ||
    annotation.calloutSide === 'top' ||
    annotation.calloutSide === 'bottom'
  ) {
    return annotation.calloutSide
  }
  const point = referencePointForAnnotation(annotation, sections)
  const candidates: Array<{ side: ResolvedCalloutSide; distance: number }> = [
    { side: 'left', distance: point.x },
    { side: 'right', distance: imageWidth - point.x },
    { side: 'top', distance: point.y },
    { side: 'bottom', distance: imageHeight - point.y },
  ]
  let best = candidates[0]!
  for (let candidateIndex = 1; candidateIndex < candidates.length; candidateIndex += 1) {
    const candidate = candidates[candidateIndex]!
    if (candidate.distance < best.distance) best = candidate
  }
  return best.side
}

/**
 * Order annotations so packing on each side follows position (fewer crossed leaders):
 * top/bottom by X then Y; left/right by Y then X. Sides: top → left → right → bottom.
 */
export function orderedAnnotationsForClearLeaders(
  annotations: Annotation[],
  sections: Section[],
  imageWidth: number,
  imageHeight: number,
): Annotation[] {
  const groups: Record<ResolvedCalloutSide, Annotation[]> = {
    left: [],
    right: [],
    top: [],
    bottom: [],
  }
  for (const annotation of annotations) {
    groups[preferredSide(annotation, sections, imageWidth, imageHeight)].push(annotation)
  }

  const compareByYX = (left: Annotation, right: Annotation): number => {
    const leftPoint = referencePointForAnnotation(left, sections)
    const rightPoint = referencePointForAnnotation(right, sections)
    const yDelta = leftPoint.y - rightPoint.y
    if (yDelta !== 0) return yDelta
    return leftPoint.x - rightPoint.x
  }
  const compareByXY = (left: Annotation, right: Annotation): number => {
    const leftPoint = referencePointForAnnotation(left, sections)
    const rightPoint = referencePointForAnnotation(right, sections)
    const xDelta = leftPoint.x - rightPoint.x
    if (xDelta !== 0) return xDelta
    return leftPoint.y - rightPoint.y
  }

  groups.top.sort(compareByXY)
  groups.left.sort(compareByYX)
  groups.right.sort(compareByYX)
  groups.bottom.sort(compareByXY)

  return [...groups.top, ...groups.left, ...groups.right, ...groups.bottom]
}

/**
 * Place items as close as possible to each preferred center, stacked in input
 * order so numbers read sequentially. Gaps are never compressed.
 */
function packAlongAxis(
  preferredCenters: number[],
  extents: number[],
  minPos: number,
  maxPos: number,
  gap: number,
): number[] {
  const count = preferredCenters.length
  if (count === 0) return []

  const preferredStarts = preferredCenters.map((center, itemIndex) => {
    const extent = extents[itemIndex]!
    return clamp(center - extent / 2, minPos, Math.max(minPos, maxPos - extent))
  })

  const packed = [...preferredStarts]
  for (let itemIndex = 1; itemIndex < count; itemIndex += 1) {
    const minStart = packed[itemIndex - 1]! + extents[itemIndex - 1]! + gap
    packed[itemIndex] = Math.max(packed[itemIndex]!, minStart)
  }

  const stackEnd = packed[count - 1]! + extents[count - 1]!
  if (stackEnd > maxPos) {
    const shift = stackEnd - maxPos
    for (let itemIndex = 0; itemIndex < count; itemIndex += 1) {
      packed[itemIndex] = packed[itemIndex]! - shift
    }
  }

  if (packed[0]! < minPos) {
    let cursor = minPos
    for (let itemIndex = 0; itemIndex < count; itemIndex += 1) {
      packed[itemIndex] = cursor
      cursor += extents[itemIndex]! + gap
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
    anchorForAnnotation(
      annotation,
      sections,
      side,
      document.imageWidth,
      document.imageHeight,
    ),
  )

  const documentHeight =
    document.marginTop + document.imageHeight + document.marginBottom
  const minY = PAGE_PAD
  const maxY = documentHeight - PAGE_PAD

  const autoIndices: number[] = []
  for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
    if (!items[itemIndex]!.calloutPosition) autoIndices.push(itemIndex)
  }

  const packedAutoTops = packAlongAxis(
    autoIndices.map((itemIndex) => document.marginTop + anchors[itemIndex]!.y),
    autoIndices.map((itemIndex) => sizes[itemIndex]!.height),
    minY,
    maxY,
    gap,
  )
  const autoTopByIndex = new Map<number, number>()
  autoIndices.forEach((itemIndex, autoIndex) => {
    autoTopByIndex.set(itemIndex, packedAutoTops[autoIndex]!)
  })

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
    let labelY = autoTopByIndex.get(itemIndex) ?? minY

    if (annotation.calloutPosition) {
      const clamped = clampLabelTopLeft(
        annotation.calloutPosition,
        size.width,
        size.height,
        document,
      )
      labelX = clamped.x
      labelY = clamped.y
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

function packBand(
  items: Annotation[],
  sizes: Array<{ width: number; height: number; lines: string[] }>,
  sections: Section[],
  document: DocumentLayout,
  side: 'top' | 'bottom',
  gap: number,
): CalloutLayoutItem[] {
  if (items.length === 0) return []

  const anchors = items.map((annotation) =>
    anchorForAnnotation(
      annotation,
      sections,
      side,
      document.imageWidth,
      document.imageHeight,
    ),
  )

  const documentWidth =
    document.marginLeft + document.imageWidth + document.marginRight
  const minX = PAGE_PAD
  const maxX = documentWidth - PAGE_PAD

  const autoIndices: number[] = []
  for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
    if (!items[itemIndex]!.calloutPosition) autoIndices.push(itemIndex)
  }

  const packedAutoLefts = packAlongAxis(
    autoIndices.map((itemIndex) => document.marginLeft + anchors[itemIndex]!.x),
    autoIndices.map((itemIndex) => sizes[itemIndex]!.width),
    minX,
    maxX,
    gap,
  )
  const autoLeftByIndex = new Map<number, number>()
  autoIndices.forEach((itemIndex, autoIndex) => {
    autoLeftByIndex.set(itemIndex, packedAutoLefts[autoIndex]!)
  })

  const layouts: CalloutLayoutItem[] = []
  const imageTop = document.marginTop
  const imageBottom = document.marginTop + document.imageHeight

  for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
    const annotation = items[itemIndex]!
    const size = sizes[itemIndex]!
    const anchor = anchors[itemIndex]!

    const autoLabelY =
      side === 'top'
        ? imageTop - size.height - IMAGE_GUTTER
        : imageBottom + IMAGE_GUTTER

    let labelX = autoLeftByIndex.get(itemIndex) ?? minX
    let labelY = autoLabelY

    if (annotation.calloutPosition) {
      const clamped = clampLabelTopLeft(
        annotation.calloutPosition,
        size.width,
        size.height,
        document,
      )
      labelX = clamped.x
      labelY = clamped.y
    }

    const labelCenterX = labelX + size.width / 2
    const elbowY =
      side === 'top'
        ? document.marginTop - ELBOW_INSET
        : document.marginTop + document.imageHeight + ELBOW_INSET

    layouts.push({
      annotationId: annotation.id,
      side,
      labelPosition: { x: labelX, y: labelY },
      anchorPoint: {
        x: document.marginLeft + anchor.x,
        y: document.marginTop + anchor.y,
      },
      elbowPoint: {
        x: labelCenterX,
        y: elbowY,
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
  imageHeight: number,
): Record<ResolvedCalloutSide, Annotation[]> {
  const groups: Record<ResolvedCalloutSide, Annotation[]> = {
    left: [],
    right: [],
    top: [],
    bottom: [],
  }
  for (const annotation of annotations) {
    const side = preferredSide(annotation, sections, imageWidth, imageHeight)
    groups[side].push(annotation)
  }
  return groups
}

function sizesFor(
  items: Annotation[],
  fontFamily: string,
  fontSize: number,
  fontWeight: number,
  fontItalic: boolean,
  numberStyle: NumberStyleId,
): Array<{ width: number; height: number; lines: string[] }> {
  return items.map((annotation) =>
    estimateLabelSize(
      annotation.description,
      annotation.order,
      fontFamily,
      fontSize,
      fontWeight,
      fontItalic,
      numberStyle,
    ),
  )
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

export function layoutCalloutsForImage(
  annotations: Annotation[],
  sections: Section[],
  imageWidth: number,
  imageHeight: number,
  fontSize: number,
  fontFamily: string,
  fontWeight: number,
  fontItalic: boolean,
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
  const groups = splitBySide(callouts, sections, imageWidth, imageHeight)
  const leftSizes = sizesFor(
    groups.left,
    fontFamily,
    fontSize,
    fontWeight,
    fontItalic,
    numberStyle,
  )
  const rightSizes = sizesFor(
    groups.right,
    fontFamily,
    fontSize,
    fontWeight,
    fontItalic,
    numberStyle,
  )
  const topSizes = sizesFor(
    groups.top,
    fontFamily,
    fontSize,
    fontWeight,
    fontItalic,
    numberStyle,
  )
  const bottomSizes = sizesFor(
    groups.bottom,
    fontFamily,
    fontSize,
    fontWeight,
    fontItalic,
    numberStyle,
  )

  const leftMax = leftSizes.reduce(
    (maxWidth, size) => Math.max(maxWidth, size.width),
    MIN_LABEL_WIDTH,
  )
  const rightMax = rightSizes.reduce(
    (maxWidth, size) => Math.max(maxWidth, size.width),
    MIN_LABEL_WIDTH,
  )
  const topMaxHeight = topSizes.reduce(
    (maxHeight, size) => Math.max(maxHeight, size.height),
    0,
  )
  const bottomMaxHeight = bottomSizes.reduce(
    (maxHeight, size) => Math.max(maxHeight, size.height),
    0,
  )

  const maxSideStack = Math.max(
    stackExtent(
      leftSizes.map((size) => size.height),
      gap,
    ),
    stackExtent(
      rightSizes.map((size) => size.height),
      gap,
    ),
  )
  const { marginTop: stackMarginTop, marginBottom: stackMarginBottom } =
    verticalMarginsFor(imageHeight, maxSideStack)
  const bandTop =
    groups.top.length > 0 ? bandMarginFor(topMaxHeight) : MIN_VERTICAL_MARGIN
  const bandBottom =
    groups.bottom.length > 0 ? bandMarginFor(bottomMaxHeight) : MIN_VERTICAL_MARGIN

  const baseLeft =
    groups.left.length > 0 ? sideMarginFor(leftMax) : EMPTY_SIDE_MARGIN
  const baseRight =
    groups.right.length > 0 ? sideMarginFor(rightMax) : EMPTY_SIDE_MARGIN

  const maxBandRow = Math.max(
    stackExtent(
      topSizes.map((size) => size.width),
      gap,
    ),
    stackExtent(
      bottomSizes.map((size) => size.width),
      gap,
    ),
  )
  const minDocWidth = maxBandRow + 2 * PAGE_PAD
  const baseDocWidth = baseLeft + imageWidth + baseRight
  const horizontalGrow = Math.max(0, minDocWidth - baseDocWidth)

  const document: DocumentLayout = {
    imageWidth,
    imageHeight,
    marginLeft: baseLeft + Math.ceil(horizontalGrow / 2),
    marginRight: baseRight + Math.floor(horizontalGrow / 2),
    marginTop: Math.max(stackMarginTop, bandTop),
    marginBottom: Math.max(stackMarginBottom, bandBottom),
  }

  return {
    document,
    layouts: [
      ...packSide(groups.left, leftSizes, sections, document, 'left', gap),
      ...packSide(groups.right, rightSizes, sections, document, 'right', gap),
      ...packBand(groups.top, topSizes, sections, document, 'top', gap),
      ...packBand(groups.bottom, bottomSizes, sections, document, 'bottom', gap),
    ],
  }
}
