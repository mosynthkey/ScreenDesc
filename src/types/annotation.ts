export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export type CalloutSide = 'left' | 'right' | 'top' | 'bottom' | 'auto'

export type ToolMode = 'select' | 'add-section' | 'annotate' | 'crop'

/** Line pattern only; stroke weight is `lineWidth`. */
export type LineStyleId = 'solid' | 'dashed' | 'invert'

export type AnchorStyleId = 'dot' | 'arrow' | 'chevron'

export interface Section {
  id: string
  rect: Rect
  kind: SectionKind
  /** ScreenParser class name; unset for manually drawn sections. */
  label?: string
}

/** Text lumps vs generic regions — no button/menu/panel taxonomy. */
export type SectionKind = 'region' | 'text'

export interface Annotation {
  id: string
  sectionId: string | null
  order: number
  description: string
  /** Step number text (e.g. "①"), shown before the description. Set via the "Number" utility. */
  numberPrefix: string
  /** Anchor point in image coordinates (leader start). */
  markerPosition: Point
  calloutSide: CalloutSide
  /** Manual override for callout label position (document coords including margin). */
  calloutPosition: Point | null
  /** Extra X/Y shift of the anchor from its default position (image coords). */
  anchorOffset: Point
  /** When true, the anchor sits outside the section border instead of inside it. */
  anchorOutside: boolean
  /** Distance in px from the section border when `anchorOutside` is true. */
  anchorOutsideGap: number
}

export interface CalloutLayoutItem {
  annotationId: string
  side: 'left' | 'right' | 'top' | 'bottom'
  labelPosition: Point
  anchorPoint: Point
  /** Section center (or marker position) in document coords — the arrow points here. */
  targetCenter: Point
  elbowPoint: Point
  labelWidth: number
  labelHeight: number
  /** Wrapped display lines (first line includes circled number prefix). */
  lines: string[]
}

export interface DocumentLayout {
  imageWidth: number
  imageHeight: number
  marginLeft: number
  marginRight: number
  marginTop: number
  marginBottom: number
}

export interface ProjectState {
  imageUrl: string | null
  imageWidth: number
  imageHeight: number
  sections: Section[]
  annotations: Annotation[]
  selectedSectionIds: string[]
  selectedAnnotationIds: string[]
  toolMode: ToolMode
  defaultFontFamily: string
  lineStyle: LineStyleId
  /** Leader stroke width in px (also used for dashed / invert). */
  lineWidth: number
  /** Ignored when `lineStyle` is `invert`. */
  lineColor: string
  dotColor: string
  dotRadius: number
  /** Marker at the leader start: filled dot, filled arrow, or open chevron. */
  anchorStyle: AnchorStyleId
  /** Extra outline underlay width in px (0 = none). */
  lineHaloWidth: number
  lineHaloColor: string
  calloutFontSize: number
  /** Numeric CSS font-weight for callout labels (clamped to the face’s available weights). */
  calloutFontWeight: number
  calloutFontItalic: boolean
  /** When true, label box stroke uses `lineWidth`. */
  calloutBorderEnabled: boolean
  /** When true, label box uses `calloutFillColor` / `calloutFillOpacity`. */
  calloutFillEnabled: boolean
  calloutFillColor: string
  /** Label background opacity (0–1). */
  calloutFillOpacity: number
  /** Page / export canvas color behind the screenshot and margins. */
  pageBackgroundColor: string
  showSections: boolean
  calloutLayouts: CalloutLayoutItem[]
  document: DocumentLayout
}

export type ExportFormat = 'png' | 'svg'

export interface ExportOptions {
  format: ExportFormat
  includeSectionGuides: boolean
  includeOriginal: boolean
  scale: number
  filename: string
}
