/** Reading and writing cube notation. */
import type { Face, Move } from '@turnwise/cube-solver'
import { ALL_MOVES, faceOf, moveOf, turnsOf } from './moves'
import type { Turn } from './moves'

const TURN_SUFFIX: Record<Turn, string> = { 1: '', 2: '2', 3: "'" }

export function formatMove(move: Move): string {
  return `${faceOf(move)}${TURN_SUFFIX[turnsOf(move)]}`
}

export function formatAlgorithm(moves: readonly Move[]): string {
  return moves.map(formatMove).join(' ')
}

const TOKEN = /^([URFDLB])([2']?|2|3|_PRIME|PRIME|i)$/i

/**
 * Parse notation typed by a human. Accepts the usual variants: `R`, `R2`, `R'`, `R’`,
 * `Ri`, `r` — with any whitespace or commas between moves. Wide moves (`r`, `M`) are
 * rejected rather than silently reinterpreted, because this cube only does face turns.
 */
export function parseAlgorithm(input: string): { moves: Move[]; error?: string } {
  const moves: Move[] = []
  const tokens = input
    .replace(/[’′‘]/g, "'")
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean)

  for (const token of tokens) {
    const match = TOKEN.exec(token)
    if (!match) return { moves, error: `“${token}” is not a move I understand` }
    const raw = match[1].toUpperCase() as Face
    const suffix = match[2].toUpperCase()
    const turn: Turn = suffix === '2' ? 2 : suffix === "'" || suffix === '_PRIME' || suffix === 'PRIME' || suffix === 'I' ? 3 : 1
    moves.push(moveOf(raw, turn))
  }
  return { moves }
}

export function isMove(value: string): value is Move {
  return (ALL_MOVES as readonly string[]).includes(value)
}
