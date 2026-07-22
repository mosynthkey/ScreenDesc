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

export type CalloutSide = 'left' | 'right' | 'auto'

export type ToolMode = 'select' | 'add-section' | 'annotate' | 'crop'

/** Line pattern only; stroke weight is `lineWidth`. */
export type LineStyleId = 'solid' | 'dashed' | 'invert'

export type NumberStyleId =
  | 'circled'
  | 'paren'
  | 'dotted'
  | 'paren-suffix'
  | 'plain'
  | 'none'

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
  /** Anchor point in image coordinates (leader start). */
  markerPosition: Point
  calloutSide: CalloutSide
  /** Manual override for callout label position (document coords including margin). */
  calloutPosition: Point | null
}

export interface CalloutLayoutItem {
  annotationId: string
  side: 'left' | 'right'
  labelPosition: Point
  anchorPoint: Point
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
  /** Leader stroke opacity (0–1). Does not affect the anchor dot. */
  lineOpacity: number
  dotColor: string
  dotRadius: number
  /** Extra outline underlay width in px (0 = none). */
  lineHaloWidth: number
  lineHaloColor: string
  calloutFontSize: number
  /** Label box stroke width; 0 = no border. */
  calloutBorderWidth: number
  /** Project-wide step number style (① / (1) / …). */
  numberStyle: NumberStyleId
  showSections: boolean
  calloutLayouts: CalloutLayoutItem[]
  document: DocumentLayout
}

export type ExportFormat = 'png' | 'svg' | 'pdf'

export interface ExportOptions {
  format: ExportFormat
  includeSectionGuides: boolean
  includeOriginal: boolean
  scale: number
  filename: string
}
