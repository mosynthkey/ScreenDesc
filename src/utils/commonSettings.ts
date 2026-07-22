import type { AnchorStyleId, LineStyleId, NumberStyleId } from '../types/annotation'
import { DEFAULT_ANCHOR_STYLE, normalizeAnchorStyle } from './anchorStyle'
import { DEFAULT_FONT_FAMILY } from './googleFonts'
import {
  DEFAULT_LINE_HALO_COLOR,
  DEFAULT_LINE_HALO_WIDTH,
  DEFAULT_LINE_WIDTH,
  normalizeLineHaloColor,
  normalizeLineHaloWidth,
  normalizeLineStyle,
} from './lineStyle'
import {
  CALLOUT_FONT_SIZE,
  CALLOUT_FONT_SIZE_MAX,
  CALLOUT_FONT_SIZE_MIN,
  DOT_RADIUS_MAX,
  DOT_RADIUS_MIN,
} from './markerSize'
import { DEFAULT_NUMBER_STYLE, isNumberStyleId } from './circledNumbers'

const STORAGE_KEY = 'screendesc.commonSettingsPresets'

export const DEFAULT_CALLOUT_FILL_COLOR = '#ffffff'
export const DEFAULT_CALLOUT_FILL_OPACITY = 1
export const CALLOUT_FILL_OPACITY_MIN = 0
export const CALLOUT_FILL_OPACITY_MAX = 1
export const DEFAULT_PAGE_BACKGROUND_COLOR = '#ffffff'

export interface CommonSettings {
  defaultFontFamily: string
  lineStyle: LineStyleId
  lineWidth: number
  lineColor: string
  dotRadius: number
  anchorStyle: AnchorStyleId
  lineHaloWidth: number
  lineHaloColor: string
  calloutFontSize: number
  calloutBorderEnabled: boolean
  calloutFillEnabled: boolean
  calloutFillColor: string
  /** 0–1 */
  calloutFillOpacity: number
  pageBackgroundColor: string
  numberStyle: NumberStyleId
}

export interface CommonSettingsPresetMeta {
  id: string
  name: string
  updatedAt: number
}

export interface CommonSettingsPreset extends CommonSettingsPresetMeta {
  settings: CommonSettings
}

export function createDefaultCommonSettings(): CommonSettings {
  return {
    defaultFontFamily: DEFAULT_FONT_FAMILY,
    lineStyle: 'solid',
    lineWidth: DEFAULT_LINE_WIDTH,
    lineColor: '#ffd60a',
    dotRadius: 4.5,
    anchorStyle: DEFAULT_ANCHOR_STYLE,
    lineHaloWidth: DEFAULT_LINE_HALO_WIDTH,
    lineHaloColor: DEFAULT_LINE_HALO_COLOR,
    calloutFontSize: CALLOUT_FONT_SIZE,
    calloutBorderEnabled: false,
    calloutFillEnabled: true,
    calloutFillColor: DEFAULT_CALLOUT_FILL_COLOR,
    calloutFillOpacity: DEFAULT_CALLOUT_FILL_OPACITY,
    pageBackgroundColor: DEFAULT_PAGE_BACKGROUND_COLOR,
    numberStyle: DEFAULT_NUMBER_STYLE,
  }
}

export function resolveCalloutBorderWidth(
  enabled: boolean,
  lineWidth: number,
): number {
  return enabled ? lineWidth : 0
}

export function normalizeCalloutBorderEnabled(enabled: unknown): boolean {
  return typeof enabled === 'boolean' ? enabled : false
}

export function normalizeCalloutFillEnabled(value: unknown): boolean {
  return typeof value === 'boolean' ? value : true
}

export function normalizeCalloutFillColor(value: unknown): string {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase()
  }
  return DEFAULT_CALLOUT_FILL_COLOR
}

export function normalizePageBackgroundColor(value: unknown): string {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase()
  }
  return DEFAULT_PAGE_BACKGROUND_COLOR
}

export function normalizeCalloutFillOpacity(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.min(CALLOUT_FILL_OPACITY_MAX, Math.max(CALLOUT_FILL_OPACITY_MIN, value))
  }
  return DEFAULT_CALLOUT_FILL_OPACITY
}

