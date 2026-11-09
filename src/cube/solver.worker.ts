/// <reference lib="webworker" />
/**
 * Solving happens here so that building Kociemba's tables and searching for a
 * solution never blocks a cube animation mid-turn.
 */
import { prepare } from '@turnwise/cube-solver'
import { runScramble, runSolve } from './solverCore'
import type { SolverRequest, SolverResponse } from './solverTypes'

const ctx = globalThis as unknown as {
  onmessage: ((event: MessageEvent<SolverRequest>) => void) | null
  postMessage: (message: SolverResponse) => void
}

function fail(id: number, error: unknown) {
  const { name, message } = error instanceof Error ? error : new Error(String(error))
  ctx.postMessage({ id, ok: false, error: { name, message } })
}

ctx.onmessage = (event: MessageEvent<SolverRequest>) => {
  const request = event.data
  try {
    switch (request.type) {
      case 'prepare':
        prepare()
        ctx.postMessage({ id: request.id, ok: true, payload: null })
        return
      case 'solve':
        ctx.postMessage({ id: request.id, ok: true, payload: runSolve(request.facelets, request.effort) })
        return
      case 'scramble':
        ctx.postMessage({ id: request.id, ok: true, payload: runScramble() })
        return
    }
  } catch (error) {
    fail(request.id, error)
  }
}
