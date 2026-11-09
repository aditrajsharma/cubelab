/**
 * Uniform random-state generation.
 *
 * Picking twenty random moves is not the same thing as picking a random cube: it
 * badly under-represents the states that need long solutions. Instead we build the
 * state directly on the piece level — a random corner arrangement, a random edge
 * arrangement, random twists and flips — and then throw away the handful of
 * arrangements no real cube can reach:
 *
 *   - corner twists sum to a whole number of turns (mod 3)
 *   - edge flips sum to a whole number of flips (mod 2)
 *   - corner permutation parity matches edge permutation parity
 */
import type { Face } from '@turnwise/cube-solver'
import { CENTER_FACELET, FACES } from './geometry'

/** Corner positions in table order, and the three facelets each one shows. */
const CORNER_FACELETS: readonly (readonly [number, number, number])[] = [
  [8, 9, 20], // URF
  [6, 18, 38], // UFL
  [0, 36, 47], // ULB
  [2, 45, 11], // UBR
  [29, 26, 15], // DFR
  [27, 44, 24], // DLF
  [33, 53, 42], // DBL
  [35, 17, 51], // DRB
]

/** The home colours of each corner piece, in the same cyclic order as the facelets above. */
const CORNER_COLOURS: readonly (readonly [Face, Face, Face])[] = [
  ['U', 'R', 'F'],
  ['U', 'F', 'L'],
  ['U', 'L', 'B'],
  ['U', 'B', 'R'],
  ['D', 'F', 'R'],
  ['D', 'L', 'F'],
  ['D', 'B', 'L'],
  ['D', 'R', 'B'],
]

const EDGE_FACELETS: readonly (readonly [number, number])[] = [
  [5, 10], // UR
  [7, 19], // UF
  [3, 37], // UL
  [1, 46], // UB
  [32, 16], // DR
  [28, 25], // DF
  [30, 43], // DL
  [34, 52], // DB
  [23, 12], // FR
  [21, 41], // FL
  [50, 39], // BL
  [48, 14], // BR
]

const EDGE_COLOURS: readonly (readonly [Face, Face])[] = [
  ['U', 'R'],
  ['U', 'F'],
  ['U', 'L'],
  ['U', 'B'],
  ['D', 'R'],
  ['D', 'F'],
  ['D', 'L'],
  ['D', 'B'],
  ['F', 'R'],
  ['F', 'L'],
  ['B', 'L'],
  ['B', 'R'],
]

function randomInt(bound: number): number {
  return Math.floor(Math.random() * bound)
}

function shuffled(length: number): number[] {
  const out = Array.from({ length }, (_, i) => i)
  for (let i = length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** 0 for an even permutation, 1 for an odd one. */
function permutationParity(permutation: readonly number[]): 0 | 1 {
  const seen = new Array<boolean>(permutation.length).fill(false)
  let parity = 0
  for (let start = 0; start < permutation.length; start++) {
    if (seen[start]) continue
    let length = 0
    let at = start
    while (!seen[at]) {
      seen[at] = true
      at = permutation[at]
      length++
    }
    parity ^= (length - 1) & 1
  }
  return parity as 0 | 1
}

/** A uniformly random legal cube, as 54 face letters. */
export function randomFacelets(): Face[] {
  const corners = shuffled(8)
  const edges = shuffled(12)

  // Two corners swapped is an odd permutation; so is two edges swapped. Fix the mismatch.
  if (permutationParity(corners) !== permutationParity(edges)) {
    ;[edges[0], edges[1]] = [edges[1], edges[0]]
  }

  const cornerTwists = Array.from({ length: 8 }, () => randomInt(3))
  const twistSum = cornerTwists.slice(0, 7).reduce((a, b) => a + b, 0)
  cornerTwists[7] = (3 - (twistSum % 3)) % 3

  const edgeFlips = Array.from({ length: 12 }, () => randomInt(2))
  const flipSum = edgeFlips.slice(0, 11).reduce((a, b) => a + b, 0)
  edgeFlips[11] = (2 - (flipSum % 2)) % 2

  const facelets = new Array<Face>(54)

  for (let position = 0; position < 8; position++) {
    const piece = CORNER_COLOURS[corners[position]]
    const slots = CORNER_FACELETS[position]
    const twist = cornerTwists[position]
    for (let j = 0; j < 3; j++) facelets[slots[(j + twist) % 3]] = piece[j]
  }

  for (let position = 0; position < 12; position++) {
    const piece = EDGE_COLOURS[edges[position]]
    const slots = EDGE_FACELETS[position]
    const flip = edgeFlips[position]
    for (let j = 0; j < 2; j++) facelets[slots[(j + flip) % 2]] = piece[j]
  }

  for (const face of FACES) facelets[CENTER_FACELET[face]] = face

  return facelets
}
