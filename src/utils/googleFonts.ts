export type FontGroupId = 'japanese' | 'sans' | 'serif' | 'display'

export interface GoogleFontOption {
  family: string
  label: string
  /** Weights requested from Google Fonts */
  weights: number[]
  group: FontGroupId
  /** True when Google Fonts serves real italic faces (not synthetic). */
  italics?: boolean
}

export const DEFAULT_CALLOUT_FONT_WEIGHT = 700
export const DEFAULT_CALLOUT_FONT_ITALIC = false

const FONT_WEIGHT_LABEL_KEYS = {
  400: 'style.fontWeight.regular',
  500: 'style.fontWeight.medium',
  600: 'style.fontWeight.semibold',
  700: 'style.fontWeight.bold',
  800: 'style.fontWeight.extrabold',
  900: 'style.fontWeight.black',
} as const

export type FontWeightLabelKey =
  (typeof FONT_WEIGHT_LABEL_KEYS)[keyof typeof FONT_WEIGHT_LABEL_KEYS]

export function fontWeightLabelKey(weight: number): FontWeightLabelKey | null {
  return FONT_WEIGHT_LABEL_KEYS[weight as keyof typeof FONT_WEIGHT_LABEL_KEYS] ?? null
}

/** Curated Google Fonts for manuals (JP-first, plus common Latin faces). */
export const GOOGLE_FONT_OPTIONS: GoogleFontOption[] = [
  // Japanese — gothic / sans
  { family: 'Noto Sans JP', label: 'Noto Sans JP', weights: [400, 700, 900], group: 'japanese' },
  { family: 'IBM Plex Sans JP', label: 'IBM Plex Sans JP', weights: [400, 700], group: 'japanese' },
  { family: 'M PLUS 1', label: 'M PLUS 1', weights: [400, 700, 800], group: 'japanese' },
  { family: 'M PLUS 2', label: 'M PLUS 2', weights: [400, 700, 800], group: 'japanese' },
  { family: 'M PLUS 1p', label: 'M PLUS 1p', weights: [400, 700, 800], group: 'japanese' },
  { family: 'M PLUS Rounded 1c', label: 'M PLUS Rounded 1c', weights: [400, 700, 800], group: 'japanese' },
  { family: 'Zen Kaku Gothic New', label: 'Zen Kaku Gothic New', weights: [400, 700, 900], group: 'japanese' },
  { family: 'Zen Maru Gothic', label: 'Zen Maru Gothic', weights: [400, 700, 900], group: 'japanese' },
  { family: 'BIZ UDPGothic', label: 'BIZ UDPGothic', weights: [400, 700], group: 'japanese' },
  { family: 'BIZ UDGothic', label: 'BIZ UDGothic', weights: [400, 700], group: 'japanese' },
  { family: 'Kosugi', label: 'Kosugi', weights: [400], group: 'japanese' },
  { family: 'Kosugi Maru', label: 'Kosugi Maru', weights: [400], group: 'japanese' },
  { family: 'Sawarabi Gothic', label: 'Sawarabi Gothic', weights: [400], group: 'japanese' },
  { family: 'Kiwi Maru', label: 'Kiwi Maru', weights: [400, 500], group: 'japanese' },
  { family: 'Klee One', label: 'Klee One', weights: [400, 600], group: 'japanese' },
  // Japanese — mincho / serif
  { family: 'Noto Serif JP', label: 'Noto Serif JP', weights: [400, 700, 900], group: 'japanese' },
  { family: 'Shippori Mincho', label: 'Shippori Mincho', weights: [400, 700], group: 'japanese' },
  { family: 'Shippori Antique', label: 'Shippori Antique', weights: [400], group: 'japanese' },
  { family: 'Shippori Antique B1', label: 'Shippori Antique B1', weights: [400], group: 'japanese' },
  { family: 'Sawarabi Mincho', label: 'Sawarabi Mincho', weights: [400], group: 'japanese' },
  { family: 'BIZ UDPMincho', label: 'BIZ UDPMincho', weights: [400], group: 'japanese' },
  { family: 'BIZ UDMincho', label: 'BIZ UDMincho', weights: [400], group: 'japanese' },
  { family: 'Zen Old Mincho', label: 'Zen Old Mincho', weights: [400, 700, 900], group: 'japanese' },
  { family: 'Zen Antique', label: 'Zen Antique', weights: [400], group: 'japanese' },
  { family: 'Zen Antique Soft', label: 'Zen Antique Soft', weights: [400], group: 'japanese' },
  { family: 'Kaisei Decol', label: 'Kaisei Decol', weights: [400, 700], group: 'japanese' },
  { family: 'Kaisei Opti', label: 'Kaisei Opti', weights: [400, 700], group: 'japanese' },
  { family: 'Kaisei Tokumin', label: 'Kaisei Tokumin', weights: [400, 700], group: 'japanese' },
  { family: 'New Tegomin', label: 'New Tegomin', weights: [400], group: 'japanese' },
  { family: 'Yuji Syuku', label: 'Yuji Syuku', weights: [400], group: 'japanese' },
  { family: 'Yuji Mai', label: 'Yuji Mai', weights: [400], group: 'japanese' },
  { family: 'Yuji Boku', label: 'Yuji Boku', weights: [400], group: 'japanese' },
  // Japanese — display / decorative
  { family: 'Dela Gothic One', label: 'Dela Gothic One', weights: [400], group: 'display' },
  { family: 'RocknRoll One', label: 'RocknRoll One', weights: [400], group: 'display' },
  { family: 'Reggae One', label: 'Reggae One', weights: [400], group: 'display' },
  { family: 'Rampart One', label: 'Rampart One', weights: [400], group: 'display' },
  { family: 'Train One', label: 'Train One', weights: [400], group: 'display' },
  { family: 'Potta One', label: 'Potta One', weights: [400], group: 'display' },
  { family: 'Hachi Maru Pop', label: 'Hachi Maru Pop', weights: [400], group: 'display' },
  { family: 'Stick', label: 'Stick', weights: [400], group: 'display' },
  { family: 'DotGothic16', label: 'DotGothic16', weights: [400], group: 'display' },
  { family: 'Zen Kurenaido', label: 'Zen Kurenaido', weights: [400], group: 'display' },
  // Latin — sans
  { family: 'Inter', label: 'Inter', weights: [400, 700], group: 'sans', italics: true },
  { family: 'Roboto', label: 'Roboto', weights: [400, 700], group: 'sans', italics: true },
  { family: 'Open Sans', label: 'Open Sans', weights: [400, 700], group: 'sans', italics: true },
  { family: 'Source Sans 3', label: 'Source Sans 3', weights: [400, 700], group: 'sans', italics: true },
  { family: 'Nunito Sans', label: 'Nunito Sans', weights: [400, 700], group: 'sans', italics: true },
  { family: 'Lato', label: 'Lato', weights: [400, 700], group: 'sans', italics: true },
  { family: 'Montserrat', label: 'Montserrat', weights: [400, 700], group: 'sans', italics: true },
  { family: 'Poppins', label: 'Poppins', weights: [400, 700], group: 'sans', italics: true },
  { family: 'Work Sans', label: 'Work Sans', weights: [400, 700], group: 'sans', italics: true },
  { family: 'IBM Plex Sans', label: 'IBM Plex Sans', weights: [400, 700], group: 'sans', italics: true },
  { family: 'Noto Sans', label: 'Noto Sans', weights: [400, 700], group: 'sans', italics: true },
  // Latin — serif
  { family: 'Merriweather', label: 'Merriweather', weights: [400, 700], group: 'serif', italics: true },
  { family: 'Libre Baskerville', label: 'Libre Baskerville', weights: [400, 700], group: 'serif', italics: true },
  { family: 'Playfair Display', label: 'Playfair Display', weights: [400, 700], group: 'serif', italics: true },
  { family: 'Lora', label: 'Lora', weights: [400, 700], group: 'serif', italics: true },
  { family: 'Noto Serif', label: 'Noto Serif', weights: [400, 700], group: 'serif', italics: true },
  { family: 'Source Serif 4', label: 'Source Serif 4', weights: [400, 700], group: 'serif', italics: true },
  // Latin — display
  { family: 'Oswald', label: 'Oswald', weights: [400, 700], group: 'display' },
  { family: 'Bebas Neue', label: 'Bebas Neue', weights: [400], group: 'display' },
  { family: 'Righteous', label: 'Righteous', weights: [400], group: 'display' },
]

