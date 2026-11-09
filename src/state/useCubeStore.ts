/**
 * Everything the app knows about the cube.
 *
 * The rule that keeps this simple: `facelets` is always what the user is looking at,
 * and the 3D scene commits a move against the store the instant it finishes animating
 * it. Nothing else writes to `facelets`.
 */
import type { Face, Move } from '@turnwise/cube-solver'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { describeCubeError } from '../cube/errors'
import { applyMoves, inverseMove } from '../cube/moves'
import { formatAlgorithm } from '../cube/notation'
import { generateScramble, solveFacelets } from '../cube/solverClient'
import { SOLVED_FACELETS, isSolvedFacelets } from '../cube/state'

export type Mode = 'play' | 'paint'
export type Phase = 'idle' | 'scrambling' | 'solving'

export interface SolveRecord {
  readonly timeMs: number
  readonly moves: number
  readonly scramble: string
  readonly at: number
}

export interface CubeStore {
  // --- the cube itself
  facelets: Face[]
  /** Moves waiting to be animated. The scene drains this one move at a time. */
  queue: Move[]
  /** Moves the user has made since the last scramble or reset. */
  history: Move[]

  // --- scramble and solution
  scramble: Move[]
  scrambleText: string
  solution: Move[]
  solutionText: string

  // --- status
  phase: Phase
  notice: string | null
  solved: boolean

  // --- settings
  mode: Mode
  paint: Face
  turnSpeed: number
  autoRotate: boolean
  effects: boolean

  // --- timer
  timerArmed: boolean
  timerStart: number | null
  timerElapsed: number
  records: SolveRecord[]

  // --- actions
  enqueue: (moves: readonly Move[]) => void
  commitMove: () => void
  reset: () => void
  undo: () => void
  newScramble: () => Promise<void>
  solveCube: () => Promise<void>
  playSolution: () => void
  stopPlayback: () => void
  setMode: (mode: Mode) => void
  setPaint: (face: Face) => void
  paintFacelet: (facelet: number) => void
  setTurnSpeed: (ms: number) => void
  setAutoRotate: (on: boolean) => void
  setEffects: (on: boolean) => void
  dismissNotice: () => void
  clearRecords: () => void
}

const NO_SOLUTION: Move[] = []

/** A half turn is worth a little more time than a quarter turn, but not twice as much. */
export function turnDuration(move: Move, speed: number): number {
  const turns = move.endsWith('2') ? 1.6 : 1
  return speed * turns
}

export const useCubeStore = create<CubeStore>()(
  persist(
    (set, get) => ({
      facelets: SOLVED_FACELETS as Face[],
      queue: [],
      history: [],

      scramble: [],
      scrambleText: '',
      solution: [],
      solutionText: '',

      phase: 'idle',
      notice: null,
      solved: true,

      mode: 'play',
      paint: 'R',
      turnSpeed: 150,
      autoRotate: true,
      effects: true,

      timerArmed: false,
      timerStart: null,
      timerElapsed: 0,
      records: [],

      enqueue: (moves) => {
        if (moves.length === 0) return
        set((state) => ({ queue: [...state.queue, ...moves] }))
      },

      commitMove: () => {
        const state = get()
        if (state.queue.length === 0) return
        const [move, ...rest] = state.queue
        const facelets = applyMoves(state.facelets, [move])
        const solved = isSolvedFacelets(facelets)
        const scrambling = state.phase === 'scrambling'

        const patch: Partial<CubeStore> = {
          queue: rest,
          facelets,
          solved,
          history: scrambling ? [] : [...state.history, move],
        }

        if (scrambling && rest.length === 0) {
          // The scramble has finished landing: from here, the first turn starts the clock.
          patch.phase = 'idle'
          patch.timerArmed = true
        }

        if (!scrambling) {
          if (state.timerArmed && !solved) {
            patch.timerStart = performance.now()
            patch.timerArmed = false
          } else if (solved && state.timerStart !== null) {
            const elapsed = performance.now() - state.timerStart
            patch.timerElapsed = elapsed
            patch.timerStart = null
            patch.records = [
              ...state.records,
              { timeMs: elapsed, moves: state.history.length + 1, scramble: state.scrambleText, at: Date.now() },
            ]
              .sort((a, b) => a.timeMs - b.timeMs)
              .slice(0, 100)
          }
          if (solved) patch.solution = NO_SOLUTION
        }

        set(patch)
      },

      reset: () =>
        set({
          facelets: SOLVED_FACELETS as Face[],
          queue: [],
          history: [],
          scramble: [],
          scrambleText: '',
          solution: [],
          solutionText: '',
          phase: 'idle',
          notice: null,
          solved: true,
          timerArmed: false,
          timerStart: null,
          timerElapsed: 0,
        }),

      undo: () => {
        const state = get()
        if (state.queue.length > 0 || state.history.length === 0 || state.phase !== 'idle') return
        const history = state.history.slice(0, -1)
        set({ history, queue: [inverseMove(state.history[state.history.length - 1])] })
      },

      newScramble: async () => {
        set({
          phase: 'scrambling',
          notice: null,
          queue: [],
          history: [],
          solution: [],
          solutionText: '',
          scramble: [],
          scrambleText: '',
          facelets: SOLVED_FACELETS as Face[],
          solved: true,
          timerArmed: false,
          timerStart: null,
          timerElapsed: 0,
        })
        const { moves } = await generateScramble()
        set({ scramble: moves, scrambleText: formatAlgorithm(moves), queue: [...moves] })
      },

      solveCube: async () => {
        const requested = get().facelets
        set({ phase: 'solving', notice: null })
        try {
          const moves = await solveFacelets(requested)
          // If the cube moved while we were thinking, the answer is already stale.
          if (get().facelets !== requested) return
          set({ solution: moves, solutionText: formatAlgorithm(moves), phase: 'idle' })
          if (moves.length === 0) set({ notice: 'This cube is already solved.' })
        } catch (error) {
          if (get().facelets !== requested) return
          set({ phase: 'idle', notice: describeCubeError(error) })
        }
      },

      playSolution: () => {
        const state = get()
        if (state.solution.length === 0) return
        set({ queue: [...state.solution], phase: 'idle' })
      },

      stopPlayback: () => set({ queue: [], phase: 'idle' }),

      setMode: (mode) => set({ mode, notice: null }),
      setPaint: (paint) => set({ paint }),

      paintFacelet: (facelet) =>
        set((state) => {
          const facelets = state.facelets.slice()
          facelets[facelet] = state.paint
          return {
            facelets,
            solved: isSolvedFacelets(facelets),
            solution: [],
            solutionText: '',
            notice: null,
          }
        }),

      setTurnSpeed: (turnSpeed) => set({ turnSpeed }),
      setAutoRotate: (autoRotate) => set({ autoRotate }),
      setEffects: (effects) => set({ effects }),
      dismissNotice: () => set({ notice: null }),
      clearRecords: () => set({ records: [] }),
    }),
    {
      name: 'cubelab',
      // Only the things worth remembering. Never the cube, the queue or the timer.
      partialize: (state) => ({
        turnSpeed: state.turnSpeed,
        autoRotate: state.autoRotate,
        effects: state.effects,
        records: state.records,
      }),
    },
  ),
)

export function selectBusy(state: CubeStore): boolean {
  return state.phase !== 'idle' || state.queue.length > 0
}
