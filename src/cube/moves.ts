/**
 * Move mechanics: how a notation symbol maps to a rotation in space, and how that
 * rotation shuffles the 54 facelets.
 *
 * A clockwise turn is defined the way the notation means it: looking straight at the
 * face from outside the cube. That is a *negative* right-handed rotation about the
 * face's outward normal, which is the detail every implementation gets wrong once.
 */
import type { Face, Move } from '@turnwise/cube-solver'
import { Quaternion, Vector3 } from 'three'
import { CUBIES, FACE_AXIS, FACE_NORMAL, FACES, FACELET_BY_STICKER_KEY, STICKERS, stickerKey } from './geometry'
import type { Coord } from './geometry'

export type Turn = 1 | 2 | 3

/** Every move, in a stable order. */
export const ALL_MOVES: readonly Move[] = FACES.flatMap((face) => [
  face as Move,
  `${face}2` as Move,
  `${face}_PRIME` as Move,
])

export function moveOf(face: Face, turn: Turn): Move {
  if (turn === 1) return face as Move
  if (turn === 2) return `${face}2` as Move
  return `${face}_PRIME` as Move
}

export function faceOf(move: Move): Face {
  return move[0] as Face
}

export function turnsOf(move: Move): Turn {
  if (move.endsWith('2')) return 2
  if (move.endsWith('_PRIME')) return 3
  return 1
}

export function inverseMove(move: Move): Move {
  const turn = turnsOf(move)
  return moveOf(faceOf(move), turn === 2 ? 2 : ((4 - turn) as Turn))
}

export interface MoveGeometry {
  readonly move: Move
  readonly face: Face
  /** Unit vector along the rotation axis: the face's outward normal. */
  readonly axis: Vector3
  /** Signed angle in radians. Negative = clockwise seen from outside. */
  readonly angle: number
  /** The lattice axis the moving layer is selected on. */
  readonly layerAxis: 'x' | 'y' | 'z'
  /** The coordinate on `layerAxis` shared by every cubie in the moving layer. */
  readonly layerValue: 1 | -1
}

const HALF_PI = Math.PI / 2

function buildMoveGeometry(): Record<string, MoveGeometry> {
  const out: Record<string, MoveGeometry> = {}
  for (const face of FACES) {
    const { axis, sign } = FACE_AXIS[face]
    for (const turn of [1, 2, 3] as Turn[]) {
      const move = moveOf(face, turn)
      out[move] = {
        move,
        face,
        axis: FACE_NORMAL[face].clone(),
        angle: -turn * HALF_PI,
        layerAxis: axis,
        layerValue: sign,
      }
    }
  }
  return out
}

export const MOVE_GEOMETRY: Record<Move, MoveGeometry> = buildMoveGeometry() as Record<Move, MoveGeometry>

/** Rotate a lattice vector by one of the 18 face turns. Angles are 90° multiples, so we snap. */
function rotateLattice(v: Vector3, axis: Vector3, angle: number): Vector3 {
  const q = new Quaternion().setFromAxisAngle(axis, angle)
  return v.clone().applyQuaternion(q).round()
}

/**
 * For each move, the facelet permutation: `MOVE_PERM[move][destination] = source`.
 *
 * Derived from the geometry rather than hand-written, so it cannot drift out of sync
 * with the layout in `geometry.ts`.
 */
function buildPermutations(): Record<string, Uint8Array> {
  const out: Record<string, Uint8Array> = {}
  for (const move of ALL_MOVES) {
    const { axis, angle, layerAxis, layerValue } = MOVE_GEOMETRY[move]
    const component = layerAxis === 'x' ? 0 : layerAxis === 'y' ? 1 : 2
    const perm = new Uint8Array(54)
    for (const slot of STICKERS) {
      // Only the nine stickers on the turning layer move; the rest stay put.
      if (slot.cubie[component] !== layerValue) {
        perm[slot.facelet] = slot.facelet
        continue
      }
      const cubie = new Vector3(slot.cubie[0], slot.cubie[1], slot.cubie[2])
      const rotatedCubie = rotateLattice(cubie, axis, angle)
      const rotatedNormal = rotateLattice(slot.normal.clone(), axis, angle)
      const key = stickerKey([rotatedCubie.x, rotatedCubie.y, rotatedCubie.z] as Coord, rotatedNormal)
      const destination = FACELET_BY_STICKER_KEY.get(key)
      if (destination === undefined) {
        throw new Error(`Move ${move} sent facelet ${slot.facelet} somewhere that is not a sticker`)
      }
      perm[destination] = slot.facelet
    }
    out[move] = perm
  }
  return out
}

export const MOVE_PERM: Record<Move, Uint8Array> = buildPermutations() as Record<Move, Uint8Array>

/** Apply one move to a flat 54-entry facelet array. */
export function applyMove(facelets: readonly Face[], move: Move): Face[] {
  const perm = MOVE_PERM[move]
  const out = new Array<Face>(54)
  for (let d = 0; d < 54; d++) out[d] = facelets[perm[d]]
  return out
}

export function applyMoves(facelets: readonly Face[], moves: readonly Move[]): Face[] {
  let current = facelets as Face[]
  for (const move of moves) current = applyMove(current, move)
  return current
}

/** Indices into `CUBIES` of the nine cubies that a given move turns. */
export function layerIndices(move: Move): number[] {
  const { layerAxis, layerValue } = MOVE_GEOMETRY[move]
  const component = layerAxis === 'x' ? 0 : layerAxis === 'y' ? 1 : 2
  const out: number[] = []
  CUBIES.forEach((coord, index) => {
    if (coord[component] === layerValue) out.push(index)
  })
  return out
}

/** The face whose outward normal best matches `v`, or null for a vector off the axes. */
export function faceFromNormal(v: Vector3): Face | null {
  for (const face of FACES) {
    if (FACE_NORMAL[face].dot(v) > 0.9) return face
  }
  return null
}

/**
 * Turn a raw rotation — an axis and a quarter-turn count — into notation.
 *
 * `layerValue` is the coordinate of the turning layer along `axis`, so the same
 * rotation means different things depending on which layer it grabs.
 */
export function moveFromRotation(axis: Vector3, layerValue: number, quarterTurns: number): Move | null {
  if (layerValue === 0) return null
  const sign = layerValue > 0 ? 1 : -1
  const face = faceFromNormal(axis.clone().multiplyScalar(sign))
  if (!face) return null
  // Clockwise for `face` is -90° about its normal; we are turning +90° about `axis`.
  const clockwise = (((-quarterTurns * layerValue) % 4) + 4) % 4
  if (clockwise === 0) return null
  return moveOf(face, clockwise as Turn)
}

/**
 * Which base move a drag describes.
 *
 * `normal` is the face being dragged, `direction` the in-plane drag direction, both
 * unit vectors in cube space. Dragging along `d` on a face with normal `n` spins the
 * layer about `n x d`, and the layer involved is the one the grabbed cubie sits in.
 */
export function moveFromDrag(normal: Vector3, direction: Vector3, cubie: Coord): Move | null {
  const axis = new Vector3().crossVectors(normal, direction).round()
  if (axis.lengthSq() < 0.5) return null
  const layerValue = Math.round(axis.x * cubie[0] + axis.y * cubie[1] + axis.z * cubie[2])
  return moveFromRotation(axis, layerValue, 1)
}

/** The two lattice directions a sticker on `normal` can be dragged along. */
export function dragAxes(normal: Vector3): Vector3[] {
  const axes = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)]
  return axes.filter((a) => Math.abs(a.dot(normal)) < 0.5)
}
