/**
 * Main-thread front door to the solver. Prefers a worker, and quietly falls back to
 * running the same code inline if `Worker` is missing or fails to load.
 */
import type { Face, Move } from '@turnwise/cube-solver'
import { runScramble, runSolve } from './solverCore'
import type { Effort, ScrambleResult } from './solverCore'
import type { SolverRequest, SolverResponse } from './solverTypes'

type Pending = {
  resolve: (value: never) => void
  reject: (reason: Error) => void
}

/** `Omit` over a union collapses to the shared keys, so omit distributively instead. */
type RequestBody = SolverRequest extends infer T ? (T extends SolverRequest ? Omit<T, 'id'> : never) : never

let worker: Worker | null = null
let workerBroken = false
let nextId = 1
const pending = new Map<number, Pending>()

function ensureWorker(): Worker | null {
  if (workerBroken) return null
  if (worker) return worker
  if (typeof Worker === 'undefined') {
    workerBroken = true
    return null
  }
  try {
    worker = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' })
  } catch {
    workerBroken = true
    return null
  }
  worker.onmessage = (event: MessageEvent<SolverResponse>) => {
    const response = event.data
    const entry = pending.get(response.id)
    if (!entry) return
    pending.delete(response.id)
    if (response.ok) {
      entry.resolve(response.payload as never)
    } else {
      const error = new Error(response.error.message)
      error.name = response.error.name
      entry.reject(error)
    }
  }
  worker.onerror = () => {
    workerBroken = true
    for (const [, entry] of pending) entry.reject(new Error('solver worker failed to load'))
    pending.clear()
    worker?.terminate()
    worker = null
  }
  return worker
}

function request<T>(body: RequestBody): Promise<T> {
  const active = ensureWorker()
  if (!active) return Promise.reject(new Error('worker unavailable'))
  const id = nextId++
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as Pending['resolve'], reject })
    active.postMessage({ ...body, id } as SolverRequest)
  })
}

/** Warm the solver tables on the worker so the first scramble is not the slow one. */
export function warmSolver(): void {
  void request<null>({ type: 'prepare' }).catch(() => undefined)
}

export async function solveFacelets(facelets: readonly Face[], effort: Effort = 'full'): Promise<Move[]> {
  try {
    return await request<Move[]>({ type: 'solve', facelets: [...facelets], effort })
  } catch {
    return runSolve(facelets, effort)
  }
}

export async function generateScramble(): Promise<ScrambleResult> {
  try {
    return await request<ScrambleResult>({ type: 'scramble' })
  } catch {
    return runScramble()
  }
}
