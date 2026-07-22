import type {
  Annotation,
  AnchorStyleId,
  CalloutLayoutItem,
  DocumentLayout,
  ExportOptions,
  LineStyleId,
  Section,
} from '../../types/annotation'

export interface ExportScene {
  image: HTMLImageElement
  sections: Section[]
  annotations: Annotation[]
  calloutLayouts: CalloutLayoutItem[]
  document: DocumentLayout
  options: ExportOptions
  lineStyle: LineStyleId
  lineWidth: number
  lineColor: string
  dotColor: string
  dotRadius: number
  anchorStyle: AnchorStyleId
  lineHaloWidth: number
  lineHaloColor: string
  calloutFontSize: number
  calloutBorderWidth: number
  calloutFillEnabled: boolean
  calloutFillColor: string
  calloutFillOpacity: number
  fontFamily: string
}

export interface Exporter {
  readonly format: ExportOptions['format']
  export(scene: ExportScene): Promise<Blob>
}
