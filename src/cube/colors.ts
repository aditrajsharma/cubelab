import type { Face } from '@turnwise/cube-solver'

export interface FaceTheme {
  readonly face: Face
  readonly name: string
  /** Sticker colour. */
  readonly hex: string
  /** Slightly brighter copy used for glow, text and UI swatches. */
  readonly glow: string
}

export const FACE_THEME: Record<Face, FaceTheme> = {
  U: { face: 'U', name: 'White', hex: '#f2f3f5', glow: '#ffffff' },
  R: { face: 'R', name: 'Red', hex: '#d92b2b', glow: '#ff5a52' },
  F: { face: 'F', name: 'Green', hex: '#12a150', glow: '#2ee08a' },
  D: { face: 'D', name: 'Yellow', hex: '#f2c313', glow: '#ffe257' },
  L: { face: 'L', name: 'Orange', hex: '#f2761b', glow: '#ffa04d' },
  B: { face: 'B', name: 'Blue', hex: '#1565d8', glow: '#4d9bff' },
}

/** Sticker colour per facelet, ready to hand to a material. */
export function faceletsToColors(facelets: readonly Face[]): string[] {
  return facelets.map((face) => FACE_THEME[face].hex)
}

export const PALETTE_ORDER: readonly Face[] = ['U', 'R', 'F', 'D', 'L', 'B']