export const FONT_GROUP_ORDER: FontGroupId[] = ['japanese', 'sans', 'serif', 'display']

export const DEFAULT_FONT_FAMILY = GOOGLE_FONT_OPTIONS[0]!.family

const loadedFamilies = new Set<string>()

export function findGoogleFont(family: string): GoogleFontOption | undefined {
  return GOOGLE_FONT_OPTIONS.find((option) => option.family === family)
}

export function fontsByGroup(): Array<{ group: FontGroupId; fonts: GoogleFontOption[] }> {
  return FONT_GROUP_ORDER.map((group) => ({
    group,
    fonts: GOOGLE_FONT_OPTIONS.filter((option) => option.group === group),
  })).filter((entry) => entry.fonts.length > 0)
}

export function fontFamilyCss(family: string): string {
  const option = findGoogleFont(family)
  const fallback = option?.group === 'serif' ? 'serif' : 'sans-serif'
  return `'${family}', 'Noto Sans JP', ${fallback}`
}

export function availableFontWeights(family: string): number[] {
  return findGoogleFont(family)?.weights ?? [400, 700]
}

export function nearestFontWeight(family: string, desired: number): number {
  const weights = availableFontWeights(family)
  let best = weights[0]!
  for (const weight of weights) {
    if (Math.abs(weight - desired) < Math.abs(best - desired)) best = weight
  }
  return best
}

