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

/** 太さ・線種のみを表す(色はlineColorで別途指定する) */
export type LineStyleId = 'thin' | 'thick' | 'dashed' | 'invert'

export interface Section {
  id: string
  rect: Rect
  kind: SectionKind
  /** ScreenParser(YOLO11)のクラス名。手動追加したセクションではundefined */
  label?: string
}

/** Only distinguish text lumps vs generic regions — no button/menu/panel taxonomy */
export type SectionKind = 'region' | 'text'

export interface Annotation {
  id: string
  sectionId: string | null
  order: number
  description: string
  /** Marker center in image coordinates */
  markerPosition: Point
  calloutSide: CalloutSide
  /** Manual override for callout label position (document coords including margin) */
  calloutPosition: Point | null
  textStyle: TextStylePreset
  /** Resolved style after auto detection */
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
  /** 折り返し済みの表示行(1行目は丸数字プレフィックス付き) */
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
  /** Google Font family(プロジェクト全体で統一) */
  defaultFontFamily: string
  /** コールアウトの引き出し線の太さ・線種(プロジェクト全体で統一) */
  lineStyle: LineStyleId
  /** 引き出し線の色(invert時は無視される) */
  lineColor: string
  /** 引き出し線の始点・終点の丸の色 */
  dotColor: string
  /** 引き出し線の始点・終点の丸の半径 */
  dotRadius: number
  /** 引き出し線に白いハロー(縁取り)を付けるか */
  lineHalo: boolean
  /** コールアウトの文字サイズ(プロジェクト全体で統一) */
  calloutFontSize: number
  /** コールアウト枠(ラベルボックス)の線の太さ。0は枠なし(プロジェクト全体で統一) */
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
