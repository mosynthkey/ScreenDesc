import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'

const SITE_ROOT = 'https://mosynthkey.github.io/ScreenDesc/landing/'
const LOCALES = ['ja', 'zh', 'es', 'fr', 'de']

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function replaceElementContent(
  html: string,
  attribute: string,
  key: string,
  sourceContent: string,
  content: string,
): string {
  const opening = `(<[^>]+${attribute}="${escapeRegExp(key)}"[^>]*>)`
  if (attribute === 'data-i18n-html') {
    return html.replace(
      new RegExp(`${opening}${escapeRegExp(sourceContent)}(</[^>]+>)`),
      `$1${content}$2`,
    )
  }
  return html.replace(new RegExp(`${opening}[^<]*(</[^>]+>)`), `$1${content}$2`)
}

function replaceMetaContent(html: string, selector: string, content: string): string {
  const pattern = new RegExp(`(<meta ${selector} content=")[^"]*(" \\/>)`)
  return html.replace(pattern, `$1${content}$2`)
}

function translationsFrom(html: string): Record<string, Record<string, string>> {
  const match = html.match(/var TRANSLATIONS = (\{[\s\S]*?\n    \});/)
  if (!match) throw new Error('Landing translations were not found')
  return vm.runInNewContext(`(${match[1]})`)
}

export function renderLandingLocales(outputDirectory: string): void {
  const indexPath = join(outputDirectory, 'index.html')
  const source = readFileSync(indexPath, 'utf8')
  const translations = translationsFrom(source)

  for (const locale of LOCALES) {
    const dictionary = translations[locale]
    const pageUrl = `${SITE_ROOT}${locale}/`
    let html = source
      .replace('<html lang="en" data-page-locale="en">', `<html lang="${locale}" data-page-locale="${locale}">`)
      .replace(/<title>[^<]*<\/title>/, `<title>${dictionary.title}</title>`)
      .replace(
        '<link rel="canonical" href="https://mosynthkey.github.io/ScreenDesc/landing/" />',
        `<link rel="canonical" href="${pageUrl}" />`,
      )
      .replace(
        '<meta property="og:url" content="https://mosynthkey.github.io/ScreenDesc/landing/" />',
        `<meta property="og:url" content="${pageUrl}" />`,
      )
      .replaceAll('src="../icon.png"', 'src="../../icon.png"')
      .replaceAll("this.src='../public/icon.png'", "this.src='../../public/icon.png'")
      .replaceAll('href="../icon.png"', 'href="../../icon.png"')
      .replaceAll('"./media/', '"../media/')
      .replace('class="action-btn action-btn-primary" href="../"', 'class="action-btn action-btn-primary" href="../../"')

    html = replaceMetaContent(html, 'name="description"', dictionary.description)
    html = replaceMetaContent(html, 'property="og:title"', dictionary.title)
    html = replaceMetaContent(html, 'property="og:description"', dictionary.description)
    html = html.replace(
      '"url": "https://mosynthkey.github.io/ScreenDesc/landing/"',
      `"url": "${pageUrl}"`,
    )
    html = html.replace(
      '"description": "AI-powered screenshot annotation tool with on-device UI detection and OCR."',
      `"description": ${JSON.stringify(dictionary.description)}`,
    )

    for (const [key, content] of Object.entries(dictionary)) {
      if (key === 'title' || key === 'description') continue
      html = replaceElementContent(html, 'data-i18n', key, translations.en[key], content)
      html = replaceElementContent(html, 'data-i18n-html', key, translations.en[key], content)
    }

    const localeDirectory = join(outputDirectory, locale)
    mkdirSync(localeDirectory, { recursive: true })
    writeFileSync(join(localeDirectory, 'index.html'), html)
  }
}
