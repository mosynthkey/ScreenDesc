import type { ProjectSnapshot } from './projectStorageTypes'

export function buildProjectSearchText(
  snapshot: Pick<ProjectSnapshot, 'annotations'>,
): string {
  return snapshot.annotations
    .flatMap((annotation) => [
      annotation.description,
      ...Object.values(annotation.variationText ?? {}),
    ])
    .filter(Boolean)
    .join('\n')
}
