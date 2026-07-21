import type { Point, TextStylePreset } from '../types/annotation'
import { sampleLuminance } from './geometry'
import { MARKER_STROKE_WIDTH } from './markerSize'

export type ResolvedTextStyle = Exclude<TextStylePreset, 'auto'>

export const DEFAULT_LABEL_COLOR = '#0b6e4f'

export function normalizeTextStyle(style: unknown): TextStylePreset {
  if (style === 'balloon') return 'label'
  if (
    style === 'auto' ||
    style === 'white-black-stroke' ||
    style === 'black-white-stroke' ||
    style === 'semi-transparent-bg' ||
    style === 'local-invert' ||
    style === 'label'
  ) {
    return style
  }
  return 'auto'
}

export function resolveTextStyle(
  preset: TextStylePreset,
  imageData: ImageData | null,
  position: Point,
): ResolvedTextStyle {
  const normalized = normalizeTextStyle(preset)
  if (normalized !== 'auto') return normalized
  if (!imageData) return 'white-black-stroke'

  const luminance = sampleLuminance(imageData, position.x, position.y, 8)
  if (luminance > 160) return 'black-white-stroke'
  if (luminance < 90) return 'white-black-stroke'
  return 'semi-transparent-bg'
}

export interface MarkerVisualStyle {
  fill: string
  stroke: string
  strokeWidth: number
  background: string | null
  backgroundOpacity: number
  useInvert: boolean
  shape: 'circle' | 'label'
}

export function getMarkerVisualStyle(
  style: ResolvedTextStyle,
  labelColor: string = DEFAULT_LABEL_COLOR,
): MarkerVisualStyle {
  switch (style) {
    case 'white-black-stroke':
      return {
        fill: '#ffffff',
        stroke: '#111111',
        strokeWidth: MARKER_STROKE_WIDTH,
        background: null,
        backgroundOpacity: 0,
        useInvert: false,
        shape: 'circle',
      }
    case 'black-white-stroke':
      return {
        fill: '#111111',
        stroke: '#ffffff',
        strokeWidth: MARKER_STROKE_WIDTH,
        background: null,
        backgroundOpacity: 0,
        useInvert: false,
        shape: 'circle',
      }
    case 'semi-transparent-bg':
      return {
        fill: '#111111',
        stroke: 'none',
        strokeWidth: 0,
        background: '#ffffff',
        backgroundOpacity: 0.82,
        useInvert: false,
        shape: 'circle',
      }
    case 'local-invert':
      return {
        fill: '#ffffff',
        stroke: 'none',
        strokeWidth: 0,
        background: '#000000',
        backgroundOpacity: 0.55,
        useInvert: true,
        shape: 'circle',
      }
    case 'label':
      return {
        fill: '#ffffff',
        stroke: 'none',
        strokeWidth: 0,
        background: labelColor,
        backgroundOpacity: 1,
        useInvert: false,
        shape: 'label',
      }
  }
}
