import type {
  Annotation,
  AnnotationMode,
  CalloutLayoutItem,
  DocumentLayout,
  ExportOptions,
  LineStyleId,
  NumberStyleId,
  Section,
} from '../../types/annotation'

export interface ExportScene {
  image: HTMLImageElement
  sections: Section[]
  annotations: Annotation[]
  calloutLayouts: CalloutLayoutItem[]
  document: DocumentLayout
  options: ExportOptions
  annotationMode: AnnotationMode
  lineStyle: LineStyleId
  lineWidth: number
  lineColor: string
  dotColor: string
  dotRadius: number
  lineHalo: boolean
  calloutFontSize: number
  calloutBorderWidth: number
  numberStyle: NumberStyleId
  labelColor: string
  fontFamily: string
}

export interface Exporter {
  readonly format: ExportOptions['format']
  export(scene: ExportScene): Promise<Blob>
}
