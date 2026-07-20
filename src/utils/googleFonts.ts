export interface GoogleFontOption {
  family: string
  label: string
  /** Weights requested from Google Fonts */
  weights: number[]
}

/** Curated Google Fonts with Japanese coverage for manuals */
export const GOOGLE_FONT_OPTIONS: GoogleFontOption[] = [
  { family: 'Noto Sans JP', label: 'Noto Sans JP', weights: [400, 700, 900] },
  { family: 'Noto Serif JP', label: 'Noto Serif JP', weights: [400, 700, 900] },
  { family: 'IBM Plex Sans JP', label: 'IBM Plex Sans JP', weights: [400, 700] },
  { family: 'M PLUS 1', label: 'M PLUS 1', weights: [400, 700, 800] },
  { family: 'M PLUS Rounded 1c', label: 'M PLUS Rounded 1c', weights: [400, 700, 800] },
  { family: 'Zen Kaku Gothic New', label: 'Zen Kaku Gothic New', weights: [400, 700, 900] },
  { family: 'Zen Maru Gothic', label: 'Zen Maru Gothic', weights: [400, 700, 900] },
  { family: 'Kosugi Maru', label: 'Kosugi Maru', weights: [400] },
  { family: 'Sawarabi Gothic', label: 'Sawarabi Gothic', weights: [400] },
  { family: 'Shippori Mincho', label: 'Shippori Mincho', weights: [400, 700] },
  { family: 'Dela Gothic One', label: 'Dela Gothic One', weights: [400] },
]

export const DEFAULT_FONT_FAMILY = GOOGLE_FONT_OPTIONS[0]!.family

const loadedFamilies = new Set<string>()

export function findGoogleFont(family: string): GoogleFontOption | undefined {
  return GOOGLE_FONT_OPTIONS.find((option) => option.family === family)
}

export function fontFamilyCss(family: string): string {
  return `'${family}', 'Noto Sans JP', sans-serif`
}

export function googleFontsCssUrl(family: string, weights: number[]): string {
  const familyParam = family.trim().replace(/\s+/g, '+')
  const weightParam = [...new Set(weights)].sort((left, right) => left - right).join(';')
  return `https://fonts.googleapis.com/css2?family=${familyParam}:wght@${weightParam}&display=swap`
}

/** Inject a stylesheet link so the font can render in the live canvas / UI. */
export function loadGoogleFont(family: string): void {
  const option = findGoogleFont(family)
  if (!option) return
  if (loadedFamilies.has(option.family)) return

  const linkId = `google-font-${option.family.replace(/\s+/g, '-')}`
  if (document.getElementById(linkId)) {
    loadedFamilies.add(option.family)
    return
  }

  const link = document.createElement('link')
  link.id = linkId
  link.rel = 'stylesheet'
  link.href = googleFontsCssUrl(option.family, option.weights)
  document.head.appendChild(link)
  loadedFamilies.add(option.family)
}

export async function ensureGoogleFontsLoaded(families: string[]): Promise<void> {
  const unique = [...new Set(families.filter(Boolean))]
  for (const family of unique) {
    loadGoogleFont(family)
  }

  if (!('fonts' in document)) return

  await Promise.all(
    unique.map(async (family) => {
      const option = findGoogleFont(family)
      const weights = option?.weights ?? [400, 700]
      await Promise.all(
        weights.map((weight) =>
          document.fonts.load(`${weight} 48px "${family}"`).catch(() => undefined),
        ),
      )
    }),
  )
}

async function fetchFontAsDataUri(fontUrl: string): Promise<string> {
  const response = await fetch(fontUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch font file: ${fontUrl}`)
  }
  const buffer = await response.arrayBuffer()
  const contentType = response.headers.get('content-type') || 'font/woff2'
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let byteIndex = 0; byteIndex < bytes.length; byteIndex += 1) {
    binary += String.fromCharCode(bytes[byteIndex]!)
  }
  return `data:${contentType};base64,${btoa(binary)}`
}

/**
 * Build @font-face CSS with base64-embedded files so PNG/SVG export
 * does not depend on network access at rasterize time.
 */
export async function buildEmbeddedFontCss(families: string[]): Promise<string> {
  const unique = [...new Set(families.filter(Boolean))]
  const chunks: string[] = []

  for (const family of unique) {
    const option = findGoogleFont(family) ?? {
      family,
      label: family,
      weights: [400, 700, 800],
    }
    const cssUrl = googleFontsCssUrl(option.family, option.weights)
    const response = await fetch(cssUrl)
    if (!response.ok) {
      console.warn(`[ImageDesc:fonts] CSS fetch failed for ${family}`)
      continue
    }

    let css = await response.text()
    const urlMatches = [...css.matchAll(/url\((?:["']?)([^"')]+)(?:["']?)\)/g)]
    const replacements = new Map<string, string>()

    await Promise.all(
      urlMatches.map(async (match) => {
        const rawUrl = match[1]
        if (!rawUrl || replacements.has(rawUrl)) return
        try {
          const absoluteUrl = new URL(rawUrl, cssUrl).href
          replacements.set(rawUrl, await fetchFontAsDataUri(absoluteUrl))
        } catch (error) {
          console.warn(`[ImageDesc:fonts] embed failed for ${rawUrl}`, error)
        }
      }),
    )

    for (const [rawUrl, dataUri] of replacements) {
      css = css.replaceAll(rawUrl, dataUri)
    }
    chunks.push(css)
  }

  return chunks.join('\n')
}
