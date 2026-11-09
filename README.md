# CubeLab

A 3D Rubik's Cube you can drag and turn, with WCA-style random-state scrambles and a
Kociemba two-phase solver. Runs entirely in the browser — no backend, no database, no
network calls at runtime.

```bash
npm install
npm run dev
```

---

## What is built so far

| | |
| --- | --- |
| **3D cube** | 27 cubies and 54 stickers built by hand in React Three Fiber — not an embedded widget, so the materials, lighting and turn animation are all ours |
| **Turn it** | Drag any face to turn that layer, drag the background to orbit, scroll to zoom. 18 move buttons and keyboard shortcuts too |
| **Scrambles** | True random-state scrambles: pick a uniformly random legal cube, solve it, invert the solution (~20 moves) |
| **Solver** | Kociemba two-phase, in a web worker so a turn animation never stutters |
| **Solution playback** | Step through or play the solution on the 3D cube |
| **Colour entry** | Unfolded net and paint palette, or tap stickers directly on the 3D cube |
| **Timer** | Starts on your first turn, stops the moment the cube is solved, keeps a local best |

Roadmap items from the original plan that are **not** built yet: hand-based timer
controls (Phase 5), the algorithms library and learning mode (Phase 7), and webcam hand
tracking (Phase 8). The statistics view is partially covered by the recent-solves list
under Settings.

---

## Stack

| | |
| --- | --- |
| React 19 + TypeScript | app and UI |
| Vite 8 | dev server and build |
| Three.js 0.187 + React Three Fiber 9 + drei | the 3D scene |
| @react-three/postprocessing | bloom and vignette |
| `@turnwise/cube-solver` | the solving engine |
| Zustand | state, with `persist` for settings and solve times |
| Motion | transitions and micro-interactions |
| Tailwind CSS 4 | styling |

R3F is deliberately pinned to the **v9** line (v10 is still alpha) and animation uses
the `motion` package rather than the older `framer-motion` name.

Two packages from the original plan were dropped once the cube engine was written:

- **`cubing.js`** — it was going to cover notation, scrambles and puzzle logic, but
  `@turnwise/cube-solver` already exposes validated state, moves and notation, and the
  geometry needed for rendering had to be written anyway. Keeping both would have meant
  two sources of truth for the facelet order. Worth revisiting only for smart-cube
  Bluetooth support, which is the one thing it uniquely offers.
- **`lucide-react`** — nothing needed an icon yet. Add it back with the Learn view.

---

## How the cube engine works

Everything hangs off one idea: **the cube is 54 stickers in a fixed order** — the
Kociemba facelet string. Nine per face in `U, R, F, D, L, B` order, each read row by row
while looking straight at the face, `U` read with `B` at the top and `D` with `F` at the
top.

```
src/cube/
  geometry.ts     which sticker lives where in space, and the 3D transforms to draw it
  moves.ts        notation -> rotation in space, and the facelet permutation each move causes
  state.ts        the 54-letter state, and conversions to and from the solver
  randomState.ts  uniform random legal cubes
  solverCore.ts   solve and scramble, free of any Worker or DOM API
  solver.worker.ts / solverClient.ts   the same code, off the main thread
  notation.ts     reading and writing "R U R' F2"
  verify.ts       the self-check described below
```

Three details worth knowing:

**Permutations are derived, not written out.** `moves.ts` works out which of the 54
facelets each move moves by rotating them in 3D and looking up where they land. The
look-up tables cannot drift out of sync with the geometry, because they are generated
from it.

**A clockwise turn is a *negative* rotation.** Notation says "clockwise as seen looking
at that face", which is a negative right-handed rotation about the face's outward
normal. Getting this backwards produces a cube that looks plausible and is subtly
wrong, so `verify.ts` checks all 18 moves and 400 random sequences against the solver
library.

**Dragging is geometry, not a lookup table.** Drag a sticker and the two directions it
can slide are the two lattice axes perpendicular to its normal. Project both to screen
space, see which one the pointer followed, and the rest follows: dragging along `d` on a
face with normal `n` spins the layer about `n × d`. `verify.ts` checks all 144 supported
drags by rotating the grabbed sticker and confirming it travelled the way the finger
went.

---

## Verification

There are two harnesses, and both are worth running after touching the cube code.

```bash
npm run check           # cube maths, in Node — about 15 seconds
npm run check:runtime   # the real app in a headless browser — a few minutes
```

`npm run check` runs `src/cube/verify.ts`, which asserts 138 properties: the geometry
adds up, the facelet permutations agree with `@turnwise/cube-solver` exactly, 400 random
states are legal, scrambles round-trip, every broken cube is rejected with the right
error, and the drag mapping is correct.

```
1. Geometry: 54 stickers, correctly attached to 27 cubies
2. Move permutations agree with the solver library
3. Random states are legal cubes
4. Scrambles and solutions actually work
   scramble length: avg 20.4, range 18-22
5. Illegal cubes are rejected with a useful reason
   one edge flipped: EdgeFlipError
   one corner twisted: CornerTwistError
   two corners swapped: ParityError
   a sticker recoloured: StickerCountError
6. Dragging a sticker produces the move a hand would
   144 drags verified, 72 middle-slice drags ignored
7. Solver performance
   then 188ms per solve at 'full' effort, 14ms at 'fast'

PASS — 138/138 checks passed
```

`npm run check:runtime` drives the running dev server with Playwright. Because the 3D
output has to be checked without anyone looking at it, it screenshots the WebGL canvas
and classifies every pixel by hue: a solved cube must show three solid faces, a
scrambled one must show all six colours mixed, and after playing the solution the
picture must match the solved one again. It also exercises the drag-to-turn path, the
solver, colour entry, and asserts the console stays clean.

> The runtime check needs Chromium (`npx playwright install chromium`, plus
> `npx playwright install-deps chromium` on a bare Linux box). The container this was
> developed in has no GPU, so Chromium rasterises WebGL on the CPU and manages a couple
> of frames a second — the check is written to poll rather than sleep, so it is slow
> there rather than flaky.

`npm run look scripts/shots/1-solved.png` prints any screenshot as a character grid,
which is how the 3D output was inspected while building this.

---

## Layout notes

- **One source of truth.** `facelets` in the Zustand store is what the user is looking
  at. The 3D scene commits a move against the store the instant it finishes animating
  it, and nothing else writes to it.
- **Turning a layer.** The nine cubies are attached to a pivot group, the pivot is
  rotated, then they are handed back and snapped home while the stickers are repainted
  from the new state. A cube looks identical whether you moved the plastic or moved the
  colours, so the swap is invisible. The commit and the repaint happen in the same
  tick, so there is never a frame where one happened without the other.
- **Pointer events.** The pointer-down listener runs in the capture phase on `window`,
  so it always sees the event before OrbitControls does. That is what lets a drag on the
  cube turn a layer while a drag on the background orbits the camera.
- **Nothing external.** The environment lighting is built from lightformers rather than
  an HDRI file, so there is no CDN fetch, no loading state, and it works offline.
