import { buildEmbeddedFontCss } from '../googleFonts'

export async function prepareExportFontCss(fontFamily: string): Promise<string> {
  try {
    return await buildEmbeddedFontCss([fontFamily])
  } catch (error) {
    console.warn('[ScreenDesc:fonts] embed skipped', error)
    return ''
  }
}
