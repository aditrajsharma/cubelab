/** The cube's state as a flat array of 54 face letters, plus conversions to and from the solver. */
import type { Face, FaceGrid } from '@turnwise/cube-solver'
import { FACES } from './geometry'
import { applyMoves } from './moves'
import type { Move } from '@turnwise/cube-solver'

/** A brand new cube. Facelet i belongs to face FACES[floor(i / 9)]. */
export const SOLVED_FACELETS: readonly Face[] = (() => {
  const out: Face[] = []
  for (const face of FACES) for (let i = 0; i < 9; i++) out.push(face)
  return out
})()

export function toFaceGrid(facelets: readonly Face[]): FaceGrid {
  // The compiler cannot prove that nine arbitrary face letters have the right letter at
  // position 4, so each face is asserted. `cubeFromFaces` re-checks it at runtime.
  return {
    U: facelets.slice(0, 9) as unknown as FaceGrid['U'],
    R: facelets.slice(9, 18) as unknown as FaceGrid['R'],
    F: facelets.slice(18, 27) as unknown as FaceGrid['F'],
    D: facelets.slice(27, 36) as unknown as FaceGrid['D'],
    L: facelets.slice(36, 45) as unknown as FaceGrid['L'],
    B: facelets.slice(45, 54) as unknown as FaceGrid['B'],
  }
}

export function fromFaceGrid(grid: FaceGrid): Face[] {
  return [...grid.U, ...grid.R, ...grid.F, ...grid.D, ...grid.L, ...grid.B]
}

export function isSolvedFacelets(facelets: readonly Face[]): boolean {
  for (let f = 0; f < 6; f++) {
    const face = FACES[f]
    for (let i = 0; i < 9; i++) {
      if (facelets[f * 9 + i] !== face) return false
    }
  }
  return true
}

/** How many stickers of each colour are showing. A legal cube has nine of each. */
export function stickerCounts(facelets: readonly Face[]): Record<Face, number> {
  const counts = { U: 0, R: 0, F: 0, D: 0, L: 0, B: 0 } as Record<Face, number>
  for (const sticker of facelets) counts[sticker]++
  return counts
}

/** Convenience for previews and tests: the state you get by applying moves to a solved cube. */
export function faceletsAfter(moves: readonly Move[]): Face[] {
  return applyMoves(SOLVED_FACELETS, moves)
}