export function resolveCalloutFill(
  enabled: boolean,
  color: string,
  opacity: number,
): { fill: string; fillOpacity: number } {
  if (!enabled) return { fill: 'none', fillOpacity: 1 }
  return {
    fill: normalizeCalloutFillColor(color),
    fillOpacity: normalizeCalloutFillOpacity(opacity),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function normalizeCommonSettings(raw: unknown): CommonSettings | null {
  if (!isRecord(raw)) return null

  const defaults = createDefaultCommonSettings()
  const normalizedLine = normalizeLineStyle(
    typeof raw.lineStyle === 'string' ? raw.lineStyle : defaults.lineStyle,
    typeof raw.lineWidth === 'number' ? raw.lineWidth : defaults.lineWidth,
  )

  const fontFamily =
    typeof raw.defaultFontFamily === 'string' && raw.defaultFontFamily.trim()
      ? raw.defaultFontFamily
      : defaults.defaultFontFamily
  const lineColor =
    typeof raw.lineColor === 'string' && raw.lineColor.trim()
      ? raw.lineColor
      : defaults.lineColor
  const dotRadius =
    typeof raw.dotRadius === 'number' && Number.isFinite(raw.dotRadius)
      ? Math.min(DOT_RADIUS_MAX, Math.max(DOT_RADIUS_MIN, raw.dotRadius))
      : defaults.dotRadius
  const calloutFontSize =
    typeof raw.calloutFontSize === 'number' && Number.isFinite(raw.calloutFontSize)
      ? Math.min(CALLOUT_FONT_SIZE_MAX, Math.max(CALLOUT_FONT_SIZE_MIN, raw.calloutFontSize))
      : defaults.calloutFontSize
  const numberStyle = isNumberStyleId(raw.numberStyle) ? raw.numberStyle : defaults.numberStyle

  return {
    defaultFontFamily: fontFamily,
    lineStyle: normalizedLine.lineStyle,
    lineWidth: normalizedLine.lineWidth,
    lineColor,
    dotRadius,
    anchorStyle: normalizeAnchorStyle(raw.anchorStyle),
    lineHaloWidth: normalizeLineHaloWidth(raw.lineHaloWidth),
    lineHaloColor: normalizeLineHaloColor(raw.lineHaloColor),
    calloutFontSize,
    calloutBorderEnabled: normalizeCalloutBorderEnabled(raw.calloutBorderEnabled),
    calloutFillEnabled: normalizeCalloutFillEnabled(raw.calloutFillEnabled),
    calloutFillColor: normalizeCalloutFillColor(raw.calloutFillColor),
    calloutFillOpacity: normalizeCalloutFillOpacity(raw.calloutFillOpacity),
    pageBackgroundColor: normalizePageBackgroundColor(raw.pageBackgroundColor),
    numberStyle,
  }
}

function readAllPresets(): CommonSettingsPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    const presets: CommonSettingsPreset[] = []
    for (const entry of parsed) {
      if (!isRecord(entry)) continue
      if (typeof entry.id !== 'string' || typeof entry.name !== 'string') continue
      if (typeof entry.updatedAt !== 'number') continue
      const settings = normalizeCommonSettings(entry.settings)
      if (!settings) continue
      presets.push({
        id: entry.id,
        name: entry.name,
        updatedAt: entry.updatedAt,
        settings,
      })
    }
    return presets.sort((left, right) => right.updatedAt - left.updatedAt)
  } catch {
    return []
  }
}

function writeAllPresets(presets: CommonSettingsPreset[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
}

export function listCommonSettingsPresets(): CommonSettingsPresetMeta[] {
  return readAllPresets().map(({ id, name, updatedAt }) => ({ id, name, updatedAt }))
}

export function loadCommonSettingsPreset(id: string): CommonSettingsPreset | null {
  return readAllPresets().find((preset) => preset.id === id) ?? null
}

export function saveCommonSettingsPreset(
  name: string,
  settings: CommonSettings,
  id?: string,
): string {
  const normalized = normalizeCommonSettings(settings)
  if (!normalized) throw new Error('Invalid common settings')

  const presets = readAllPresets()
  const presetId = id ?? crypto.randomUUID()
  const next: CommonSettingsPreset = {
    id: presetId,
    name: name.trim() || 'Settings',
    updatedAt: Date.now(),
    settings: normalized,
  }

  const existingIndex = presets.findIndex((preset) => preset.id === presetId)
  if (existingIndex >= 0) presets[existingIndex] = next
  else presets.unshift(next)

  writeAllPresets(presets)
  return presetId
}

export function deleteCommonSettingsPreset(id: string): void {
  writeAllPresets(readAllPresets().filter((preset) => preset.id !== id))
}
