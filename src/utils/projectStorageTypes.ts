import type {
  Annotation,
  AnchorStyleId,
  LineStyleId,
  Section,
} from '../types/annotation'
import type { OcrLineHit } from './ocr'

export interface ProjectSnapshot {
  imageBlob: Blob
  imageWidth: number
  imageHeight: number
  sections: Section[]
  annotations: Annotation[]
  ocrLines: OcrLineHit[]
  defaultFontFamily: string
  lineStyle: LineStyleId
  lineWidth: number
  lineColor: string
  dotColor: string
  dotRadius: number
  imageGutter: number
  anchorStyle: AnchorStyleId
  lineHaloWidth: number
  lineHaloColor: string
  calloutFontSize: number
  calloutFontWeight: number
  calloutFontItalic: boolean
  calloutBorderEnabled: boolean
  calloutFillEnabled: boolean
  calloutFillColor: string
  calloutFillOpacity: number
  pageBackgroundColor: string
  showSections: boolean
  /** When set, edits auto-overwrite this named save. */
  activeNamedProjectId?: string | null
  activeNamedProjectName?: string | null
}

export interface SavedProjectMeta {
  id: string
  name: string
  updatedAt: number
  /** SHA-256 hex matching portable project contentHash. */
  contentHash?: string
}
