import type {
  Annotation,
  AnchorStyleId,
  LineStyleId,
  Section,
  SectionVisibilityCategory,
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
  lineDashLength: number
  lineDashGap: number
  lineColor: string
  dotColor: string
  dotRadius: number
  imageGutter: number
  highlightMargin: number
  highlightFillEnabled: boolean
  highlightFillOpacity: number
  highlightCornerRadius: number
  anchorStyle: AnchorStyleId
  lineHaloWidth: number
  lineHaloColor: string
  calloutFontSize: number
  calloutFontWeight: number
  calloutFontItalic: boolean
  calloutTextColor: string
  calloutBorderEnabled: boolean
  calloutFillEnabled: boolean
  calloutFillColor: string
  calloutFillOpacity: number
  calloutCornerRadius: number
  pageBackgroundColor: string
  sectionVisibility: Partial<Record<SectionVisibilityCategory, boolean>>
  /** Additional annotation-text variations beyond the base `description` (free-text names). */
  variations: string[]
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