export function normalizeCalloutFontWeight(value: unknown, family: string): number {
  const desired =
    typeof value === 'number' && Number.isFinite(value)
      ? Math.round(value)
      : DEFAULT_CALLOUT_FONT_WEIGHT
  return nearestFontWeight(family, desired)
}

export function normalizeCalloutFontItalic(value: unknown): boolean {
  return typeof value === 'boolean' ? value : DEFAULT_CALLOUT_FONT_ITALIC
}

/** Canvas / CSS font shorthand matching callout text style. */
export function canvasFont(
  weight: number,
  italic: boolean,
  sizePx: number,
  familyCss: string,
): string {
  return `${italic ? 'italic' : 'normal'} ${weight} ${sizePx}px ${familyCss}`
}

export function googleFontsCssUrl(
  family: string,
  weights: number[],
  options?: { italics?: boolean },
): string {
  const familyParam = family.trim().replace(/\s+/g, '+')
  const uniqueWeights = [...new Set(weights)].sort((left, right) => left - right)
  if (options?.italics) {
    const pairs = uniqueWeights
      .flatMap((weight) => [`0,${weight}`, `1,${weight}`])
      .join(';')
    return `https://fonts.googleapis.com/css2?family=${familyParam}:ital,wght@${pairs}&display=swap`
  }
  const weightParam = uniqueWeights.join(';')
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
  link.href = googleFontsCssUrl(option.family, option.weights, {
    italics: option.italics === true,
  })
  document.head.appendChild(link)
  loadedFamilies.add(option.family)
}

/** Prefetch every curated face (e.g. when opening the font picker). */
export function loadAllGoogleFonts(): void {
  for (const option of GOOGLE_FONT_OPTIONS) {
    loadGoogleFont(option.family)
  }
}

export async function ensureGoogleFontsLoaded(
  families: string[],
  options?: { italic?: boolean },
): Promise<void> {
  const unique = [...new Set(families.filter(Boolean))]
  for (const family of unique) {
    loadGoogleFont(family)
  }

  if (!('fonts' in document)) return

  const italic = options?.italic === true
  await Promise.all(
    unique.map(async (family) => {
      const option = findGoogleFont(family)
      const weights = option?.weights ?? [400, 700]
      const styles = italic && option?.italics ? (['normal', 'italic'] as const) : (['normal'] as const)
      await Promise.all(
        styles.flatMap((style) =>
          weights.map((weight) =>
            document.fonts
              .load(`${style} ${weight} 48px "${family}"`)
              .catch(() => undefined),
          ),
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
      group: 'sans' as const,
      italics: false,
    }
    const cssUrl = googleFontsCssUrl(option.family, option.weights, {
      italics: option.italics === true,
    })
    const response = await fetch(cssUrl)
    if (!response.ok) {
      console.warn(`[ScreenDesc:fonts] CSS fetch failed for ${family}`)
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
          console.warn(`[ScreenDesc:fonts] embed failed for ${rawUrl}`, error)
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
