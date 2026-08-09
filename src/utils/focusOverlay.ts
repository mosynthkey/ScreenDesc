import type { Annotation, Section } from '../types/annotation'

export type FocusOverlayHole =
  | { kind: 'rect'; x: number; y: number; width: number; height: number; radius: number }
  | { kind: 'circle'; x: number; y: number; radius: number }

export function buildFocusOverlayHoles(
  sections: Section[],
  annotations: Annotation[],
  highlightMargin: number,
  highlightCornerRadius: number,
  dotRadius: number,
): FocusOverlayHole[] {
  const annotationSectionIds = new Set(
    annotations
      .map((annotation) => annotation.sectionId)
      .filter((sectionId): sectionId is string => sectionId !== null),
  )
  const holes: FocusOverlayHole[] = []

  for (const section of sections) {
    const framed = section.outlineEnabled === true
    if (!framed && !annotationSectionIds.has(section.id)) continue
    const margin = framed ? highlightMargin : 0
    holes.push({
      kind: 'rect',
      x: section.rect.x - margin,
      y: section.rect.y - margin,
      width: section.rect.width + margin * 2,
      height: section.rect.height + margin * 2,
      radius: framed ? highlightCornerRadius : 4,
    })
  }

  for (const annotation of annotations) {
    if (annotation.sectionId !== null) continue
    holes.push({
      kind: 'circle',
      x: annotation.markerPosition.x,
      y: annotation.markerPosition.y,
      radius: Math.max(12, dotRadius * 2.5),
    })
  }

  return holes
}
