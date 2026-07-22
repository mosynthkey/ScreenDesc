import type {
  Annotation,
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
  lineOpacity: number
  dotColor: string
  dotRadius: number
  lineHaloWidth: number
  lineHaloColor: string
  calloutFontSize: number
  calloutBorderWidth: number
  fontFamily: string
}

export interface Exporter {
  readonly format: ExportOptions['format']
  export(scene: ExportScene): Promise<Blob>
}
