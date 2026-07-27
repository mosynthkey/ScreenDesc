import type {
  AnchorStyleId,
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
import {
  anchorOutsideReach,
  buildAnchorArrowGeometry,
  dotLeaderAttachPoint,
  isArrowAnchorStyle,
  leaderAttachPoint,
} from './anchorStyle'
import {
  ANCHOR_OUTSIDE_GAP_MAX,
  DEFAULT_IMAGE_GUTTER,
  DOT_RADIUS_MAX,
  HIGHLIGHT_MARGIN_MAX,
} from './markerSize'
import { LINE_WIDTH_MAX } from './lineStyle'
import { t } from '../i18n'

/**
 * Worst case an "outside" anchor legitimately reaches past the section it's
 * attached to (max configured gap + the largest dot/arrow's own reach).
 * `anchorForAnnotation` bounds to this instead of the image edge, so a
 * section flush against that edge can still hold its anchor (and the
 * leader's tip) the configured distance away — clamping to the image itself
 * silently ate that distance and left the tip short of the target.
 * `requiredGutterFor` already grows the image-to-label gutter to match
 * whatever this produces, so the canvas keeps up automatically.
 */
const MAX_ANCHOR_OUTSIDE_REACH =
  HIGHLIGHT_MARGIN_MAX +
  ANCHOR_OUTSIDE_GAP_MAX +
  Math.max(
    anchorOutsideReach('dot', DOT_RADIUS_MAX, LINE_WIDTH_MAX),
    anchorOutsideReach('arrow', DOT_RADIUS_MAX, LINE_WIDTH_MAX),
  )

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
const PAGE_PAD = 8
/** Absolute floor used only where no font size is in scope (e.g. the
 * empty-document default, or a defensive fallback before sizes exist). */
const MIN_LABEL_WIDTH = 120
const EMPTY_SIDE_MARGIN = 32
const ELBOW_INSET = 10
const MIN_VERTICAL_MARGIN = 24
/** Leader line always keeps at least this much visible length, even when an
 * "outside" anchor's own reach nearly spans the default image gutter. */
const MIN_VISIBLE_LEADER = 10

function lineHeightFor(fontSize: number): number {
  return Math.round(fontSize * 1.375)
}

function labelHPadding(fontSize: number): number {
  return Math.max(20, Math.round(fontSize * 0.55))
}

function labelVPadding(fontSize: number): number {
  return Math.max(14, Math.round(fontSize * 0.35))
}

/**
 * Narrowest a label is allowed to be, scaled to the callout font size —
 * without this, a fixed 120px floor looks fine at the default font size but
 * towers over short text like "(1)" at a small size, or is too cramped at a
 * large one.
 */
function minLabelWidthFor(fontSize: number): number {
  return Math.max(48, Math.round(fontSize * 1.5))
}

/** Horizontal / vertical padding inside a fixed-size callout text box. */
export function calloutLabelPadding(fontSize: number): {
  horizontal: number
  vertical: number
} {
  return {
    horizontal: labelHPadding(fontSize) / 2,
    vertical: labelVPadding(fontSize) / 2,
  }
}

/**
 * X for the text inside a label box. Ordinarily the box is sized to exactly
 * fit the text plus symmetric padding, so left-aligning at the padding edge
 * already looks centered. But a short string (or an empty one) hits
 * `minLabelWidthFor`'s floor, leaving the box wider than the text needs —
 * center the text in that leftover room instead of hugging the left edge.
 */
export function calloutLabelTextX(
  labelX: number,
  labelWidth: number,
  text: string,
  fontSize: number,
  fontFamily: string,
  fontWeight: number,
  fontItalic: boolean,
): number {
  const padding = calloutLabelPadding(fontSize)
  const textWidth = measureTextWidth(text, fontSize, fontFamily, fontWeight, fontItalic)
  const naturalWidth = textWidth + padding.horizontal * 2
  if (labelWidth <= naturalWidth) return labelX + padding.horizontal
  return labelX + (labelWidth - textWidth) / 2
}

/** Alphabetic baseline Y for a line whose ink is vertically centered in the label. */
export function calloutLabelLineBaselineY(
  labelY: number,
  labelHeight: number,
  lineCount: number,
  lineIndex: number,
  fontSize: number,
  baselineFromCenter: number,
): number {
  const lineHeight = lineHeightFor(fontSize)
  const blockHeight = lineCount * lineHeight
  const blockTop = labelY + (labelHeight - blockHeight) / 2
  const lineCenterY = blockTop + lineHeight * lineIndex + lineHeight / 2
  return lineCenterY + baselineFromCenter
}

function labelGapFor(fontSize: number): number {
  return Math.max(LABEL_GAP_MIN, Math.round(fontSize * 0.35))
}

function sideMarginFor(maxLabelWidth: number, gutter: number): number {
  return maxLabelWidth + gutter + PAGE_PAD
}

function bandMarginFor(maxLabelHeight: number, gutter: number): number {
  return maxLabelHeight + gutter + PAGE_PAD
}

/**
 * Where the visible leader *stroke* actually begins — the dot's center, or
 * (for arrow/chevron) the notch/tip `buildAnchorArrowGeometry` produces —
 * mirroring the render path in AnnotationCanvas.vue exactly, since a filled
 * arrowhead's own ink covers most of the span between the anchor and this
 * point and isn't part of the "line".
 */
function leaderStartForAnnotation(
  annotation: Annotation,
  sections: Section[],
  side: ResolvedCalloutSide,
  imageWidth: number,
  imageHeight: number,
  anchorStyle: AnchorStyleId,
  dotRadius: number,
  lineWidth: number,
  highlightMargin: number,
): Point {
  const anchor = anchorForAnnotation(
    annotation,
    sections,
    side,
    imageWidth,
    imageHeight,
    anchorStyle,
    dotRadius,
    lineWidth,
    highlightMargin,
  )
  if (!isArrowAnchorStyle(anchorStyle)) return dotLeaderAttachPoint(anchor)
  const targetCenter = referencePointForAnnotation(annotation, sections)
  return leaderAttachPoint(anchorStyle, buildAnchorArrowGeometry(anchor, targetCenter, dotRadius))
}

/**
 * Extra image-to-label gutter needed so every annotation on `side` keeps a
 * visibly distinct leader line — not just a valid (possibly ~0px) one.
 * `autoLabelX`/`autoLabelY` always sit a fixed gutter past the *image* edge,
 * while the leader only actually starts at `leaderStartForAnnotation` (past
 * the anchor for arrow/chevron styles); when a section sits close to that
 * edge, or the marker/stroke is large, that start point can land at or
 * beyond the default 14px gutter, leaving nothing for the eye to read as a
 * line between the marker and the label.
 */
function requiredGutterFor(
  items: Annotation[],
  sections: Section[],
  side: ResolvedCalloutSide,
  imageWidth: number,
  imageHeight: number,
  anchorStyle: AnchorStyleId,
  dotRadius: number,
  lineWidth: number,
  highlightMargin: number,
  baseGutter: number,
): number {
  // A round-capped stroke shorter than roughly its own width doesn't read as
  // a line — it just reads as part of the marker. Keep the reserved run
  // comfortably longer than the stroke is thick.
  const minVisibleLeader = Math.max(MIN_VISIBLE_LEADER, lineWidth * 1.5)
  let gutter = baseGutter
  for (const annotation of items) {
    const leaderStart = leaderStartForAnnotation(
      annotation,
      sections,
      side,
      imageWidth,
      imageHeight,
      anchorStyle,
      dotRadius,
      lineWidth,
      highlightMargin,
    )
    const overshoot =
      side === 'left'
        ? -leaderStart.x
        : side === 'right'
          ? leaderStart.x - imageWidth
          : side === 'top'
            ? -leaderStart.y
            : leaderStart.y - imageHeight
    gutter = Math.max(gutter, overshoot + minVisibleLeader)
  }
  return gutter
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
  const text = description ? `${prefix}${description}` : numberPrefix
  // A blank description would otherwise measure as ~0px wide, leaving nothing
  // to click/drag; size against the placeholder, but never draw it — an
  // intentionally empty label should render empty, not the literal
  // placeholder word.
  const measureText = description ? text : `${prefix}${t('callout.emptyDescription')}`
  const fontCss = fontFamilyCss(fontFamily)
  const lineHeight = lineHeightFor(fontSize)
  const textWidth =
    measureTextWidth(measureText, fontSize, fontCss, fontWeight, fontItalic) +
    labelHPadding(fontSize)
  return {
    width: Math.max(minLabelWidthFor(fontSize), Math.ceil(textWidth)),
    height: Math.max(lineHeight + labelVPadding(fontSize), Math.round(fontSize * 1.5)),
    lines: [text],
  }
}

/**
 * Text to display for an annotation in `activeVariation` — the base
 * `description` when `activeVariation` is null, otherwise that variation's
 * text (blank, not the base text, when unwritten: an empty callout signals
 * "needs writing for this variation" rather than silently showing the base
 * language/tone).
 */
export function resolveAnnotationDescription(
  annotation: Annotation,
  activeVariation: string | null,
): string {
  if (activeVariation === null) return annotation.description
  return annotation.variationText[activeVariation] ?? ''
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
  anchorStyle: AnchorStyleId,
  dotRadius: number,
  lineWidth: number,
  highlightMargin: number,
): Point {
  const section = getSectionForAnnotation(annotation, sections)
  const offset = annotation.anchorOffset
  // When the section draws its own margin-expanded outline, the anchor
  // should clear that outline's outer edge (plus its own stroke's
  // half-width), not just the raw section rect — otherwise the anchor/leader
  // would sit on top of or inside the drawn outline.
  const outlineExpand = section?.outlineEnabled ? highlightMargin + lineWidth / 2 : 0
  // The "distance from frame" setting is the empty space the user sees
  // between the section border and the marker's ink — not the distance to
  // the anchor coordinate the marker is centered on — so grow the gap by
  // however far the marker itself (and its stroke) reaches back toward the
  // box. Otherwise a large dot or arrowhead visually overlaps the section
  // it's supposedly held away from. The anchor always sits outside the
  // section border (never inset into it).
  const inset = -(
    outlineExpand +
    Math.max(0, annotation.anchorOutsideGap) +
    anchorOutsideReach(anchorStyle, dotRadius, lineWidth)
  )
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
    x: clamp(baseX + offset.x, -MAX_ANCHOR_OUTSIDE_REACH, imageWidth + MAX_ANCHOR_OUTSIDE_REACH),
    y: clamp(baseY + offset.y, -MAX_ANCHOR_OUTSIDE_REACH, imageHeight + MAX_ANCHOR_OUTSIDE_REACH),
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
  anchorStyle: AnchorStyleId,
  dotRadius: number,
  lineWidth: number,
  highlightMargin: number,
  gutter: number,
): CalloutLayoutItem[] {
  if (items.length === 0) return []

  const anchors = items.map((annotation) =>
    anchorForAnnotation(
      annotation,
      sections,
      side,
      document.imageWidth,
      document.imageHeight,
      anchorStyle,
      dotRadius,
      lineWidth,
      highlightMargin,
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
        ? imageLeft - size.width - gutter
        : imageRight + gutter

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
  anchorStyle: AnchorStyleId,
  dotRadius: number,
  lineWidth: number,
  highlightMargin: number,
  gutter: number,
): CalloutLayoutItem[] {
  if (items.length === 0) return []

  const anchors = items.map((annotation) =>
    anchorForAnnotation(
      annotation,
      sections,
      side,
      document.imageWidth,
      document.imageHeight,
      anchorStyle,
      dotRadius,
      lineWidth,
      highlightMargin,
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
        ? imageTop - size.height - gutter
        : imageBottom + gutter

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
  activeVariation: string | null,
): Array<{ width: number; height: number; lines: string[] }> {
  return items.map((annotation) =>
    estimateLabelSize(
      resolveAnnotationDescription(annotation, activeVariation),
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
  activeVariation: string | null,
): { width: number; height: number } {
  return estimateLabelSize(
    resolveAnnotationDescription(annotation, activeVariation),
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
    calloutCount > 0 ? sideMarginFor(maxLabelWidth, DEFAULT_IMAGE_GUTTER) : EMPTY_SIDE_MARGIN
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
  anchorStyle: AnchorStyleId,
  dotRadius: number,
  lineWidth: number,
  imageGutter: number,
  highlightMargin: number,
  activeVariation: string | null,
): { document: DocumentLayout; layouts: CalloutLayoutItem[] } {
  const callouts = [...annotations].sort((left, right) => left.order - right.order)
  if (callouts.length === 0) {
    return {
      document: createDefaultDocumentLayout(imageWidth, imageHeight, 0),
      layouts: [],
    }
  }

  const gap = labelGapFor(fontSize)
  const allSizes = sizesFor(callouts, fontFamily, fontSize, fontWeight, fontItalic, activeVariation)
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

  const leftMax = leftSizes.reduce((maxWidth, size) => Math.max(maxWidth, size.width), 0)
  const rightMax = rightSizes.reduce((maxWidth, size) => Math.max(maxWidth, size.width), 0)
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

  const leftGutter = requiredGutterFor(
    groups.left,
    sections,
    'left',
    imageWidth,
    imageHeight,
    anchorStyle,
    dotRadius,
    lineWidth,
    highlightMargin,
    imageGutter,
  )
  const rightGutter = requiredGutterFor(
    groups.right,
    sections,
    'right',
    imageWidth,
    imageHeight,
    anchorStyle,
    dotRadius,
    lineWidth,
    highlightMargin,
    imageGutter,
  )
  const topGutter = requiredGutterFor(
    groups.top,
    sections,
    'top',
    imageWidth,
    imageHeight,
    anchorStyle,
    dotRadius,
    lineWidth,
    highlightMargin,
    imageGutter,
  )
  const bottomGutter = requiredGutterFor(
    groups.bottom,
    sections,
    'bottom',
    imageWidth,
    imageHeight,
    anchorStyle,
    dotRadius,
    lineWidth,
    highlightMargin,
    imageGutter,
  )

  const bandTop =
    groups.top.length > 0 ? bandMarginFor(topMaxHeight, topGutter) : MIN_VERTICAL_MARGIN
  const bandBottom =
    groups.bottom.length > 0 ? bandMarginFor(bottomMaxHeight, bottomGutter) : MIN_VERTICAL_MARGIN

  const baseLeft =
    groups.left.length > 0 ? sideMarginFor(leftMax, leftGutter) : EMPTY_SIDE_MARGIN
  const baseRight =
    groups.right.length > 0 ? sideMarginFor(rightMax, rightGutter) : EMPTY_SIDE_MARGIN

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
      ...packSide(groups.left, leftSizes, sections, document, 'left', gap, anchorStyle, dotRadius, lineWidth, highlightMargin, leftGutter),
      ...packSide(groups.right, rightSizes, sections, document, 'right', gap, anchorStyle, dotRadius, lineWidth, highlightMargin, rightGutter),
      ...packBand(groups.top, topSizes, sections, document, 'top', gap, anchorStyle, dotRadius, lineWidth, highlightMargin, topGutter),
      ...packBand(groups.bottom, bottomSizes, sections, document, 'bottom', gap, anchorStyle, dotRadius, lineWidth, highlightMargin, bottomGutter),
    ],
  }
}
