import type { Face, Move } from '@turnwise/cube-solver'
import type { Effort, ScrambleResult } from './solverCore'

export type SolverRequest =
  | { readonly id: number; readonly type: 'prepare' }
  | { readonly id: number; readonly type: 'solve'; readonly facelets: readonly Face[]; readonly effort?: Effort }
  | { readonly id: number; readonly type: 'scramble' }

export type SolverResponse =
  | { readonly id: number; readonly ok: true; readonly payload: Move[] | ScrambleResult | null }
  | { readonly id: number; readonly ok: false; readonly error: { readonly name: string; readonly message: string } }
