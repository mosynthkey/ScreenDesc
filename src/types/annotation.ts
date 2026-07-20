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

export type AnnotationMode = 'inline' | 'callout'

export type TextStylePreset =
  | 'auto'
  | 'white-black-stroke'
  | 'black-white-stroke'
  | 'semi-transparent-bg'
  | 'local-invert'
  | 'balloon'
  | 'label'

export type CalloutSide = 'left' | 'right' | 'auto'

export type ToolMode = 'select' | 'add-section' | 'annotate' | 'crop'

/** Stroke weight / dash only; color is `lineColor`. */
export type LineStyleId = 'thin' | 'thick' | 'dashed' | 'invert'

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
  /** Marker center in image coordinates. */
  markerPosition: Point
  calloutSide: CalloutSide
  /** Manual override for callout label position (document coords including margin). */
  calloutPosition: Point | null
  textStyle: TextStylePreset
  /** Resolved style after auto detection. */
  resolvedStyle: Exclude<TextStylePreset, 'auto'>
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
  defaultAnnotationMode: AnnotationMode
  defaultTextStyle: TextStylePreset
  defaultFontFamily: string
  lineStyle: LineStyleId
  /** Ignored when `lineStyle` is `invert`. */
  lineColor: string
  dotColor: string
  dotRadius: number
  lineHalo: boolean
  calloutFontSize: number
  /** Label box stroke width; 0 = no border. */
  calloutBorderWidth: number
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
