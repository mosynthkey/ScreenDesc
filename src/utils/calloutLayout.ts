import type {
  Annotation,
  CalloutLayoutItem,
  CalloutSide,
  DocumentLayout,
  Point,
  Section,
} from '../types/annotation'
import { clamp, rectCenter } from './geometry'
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
 * Cubic leader with a single bend (C-curve). Leaves along `leaveDirection`
 * (must match the anchor marker's own orientation — see `leaderLeaveUnit` in
 * anchorStyle.ts — so the arrowhead/chevron points the same way the curve
 * actually departs), then curves into the attachment point.
 */
export function buildLeaderPath(
  start: Point,
  endX: number,
  endY: number,
  leaveDirection: Point,
): string {
  const dx = endX - start.x
  const dy = endY - start.y
  const dist = Math.hypot(dx, dy)
  if (dist < 1e-6) return `M ${start.x} ${start.y} L ${endX} ${endY}`

  // Leave exactly along leaveDirection (arrowhead points the opposite way,
  // so the curve and the marker always agree), then bend smoothly into end.
  const stub = Math.min(dist * 0.6, 56)
  const control1: Point = {
    x: start.x + leaveDirection.x * stub,
    y: start.y + leaveDirection.y * stub,
  }
  const control2: Point = {
    x: endX - dx * 0.2,
    y: endY - dy * 0.2,
  }
  return `M ${start.x} ${start.y} C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${endX} ${endY}`
}

/** Midpoint of the label's edge facing the image. */
function labelAttachPoint(
  labelPosition: Point,
  labelWidth: number,
  labelHeight: number,
  side: ResolvedCalloutSide,
): Point {
  const centerX = labelPosition.x + labelWidth / 2
  const centerY = labelPosition.y + labelHeight / 2
  if (side === 'top') return { x: centerX, y: labelPosition.y + labelHeight }
  if (side === 'bottom') return { x: centerX, y: labelPosition.y }
  const x = side === 'left' ? labelPosition.x + labelWidth : labelPosition.x
  return { x, y: centerY }
}

