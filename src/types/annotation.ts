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

export type AnchorStyleId = 'dot' | 'arrow' | 'chevron' | 'none'

export interface Section {
  id: string
  rect: Rect
  kind: SectionKind
  /** ScreenParser class name; unset for manually drawn sections. */
  label?: string
  /** When true, draw a margin-expanded outline (+ optional fill) around this section. */
  outlineEnabled?: boolean
  /** When true (and `outlineEnabled`), also draw the shared line-halo edging around the outline. */
  outlineHaloEnabled?: boolean
}

/** Text lumps vs generic regions — no button/menu/panel taxonomy. */
export type SectionKind = 'region' | 'text'

export interface Annotation {
  id: string
  sectionId: string | null
  order: number
  /** Base/default variation text. Always present. */
  description: string
  /** Per-variation override text, keyed by an entry in `ProjectState.variations`. Missing/empty means not yet written for that variation. */
  variationText: Record<string, string>
  /** Step number text (e.g. "①"), shown before the description. Set via the "Number" utility. */
  numberPrefix: string
  /** Anchor point in image coordinates (leader start). */
  markerPosition: Point
  calloutSide: CalloutSide
  /** Manual override for callout label position (document coords including margin). */
  calloutPosition: Point | null
  /** Extra X/Y shift of the anchor from its default position (image coords). */
  anchorOffset: Point
  /** Distance in px from the section border (the anchor always sits outside it). */
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
  /** Figma-style adjustable crop rectangle (image-local coords) while `toolMode` is `'crop'`. */
  cropDraft: Rect | null
  defaultFontFamily: string
  lineStyle: LineStyleId
  /** Leader stroke width in px (also used for dashed / invert). */
  lineWidth: number
  /** Ignored when `lineStyle` is `invert`. */
  lineColor: string
  dotColor: string
  dotRadius: number
  /** Baseline distance in px between the image edge and a callout label. */
  imageGutter: number
  /** How far a section's outline (see `Section.outlineEnabled`) expands beyond its raw rect. */
  highlightMargin: number
  /** When true, the outline's interior uses `lineColor` at `highlightFillOpacity`. */
  highlightFillEnabled: boolean
  /** Outline fill opacity (0–1). */
  highlightFillOpacity: number
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
  /** Additional annotation-text variations beyond the base `description` (free-text names, e.g. "English", "Casual"). */
  variations: string[]
  /** Currently displayed/edited variation; `null` means the base `description`. */
  activeVariation: string | null
}

export type ExportFormat = 'png' | 'svg'

export interface ExportOptions {
  format: ExportFormat
  includeSectionGuides: boolean
  scale: number
  filename: string
}
