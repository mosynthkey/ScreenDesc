import type { Point, TextStylePreset } from '../types/annotation'
import { sampleLuminance } from './geometry'
import { MARKER_STROKE_WIDTH } from './markerSize'

export type ResolvedTextStyle = Exclude<TextStylePreset, 'auto'>

export function resolveTextStyle(
  preset: TextStylePreset,
  imageData: ImageData | null,
  position: Point,
): ResolvedTextStyle {
  if (preset !== 'auto') return preset
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
  shape: 'circle' | 'balloon' | 'label'
}

export function getMarkerVisualStyle(style: ResolvedTextStyle): MarkerVisualStyle {
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
    case 'balloon':
      return {
        fill: '#111111',
        stroke: '#111111',
        strokeWidth: 1.5,
        background: '#ffffff',
        backgroundOpacity: 0.96,
        useInvert: false,
        shape: 'balloon',
      }
    case 'label':
      return {
        fill: '#ffffff',
        stroke: 'none',
        strokeWidth: 0,
        background: '#0b6e4f',
        backgroundOpacity: 1,
        useInvert: false,
        shape: 'label',
      }
  }
}

