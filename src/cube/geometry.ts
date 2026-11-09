/**
 * The physical layout of a 3x3: which sticker sits where in space.
 *
 * Coordinates are right-handed: +x = R, +y = U, +z = F. Every cubie centre lives at
 * a coordinate in {-1, 0, 1} on each axis.
 *
 * The facelet ordering below is the one the rest of the cube world agrees on
 * (Kociemba facelet strings, @turnwise/cube-solver FaceGrid):
 *
 *   - faces are listed U, R, F, D, L, B, nine stickers each
 *   - within a face, index 0..8 is read row by row, looking straight at the face
 *   - U is read with B at the top, D is read with F at the top
 *   - R, F, L and B are read with U at the top
 *
 * Every corner and edge of that convention is asserted in `src/cube/geometry.test.ts`,
 * so do not "tidy up" these tables without running it.
 */
import { Quaternion, Vector3 } from 'three'
import type { Face } from '@turnwise/cube-solver'

export const FACES = ['U', 'R', 'F', 'D', 'L', 'B'] as const

export const FACE_INDEX: Record<Face, number> = { U: 0, R: 1, F: 2, D: 3, L: 4, B: 5 }

export const FACE_NORMAL: Record<Face, Vector3> = {
  U: new Vector3(0, 1, 0),
  R: new Vector3(1, 0, 0),
  F: new Vector3(0, 0, 1),
  D: new Vector3(0, -1, 0),
  L: new Vector3(-1, 0, 0),
  B: new Vector3(0, 0, -1),
}

/** Which axis a face's normal runs along, and in which direction. */
export const FACE_AXIS: Record<Face, { axis: 'x' | 'y' | 'z'; sign: 1 | -1 }> = {
  U: { axis: 'y', sign: 1 },
  R: { axis: 'x', sign: 1 },
  F: { axis: 'z', sign: 1 },
  D: { axis: 'y', sign: -1 },
  L: { axis: 'x', sign: -1 },
  B: { axis: 'z', sign: -1 },
}

export type Coord = readonly [number, number, number]

/** Rendering scale. Cubie centres sit on the integer lattice, so spacing is 1. */
export const SPACING = 1
export const CUBIE_SIZE = 0.95
export const STICKER_SIZE = 0.78
export const STICKER_DEPTH = 0.12
/** Distance from cubie centre to the middle of a sticker, so it sits just proud of the plastic. */
export const STICKER_OFFSET = CUBIE_SIZE / 2 - STICKER_DEPTH / 2 + 0.015
/** Bevel radius for a sticker. Must stay under half the depth or the geometry degenerates. */
export const STICKER_RADIUS = 0.05
/** Bevel radius for the plastic body of a cubie. */
export const CUBIE_RADIUS = 0.09
/** How far in front of a sticker its invisible hit target sits. */
export const HIT_OFFSET = STICKER_DEPTH / 2 + 0.01

/**
 * The cubie that owns the sticker at (face, index).
 *
 * `row` and `col` run -1 -> 1 as you read down and across the face.
 */
export function cubieCoordFor(face: Face, index: number): Coord {
  const row = Math.floor(index / 3) - 1
  const col = (index % 3) - 1
  switch (face) {
    case 'U':
      return [col, 1, row]
    case 'D':
      return [col, -1, -row]
    case 'R':
      return [1, -row, -col]
    case 'L':
      return [-1, -row, col]
    case 'F':
      return [col, -row, 1]
    case 'B':
      return [-col, -row, -1]
  }
}

export interface StickerSlot {
  /** Which face of the cube this sticker belongs to. */
  readonly face: Face
  /** 0..8, position within that face. */
  readonly index: number
  /** 0..53, position in the flat facelet array. */
  readonly facelet: number
  /** Lattice coordinate of the cubie carrying this sticker. */
  readonly cubie: Coord
  /** Outward direction the sticker points in. */
  readonly normal: Vector3
  /** World position of the sticker's centre at rest. */
  readonly position: Vector3
}

function buildStickers(): StickerSlot[] {
  const out: StickerSlot[] = []
  for (const face of FACES) {
    const normal = FACE_NORMAL[face]
    for (let index = 0; index < 9; index++) {
      const cubie = cubieCoordFor(face, index)
      const position = new Vector3(cubie[0], cubie[1], cubie[2])
        .multiplyScalar(SPACING)
        .addScaledVector(normal, STICKER_OFFSET)
      out.push({
        face,
        index,
        facelet: FACE_INDEX[face] * 9 + index,
        cubie,
        normal,
        position,
      })
    }
  }
  return out
}

/** All 54 stickers, in facelet order (U0..U8, R0..R8, ...). */
export const STICKERS: readonly StickerSlot[] = buildStickers()

/** Key for the (cubie, direction) pair that uniquely identifies a sticker. */
export function stickerKey(cubie: Coord, normal: Vector3): string {
  return `${cubie[0]},${cubie[1]},${cubie[2]}|${normal.x},${normal.y},${normal.z}`
}

export const FACELET_BY_STICKER_KEY: ReadonlyMap<string, number> = new Map(
  STICKERS.map((s) => [stickerKey(s.cubie, s.normal), s.facelet] as const),
)

/** All 27 cubie positions, ordered so that index = (x+1)*9 + (y+1)*3 + (z+1). */
export const CUBIES: readonly Coord[] = (() => {
  const out: Coord[] = []
  for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) out.push([x, y, z] as Coord)
  return out
})()

export function cubieIndex(coord: Coord): number {
  return (coord[0] + 1) * 9 + (coord[1] + 1) * 3 + (coord[2] + 1)
}

/** The stickers carried by each of the 27 cubies (1, 2 or 3 of them). */
export const STICKERS_BY_CUBIE: readonly (readonly StickerSlot[])[] = CUBIES.map((coord) =>
  STICKERS.filter(
    (s) => s.cubie[0] === coord[0] && s.cubie[1] === coord[1] && s.cubie[2] === coord[2],
  ),
)

/** Centre facelet index of each face — the only sticker that never moves. */
export const CENTER_FACELET: Record<Face, number> = {
  U: 4,
  R: 13,
  F: 22,
  D: 31,
  L: 40,
  B: 49,
}

export interface StickerPlacement {
  /** 0..53 — index into the facelet array that colours this sticker. */
  readonly facelet: number
  /** Offset from the cubie's centre. */
  readonly localPosition: Vector3
  /** Rotates a sticker lying in the XY plane so that it faces outwards. */
  readonly quaternion: Quaternion
}

const STICKER_FORWARD = new Vector3(0, 0, 1)

/**
 * Where each sticker sits on its cubie. Precomputed once: these transforms never
 * change, and handing React a stable object keeps it from resetting transforms that
 * the turn animation is driving imperatively.
 */
export const PLACEMENTS_BY_CUBIE: readonly (readonly StickerPlacement[])[] = CUBIES.map((coord) =>
  STICKERS.filter(
    (s) => s.cubie[0] === coord[0] && s.cubie[1] === coord[1] && s.cubie[2] === coord[2],
  ).map((slot) => ({
    facelet: slot.facelet,
    localPosition: slot.normal.clone().multiplyScalar(STICKER_OFFSET),
    quaternion: new Quaternion().setFromUnitVectors(STICKER_FORWARD, slot.normal),
  })),
)
