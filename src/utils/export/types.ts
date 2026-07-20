import type {
  Annotation,
  AnnotationMode,
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
  annotationMode: AnnotationMode
  lineStyle: LineStyleId
  lineColor: string
  dotColor: string
  dotRadius: number
  lineHalo: boolean
  calloutFontSize: number
  calloutBorderWidth: number
  fontFamily: string
}

export interface Exporter {
  readonly format: ExportOptions['format']
  export(scene: ExportScene): Promise<Blob>
}
