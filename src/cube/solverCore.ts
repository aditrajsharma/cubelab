/**
 * The actual solving work. Kept free of any Worker or DOM API so it can run either
 * inside the worker or, if workers are unavailable, straight on the main thread.
 */
import { cubeFromFaces, inverse, isSolved, solve } from '@turnwise/cube-solver'
import type { Face, Move } from '@turnwise/cube-solver'
import { randomFacelets } from './randomState'
import { toFaceGrid } from './state'

export type Effort = 'fast' | 'full'

/** Shortest-looking solution for the given stickers. Throws an InvalidCubeError subclass. */
export function runSolve(facelets: readonly Face[], effort: Effort = 'full'): Move[] {
  const cube = cubeFromFaces(toFaceGrid(facelets))
  return solve(cube, { effort })
}

export interface ScrambleResult {
  /** The scrambled state, ready to display. */
  readonly state: Face[]
  /** A move sequence that reaches it from solved. */
  readonly moves: Move[]
}

/**
 * A genuine WCA-style random-state scramble: pick a uniformly random legal cube, then
 * solve it and invert the solution to get the sequence that produces it.
 */
export function runScramble(): ScrambleResult {
  const state = randomFacelets()
  const cube = cubeFromFaces(toFaceGrid(state))
  const solution = solve(cube, { effort: 'full' })
  return { state, moves: inverse(solution) }
}

export function runIsSolved(facelets: readonly Face[]): boolean {
  return isSolved(cubeFromFaces(toFaceGrid(facelets)))
}
