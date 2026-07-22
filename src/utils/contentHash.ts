/** SHA-256 hex fingerprint for portable project identity (not for security). */

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortKeysDeep(entry))
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(record).sort()) {
      sorted[key] = sortKeysDeep(record[key])
    }
    return sorted
  }
  return value
}

export async function sha256Hex(data: BufferSource): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

/**
 * Content fingerprint of a project file payload.
 * Excludes `contentHash` itself so the field can be stored alongside the bytes.
 */
export async function computeProjectContentHash(project: {
  version: number
  imageDataUrl: string
  [key: string]: unknown
}): Promise<string> {
  const { contentHash: _ignored, ...payload } = project
  const canonical = JSON.stringify(sortKeysDeep(payload))
  return sha256Hex(new TextEncoder().encode(canonical))
}

export function isContentHash(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
}