export function leaderAttachOnLabel(layout: CalloutLayoutItem): Point {
  return labelAttachPoint(
    layout.labelPosition,
    layout.labelWidth,
    layout.labelHeight,
    layout.side,
  )
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
  numberPrefix: string,
  fontFamily: string,
  fontSize: number,
  fontWeight: number,
  fontItalic: boolean,
): { width: number; height: number; lines: string[] } {
  const prefix = numberPrefix ? `${numberPrefix} ` : ''
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
  lineHaloWidth: number,
): Point {
  const section = getSectionForAnnotation(annotation, sections)
  const offset = annotation.anchorOffset
  // When the anchor sits outside the section, leave room for the leader's
  // halo stroke so it doesn't paint back over the section border.
  const inset = annotation.anchorOutside
    ? -(LINE_INSET + Math.max(0, lineHaloWidth))
    : LINE_INSET
  let baseX: number
  let baseY: number
  if (section) {
    if (side === 'left') {
      baseX = section.rect.x + inset
      baseY = rectCenter(section.rect).y
    } else if (side === 'right') {
      baseX = section.rect.x + section.rect.width - inset
      baseY = rectCenter(section.rect).y
    } else if (side === 'top') {
      baseX = rectCenter(section.rect).x
      baseY = section.rect.y + inset
    } else {
      baseX = rectCenter(section.rect).x
      baseY = section.rect.y + section.rect.height - inset
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

/** Section center (or marker position) in document coords — what the arrow should point at. */
function targetCenterForAnnotation(
  annotation: Annotation,
  sections: Section[],
  document: DocumentLayout,
): Point {
  const local = referencePointForAnnotation(annotation, sections)
  return {
    x: document.marginLeft + local.x,
    y: document.marginTop + local.y,
  }
}

export function referencePointForAnnotation(
  annotation: Annotation,
  sections: Section[],
): Point {
  const section = getSectionForAnnotation(annotation, sections)
  return section ? rectCenter(section.rect) : { ...annotation.markerPosition }
}

const RESOLVED_SIDES: readonly ResolvedCalloutSide[] = ['left', 'right', 'top', 'bottom']

/** How much of the edge's length one label eats up: its height on left/right, its width on top/bottom. */
function congestionExtent(
  size: { width: number; height: number },
  side: ResolvedCalloutSide,
): number {
  return side === 'left' || side === 'right' ? size.height : size.width
}

function availableExtent(
  side: ResolvedCalloutSide,
  imageWidth: number,
  imageHeight: number,
): number {
  return side === 'left' || side === 'right' ? imageHeight : imageWidth
}

/** 0 (touching the edge) to ~1 (across the whole image). */
function distanceScore(
  point: Point,
  side: ResolvedCalloutSide,
  imageWidth: number,
  imageHeight: number,
): number {
  if (side === 'left') return imageWidth > 0 ? point.x / imageWidth : 0
  if (side === 'right') return imageWidth > 0 ? (imageWidth - point.x) / imageWidth : 0
  if (side === 'top') return imageHeight > 0 ? point.y / imageHeight : 0
  return imageHeight > 0 ? (imageHeight - point.y) / imageHeight : 0
}

const DISTANCE_WEIGHT = 0.5
const CONGESTION_WEIGHT = 0.5

export interface AutoSideDecision {
  annotationId: string
  distance: Record<ResolvedCalloutSide, number>
  congestion: Record<ResolvedCalloutSide, number>
  cost: Record<ResolvedCalloutSide, number>
  chosenSide: ResolvedCalloutSide
}

/**
 * Assigns every annotation a side, weighing "which edge is nearest" against
 * "how crowded that edge already is" — a tall image's top/bottom bands fill
 * up fast with wide labels, while its left/right columns stack many
 * single-line labels without crowding. Annotations with an explicit side
 * keep it (only contributing to that side's load); only `calloutSide:
 * 'auto'` ones get decided here, most-decisive-preference first so a
 * strong preference isn't crowded out by a borderline one that goes first.
 */
export function resolveAutoSides(
  annotations: Annotation[],
  sizeById: Map<string, { width: number; height: number }>,
  sections: Section[],
  imageWidth: number,
  imageHeight: number,
  onDecision?: (decision: AutoSideDecision) => void,
): Map<string, ResolvedCalloutSide> {
  const resolved = new Map<string, ResolvedCalloutSide>()
  const load: Record<ResolvedCalloutSide, number> = { left: 0, right: 0, top: 0, bottom: 0 }
  const fallbackSize = { width: MIN_LABEL_WIDTH, height: 0 }

  const autoItems: Array<{ annotation: Annotation; point: Point }> = []
  for (const annotation of annotations) {
    if (
      annotation.calloutSide === 'left' ||
      annotation.calloutSide === 'right' ||
      annotation.calloutSide === 'top' ||
      annotation.calloutSide === 'bottom'
    ) {
      resolved.set(annotation.id, annotation.calloutSide)
      const size = sizeById.get(annotation.id) ?? fallbackSize
      load[annotation.calloutSide] += congestionExtent(size, annotation.calloutSide)
      continue
    }
    autoItems.push({
      annotation,
      point: referencePointForAnnotation(annotation, sections),
    })
  }

  const decisiveness = (item: { point: Point }): number => {
    const values = RESOLVED_SIDES.map((side) =>
      distanceScore(item.point, side, imageWidth, imageHeight),
    ).sort((left, right) => left - right)
    return values[1]! - values[0]!
  }
  autoItems.sort((left, right) => decisiveness(right) - decisiveness(left))

  for (const item of autoItems) {
    const size = sizeById.get(item.annotation.id) ?? fallbackSize
    const distance = {} as Record<ResolvedCalloutSide, number>
    const congestion = {} as Record<ResolvedCalloutSide, number>
    const cost = {} as Record<ResolvedCalloutSide, number>
    let bestSide: ResolvedCalloutSide = RESOLVED_SIDES[0]!
    let bestCost = Infinity
    for (const side of RESOLVED_SIDES) {
      const capacity = availableExtent(side, imageWidth, imageHeight)
      const extent = congestionExtent(size, side)
      distance[side] = distanceScore(item.point, side, imageWidth, imageHeight)
      congestion[side] = capacity > 0 ? (load[side] + extent) / capacity : 0
      cost[side] = DISTANCE_WEIGHT * distance[side] + CONGESTION_WEIGHT * congestion[side]
      if (cost[side] < bestCost) {
        bestCost = cost[side]
        bestSide = side
      }
    }
    resolved.set(item.annotation.id, bestSide)
    load[bestSide] += congestionExtent(size, bestSide)
    onDecision?.({ annotationId: item.annotation.id, distance, congestion, cost, chosenSide: bestSide })
  }

  return resolved
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
  lineHaloWidth: number,
): CalloutLayoutItem[] {
  if (items.length === 0) return []

  const anchors = items.map((annotation) =>
    anchorForAnnotation(
      annotation,
      sections,
      side,
      document.imageWidth,
      document.imageHeight,
      lineHaloWidth,
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
  // Stack top-to-bottom by natural anchor position, not creation order —
  // otherwise two labels can swap places and cross their leader lines.
  autoIndices.sort((left, right) => anchors[left]!.y - anchors[right]!.y)

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
      targetCenter: targetCenterForAnnotation(annotation, sections, document),
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
  lineHaloWidth: number,
): CalloutLayoutItem[] {
  if (items.length === 0) return []

  const anchors = items.map((annotation) =>
    anchorForAnnotation(
      annotation,
      sections,
      side,
      document.imageWidth,
      document.imageHeight,
      lineHaloWidth,
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
  // Stack left-to-right by natural anchor position, not creation order —
  // otherwise two labels can swap places and cross their leader lines.
  autoIndices.sort((left, right) => anchors[left]!.x - anchors[right]!.x)

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
      targetCenter: targetCenterForAnnotation(annotation, sections, document),
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

function sizesFor(
  items: Annotation[],
  fontFamily: string,
  fontSize: number,
  fontWeight: number,
  fontItalic: boolean,
): Array<{ width: number; height: number; lines: string[] }> {
  return items.map((annotation) =>
    estimateLabelSize(
      annotation.description,
      annotation.numberPrefix,
      fontFamily,
      fontSize,
      fontWeight,
      fontItalic,
    ),
  )
}

/** Label size for a single annotation, e.g. for congestion lookups before it's laid out. */
export function estimateAnnotationLabelSize(
  annotation: Annotation,
  fontFamily: string,
  fontSize: number,
  fontWeight: number,
  fontItalic: boolean,
): { width: number; height: number } {
  return estimateLabelSize(
    annotation.description,
    annotation.numberPrefix,
    fontFamily,
    fontSize,
    fontWeight,
    fontItalic,
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
  lineHaloWidth: number,
): { document: DocumentLayout; layouts: CalloutLayoutItem[] } {
  const callouts = [...annotations].sort((left, right) => left.order - right.order)
  if (callouts.length === 0) {
    return {
      document: createDefaultDocumentLayout(imageWidth, imageHeight, 0),
      layouts: [],
    }
  }

  const gap = labelGapFor(fontSize)
  const allSizes = sizesFor(callouts, fontFamily, fontSize, fontWeight, fontItalic)
  const sizeById = new Map(callouts.map((annotation, index) => [annotation.id, allSizes[index]!]))
  const resolvedSides = resolveAutoSides(callouts, sizeById, sections, imageWidth, imageHeight)
  const groups: Record<ResolvedCalloutSide, Annotation[]> = {
    left: [],
    right: [],
    top: [],
    bottom: [],
  }
  for (const annotation of callouts) {
    groups[resolvedSides.get(annotation.id) ?? 'top'].push(annotation)
  }
  const leftSizes = groups.left.map((annotation) => sizeById.get(annotation.id)!)
  const rightSizes = groups.right.map((annotation) => sizeById.get(annotation.id)!)
  const topSizes = groups.top.map((annotation) => sizeById.get(annotation.id)!)
  const bottomSizes = groups.bottom.map((annotation) => sizeById.get(annotation.id)!)

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
      ...packSide(groups.left, leftSizes, sections, document, 'left', gap, lineHaloWidth),
      ...packSide(groups.right, rightSizes, sections, document, 'right', gap, lineHaloWidth),
      ...packBand(groups.top, topSizes, sections, document, 'top', gap, lineHaloWidth),
      ...packBand(groups.bottom, bottomSizes, sections, document, 'bottom', gap, lineHaloWidth),
    ],
  }
}
