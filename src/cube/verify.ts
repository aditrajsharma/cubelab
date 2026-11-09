/**
 * Self-check for the cube engine. Run with:
 *
 *   npx rolldown src/cube/verify.ts --format esm --file /tmp/verify.mjs --platform node && node /tmp/verify.mjs
 *
 * Everything here is checked against @turnwise/cube-solver, which is the source of
 * truth for facelet order and for what counts as a legal cube.
 */
import { cubeFromFaces, cubeFromMoves, facesFromCube, solve } from '@turnwise/cube-solver'
import type { Face, Move } from '@turnwise/cube-solver'
import { Quaternion, Vector3 } from 'three'
import { CENTER_FACELET, CUBIES, FACES, FACE_NORMAL, STICKERS } from './geometry'
import type { StickerSlot } from './geometry'
import { ALL_MOVES, MOVE_GEOMETRY, applyMoves, dragAxes, inverseMove, moveFromDrag } from './moves'
import { randomFacelets } from './randomState'
import { SOLVED_FACELETS, fromFaceGrid, isSolvedFacelets, toFaceGrid } from './state'
import { runScramble, runSolve } from './solverCore'

let failures = 0
let checks = 0

function check(name: string, condition: boolean, detail = ''): void {
  checks++
  if (!condition) {
    failures++
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function section(name: string): void {
  console.log(`\n${name}`)
}

function same(a: readonly Face[], b: readonly Face[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

function key(facelets: readonly Face[]): string {
  return facelets.join('')
}

// ---------------------------------------------------------------------------
section('1. Geometry: 54 stickers, correctly attached to 27 cubies')

{
  const byCubie = new Map<string, StickerSlot[]>()
  for (const slot of STICKERS) {
    const k = slot.cubie.join(',')
    const list: StickerSlot[] = byCubie.get(k) ?? []
    list.push(slot)
    byCubie.set(k, list)
  }
  check('54 stickers total', STICKERS.length === 54, `got ${STICKERS.length}`)
  check('27 cubie positions', CUBIES.length === 27)

  let total = 0
  for (const coord of CUBIES) {
    const slots = byCubie.get(coord.join(',')) ?? []
    total += slots.length
    const onSurface = coord.filter((c) => c !== 0).length
    check(
      `cubie ${coord.join(',')} carries ${onSurface} stickers`,
      slots.length === onSurface,
      `got ${slots.length}`,
    )
    // A cubie never shows two stickers facing the same way.
    const normals = new Set(slots.map((s) => s.normal.toArray().join(',')))
    check(`cubie ${coord.join(',')} has distinct face directions`, normals.size === slots.length)
  }
  check('every sticker belongs to a cubie', total === 54, `got ${total}`)

  for (const face of FACES) {
    const centre = STICKERS.find((s) => s.face === face && s.index === 4)
    check(
      `${face} centre faces the right way`,
      !!centre && centre.normal.dot(FACE_NORMAL[face]) === 1,
    )
    check(`${face} centre facelet index`, CENTER_FACELET[face] === FACES.indexOf(face) * 9 + 4)
  }

  // The three stickers meeting at a corner must sit on one cubie and point three ways.
  const corners: [number, number, number][] = [
    [0, 36, 47], // ULB
    [2, 45, 11], // UBR
    [6, 18, 38], // UFL
    [8, 9, 20], // URF
    [27, 44, 24], // DLF
    [29, 26, 15], // DFR
    [33, 53, 42], // DBL
    [35, 17, 51], // DRB
  ]
  for (const [a, b, c] of corners) {
    const slots = [STICKERS[a], STICKERS[b], STICKERS[c]]
    const shared = slots.every((s) => s.cubie.join(',') === slots[0].cubie.join(','))
    check(`corner facelets ${a}/${b}/${c} meet at one cubie`, shared, slots.map((s) => s.cubie.join(',')).join(' '))
    const basis = slots.map((s) => s.normal)
    check(
      `corner facelets ${a}/${b}/${c} point three ways`,
      basis[0].dot(basis[1]) === 0 && basis[1].dot(basis[2]) === 0 && basis[0].dot(basis[2]) === 0,
    )
  }

  const edges: [number, number][] = [
    [5, 10], [7, 19], [3, 37], [1, 46],
    [32, 16], [28, 25], [30, 43], [34, 52],
    [23, 12], [21, 41], [50, 39], [48, 14],
  ]
  for (const [a, b] of edges) {
    check(
      `edge facelets ${a}/${b} meet at one cubie`,
      STICKERS[a].cubie.join(',') === STICKERS[b].cubie.join(','),
      `${STICKERS[a].cubie} vs ${STICKERS[b].cubie}`,
    )
  }
}

// ---------------------------------------------------------------------------
section('2. Move permutations agree with the solver library')

{
  let compared = 0
  for (const move of ALL_MOVES) {
    const mine = key(applyMoves(SOLVED_FACELETS, [move]))
    const theirs = key(fromFaceGrid(facesFromCube(cubeFromMoves([move]))))
    check(`${move} permutes facelets like the library`, mine === theirs)
    compared++
  }
  check('all 18 moves compared', compared === 18)

  const randomMove = () => ALL_MOVES[Math.floor(Math.random() * ALL_MOVES.length)]
  let mismatches = 0
  for (let trial = 0; trial < 400; trial++) {
    const length = 1 + Math.floor(Math.random() * 12)
    const sequence: Move[] = Array.from({ length }, randomMove)
    const mine = key(applyMoves(SOLVED_FACELETS, sequence))
    const theirs = key(fromFaceGrid(facesFromCube(cubeFromMoves(sequence))))
    if (mine !== theirs) mismatches++
  }
  check('400 random sequences agree with the library', mismatches === 0, `${mismatches} mismatched`)

  let inverseFailures = 0
  for (const move of ALL_MOVES) {
    if (!same(applyMoves(SOLVED_FACELETS, [move, inverseMove(move)]), SOLVED_FACELETS)) inverseFailures++
  }
  check('every move followed by its inverse is a no-op', inverseFailures === 0)
}

// ---------------------------------------------------------------------------
section('3. Random states are legal cubes')

{
  let rejected = 0
  for (let trial = 0; trial < 400; trial++) {
    try {
      cubeFromFaces(toFaceGrid(randomFacelets()))
    } catch {
      rejected++
    }
  }
  check('400 random states accepted by the validator', rejected === 0, `${rejected} rejected`)

  // Nine of each colour, centres at home.
  let colourFailures = 0
  for (let trial = 0; trial < 50; trial++) {
    const state = randomFacelets()
    const counts = new Map<Face, number>()
    for (const sticker of state) counts.set(sticker, (counts.get(sticker) ?? 0) + 1)
    if ([...counts.values()].some((n) => n !== 9)) colourFailures++
    for (const face of FACES) if (state[CENTER_FACELET[face]] !== face) colourFailures++
  }
  check('random states have nine of each colour and fixed centres', colourFailures === 0)
}

// ---------------------------------------------------------------------------
section('4. Scrambles and solutions actually work')

{
  let scrambleFailures = 0
  let solveFailures = 0
  let longest = 0
  const lengths: number[] = []

  for (let trial = 0; trial < 40; trial++) {
    const { state, moves } = runScramble()
    if (!same(applyMoves(SOLVED_FACELETS, moves), state)) scrambleFailures++
    if (isSolvedFacelets(state)) scrambleFailures++
    lengths.push(moves.length)

    const solution = runSolve(state)
    if (solution.length > longest) longest = solution.length
    const finished = applyMoves(state, solution)
    if (!isSolvedFacelets(finished)) solveFailures++
  }

  check('40 scrambles reach exactly the state they claim', scrambleFailures === 0)
  check('40 solutions solve their cube', solveFailures === 0)
  const average = lengths.reduce((a, b) => a + b, 0) / lengths.length
  console.log(`  scramble length: avg ${average.toFixed(1)}, range ${Math.min(...lengths)}-${Math.max(...lengths)}`)
  console.log(`  longest solution found: ${longest} moves`)
  check('scramble lengths look like random state (14-24)', Math.min(...lengths) >= 14 && Math.max(...lengths) <= 24)

  // A solved cube needs no moves at all.
  check('a solved cube solves to nothing', runSolve(SOLVED_FACELETS).length === 0)
  check('a single move solves in one move', runSolve(applyMoves(SOLVED_FACELETS, ["R" as Move])).length === 1)
}

// ---------------------------------------------------------------------------
section('5. Illegal cubes are rejected with a useful reason')

{
  const reasons: string[] = []
  const swap = (s: Face[], a: number, b: number) => { const t = s[a]; s[a] = s[b]; s[b] = t }
  const cases: [string, Face[]][] = [
    // Flip the UF edge in place: its two stickers trade places, colour counts unchanged.
    ['one edge flipped', (() => { const s = SOLVED_FACELETS.slice(); swap(s, 7, 19); return s })()],
    // Twist the URF corner: a 3-cycle of its stickers, colour counts unchanged.
    ['one corner twisted', (() => { const s = SOLVED_FACELETS.slice(); s[8] = 'R'; s[9] = 'F'; s[20] = 'U'; return s })()],
    // Trade the URF and UFL corners wholesale: every piece present, but two of them swapped.
    ['two corners swapped', (() => { const s = SOLVED_FACELETS.slice(); swap(s, 8, 6); swap(s, 9, 18); swap(s, 20, 38); return s })()],
    ['a sticker recoloured', (() => { const s = SOLVED_FACELETS.slice(); s[0] = 'D'; return s })()],
  ]
  for (const [label, state] of cases) {
    try {
      cubeFromFaces(toFaceGrid(state))
      reasons.push(`${label}: NOT rejected`)
    } catch (error) {
      reasons.push(`${label}: ${(error as Error).name}`)
      check(`${label} is rejected`, true)
    }
  }
  console.log(`  ${reasons.join('\n  ')}`)
  check('every broken cube was caught', !reasons.some((r) => r.includes('NOT rejected')))
  check('a flipped edge is named as one', reasons[0].includes('EdgeFlip'), reasons[0])
  check('a twisted corner is named as one', reasons[1].includes('CornerTwist'), reasons[1])
  check('swapped pieces are named as a parity problem', reasons[2].includes('Parity'), reasons[2])
}

// ---------------------------------------------------------------------------
section('6. Dragging a sticker produces the move a hand would')

{
  let unsupported = 0
  let wrong = 0
  let checked = 0

  for (const slot of STICKERS) {
    const normal = slot.normal
    const axes = dragAxes(normal)
    if (axes.length !== 2) {
      wrong++
      continue
    }
    for (const axis of axes) {
      for (const sign of [1, -1]) {
        const direction = axis.clone().multiplyScalar(sign)
        const move = moveFromDrag(normal, direction, slot.cubie)
        if (!move) {
          unsupported++
          continue
        }
        checked++
        // Turning that move must carry the grabbed sticker the way the finger went.
        const geometry = MOVE_GEOMETRY[move]
        const q = new Quaternion().setFromAxisAngle(geometry.axis, geometry.angle)
        const moved = slot.position.clone().applyQuaternion(q)
        const travel = moved.clone().sub(slot.position)
        if (travel.dot(direction) <= 0.4) {
          wrong++
          console.error(
            `  FAIL  drag ${slot.face}${slot.index} (${slot.cubie.join(',')}) toward ` +
              `${direction.toArray().join(',')} gave ${move}, which moves it the other way`,
          )
        }
      }
    }
  }
  console.log(`  ${checked} drags verified, ${unsupported} middle-slice drags ignored`)
  check('every supported drag turns the layer the right way', wrong === 0, `${wrong} wrong`)

  // Spot checks a cuber would recognise.
  const drag = (face: Face, index: number, dir: [number, number, number]): Move | null =>
    moveFromDrag(FACE_NORMAL[face], new Vector3(...dir), STICKERS.find((s) => s.face === face && s.index === index)!.cubie)

  check('dragging the top row of F to the right is U', drag('F', 1, [1, 0, 0]) === 'U_PRIME')
  check('dragging the right column of F up is R', drag('F', 5, [0, 1, 0]) === 'R')
  check('dragging the right column of F down is R', drag('F', 5, [0, -1, 0]) === 'R_PRIME')
  check('dragging the right column of U forward is R', drag('U', 5, [0, 0, 1]) === 'R_PRIME')
  check('dragging the front row of D to the right is F', drag('D', 1, [1, 0, 0]) === 'F_PRIME')
  // Dragging U's back edge forward would spin the middle slice, which this cube leaves alone.
  check('a middle-slice drag produces no move', drag('U', 1, [0, 0, 1]) === null)
}

// ---------------------------------------------------------------------------
section('7. Solver performance')

{
  // Tables build on first use, so time a cold run separately from steady state.
  const coldStart = Date.now()
  solve(cubeFromFaces(toFaceGrid(randomFacelets())))
  const cold = Date.now() - coldStart

  const time = (effort: 'fast' | 'full', runs: number): number => {
    const start = Date.now()
    for (let i = 0; i < runs; i++) solve(cubeFromFaces(toFaceGrid(randomFacelets())), { effort })
    return (Date.now() - start) / runs
  }

  const full = time('full', 20)
  const fast = time('fast', 20)
  console.log(`  first solve, including table build: ${cold}ms`)
  console.log(`  then ${full.toFixed(0)}ms per solve at 'full' effort, ${fast.toFixed(0)}ms at 'fast'`)
  // Both run inside a worker, so this only has to be quick enough to feel instant.
  check('a full-effort solve stays well under a second', full < 500, `${full.toFixed(0)}ms`)
  check('fast effort is quicker than full', fast < full, `${fast.toFixed(0)}ms vs ${full.toFixed(0)}ms`)
}

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} — ${checks - failures}/${checks} checks passed\n`)
if (failures > 0) throw new Error(`${failures} check(s) failed`)
