/**
 * The cube itself: 27 plastic bodies carrying 54 stickers, built by hand rather than
 * dropped in as a widget, so the lighting, materials and turn animation are ours.
 *
 * Two ideas do most of the work here.
 *
 * 1. Turning a layer. The nine cubies are temporarily attached to a pivot group, the
 *    pivot is rotated, then they are handed back and snapped home while the stickers
 *    are repainted from the new state. Because a cube looks identical whether you
 *    moved the plastic or moved the colours, the swap is invisible.
 *
 * 2. Dragging. A pointer-down is raycast against one flat, invisible target per
 *    sticker. Whichever way the finger then travels picks one of the two directions
 *    that sticker can slide, and `moveFromDrag` turns that into notation. The listener
 *    runs in the capture phase on `window` so it always sees the event before
 *    OrbitControls does, which is what lets a drag on the cube turn a layer instead of
 *    spinning the camera.
 */
import { RoundedBox } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type { Group, Mesh, MeshPhysicalMaterial } from 'three'
import { Vector2, Vector3 } from 'three'
import type { Face, Move } from '@turnwise/cube-solver'
import {
  CUBIE_RADIUS,
  CUBIE_SIZE,
  CUBIES,
  HIT_OFFSET,
  PLACEMENTS_BY_CUBIE,
  STICKERS,
  STICKER_DEPTH,
  STICKER_RADIUS,
  STICKER_SIZE,
} from '../../cube/geometry'
import { MOVE_GEOMETRY, dragAxes, layerIndices, moveFromDrag } from '../../cube/moves'
import { FACE_THEME } from '../../cube/colors'
import { turnDuration, useCubeStore } from '../../state/useCubeStore'

/** Pixels of travel before a press counts as a drag. */
const DRAG_THRESHOLD = 12
/** Pixels of travel before a press stops counting as a click. */
const CLICK_SLOP = 4

interface OrbitLike {
  enableRotate: boolean
}

interface DragState {
  readonly facelet: number
  readonly x: number
  readonly y: number
  readonly paint: boolean
  moved: boolean
}

/** Ease in and out, so a turn starts and stops gently. */
function ease(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}

export function RubiksCube() {
  const root = useRef<Group>(null!)
  const pivot = useRef<Group>(null!)
  const cubies = useRef<Array<Group | null>>([])
  const targets = useRef<Array<Mesh>>([])
  const materials = useRef<Array<MeshPhysicalMaterial | null>>([])
  const drag = useRef<DragState | null>(null)
  const turn = useRef<{ move: Move; elapsed: number; duration: number } | null>(null)

  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const raycaster = useThree((state) => state.raycaster)
  const controls = useThree((state) => state.controls as unknown as OrbitLike | null)

  // --- Repaint stickers straight on the materials. This bypasses React entirely, so
  // --- a turn never triggers a re-render of 27 cubies.
  const paint = (facelets: readonly Face[]) => {
    for (let facelet = 0; facelet < 54; facelet++) {
      const material = materials.current[facelet]
      if (!material) continue
      material.color.set(FACE_THEME[facelets[facelet]].hex)
      // A whisper of self-lighting keeps colours rich in shadow and feeds the bloom.
      material.emissive.set(FACE_THEME[facelets[facelet]].hex)
    }
  }

  useEffect(() => {
    paint(useCubeStore.getState().facelets)
    return useCubeStore.subscribe((state, previous) => {
      if (state.facelets !== previous.facelets) paint(state.facelets)
    })
  }, [])

  useEffect(() => {
    const canvas = gl.domElement

    const toNdc = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      return new Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      )
    }

    const toPixels = (point: Vector3) => {
      const projected = point.clone().project(camera)
      const rect = canvas.getBoundingClientRect()
      return new Vector2((projected.x * 0.5 + 0.5) * rect.width, (-projected.y * 0.5 + 0.5) * rect.height)
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      const target = event.target
      if (!(target instanceof Node) || !canvas.contains(target)) return

      raycaster.setFromCamera(toNdc(event), camera)
      const hit = raycaster.intersectObjects(targets.current, false)[0]
      if (!hit) {
        if (controls) controls.enableRotate = true
        return
      }

      const facelet = hit.object.userData.facelet as number
      const { mode, phase } = useCubeStore.getState()

      if (mode === 'paint') {
        // Let the drag orbit the camera; a tap with no travel paints the sticker.
        if (controls) controls.enableRotate = true
        drag.current = { facelet, x: event.clientX, y: event.clientY, paint: true, moved: false }
        return
      }

      if (controls) controls.enableRotate = false
      if (phase === 'scrambling') return
      drag.current = { facelet, x: event.clientX, y: event.clientY, paint: false, moved: false }
    }

    const onPointerMove = (event: PointerEvent) => {
      const state = drag.current
      if (!state) return
      const dx = event.clientX - state.x
      const dy = event.clientY - state.y
      if (Math.abs(dx) + Math.abs(dy) > CLICK_SLOP) state.moved = true
      if (state.paint || Math.hypot(dx, dy) < DRAG_THRESHOLD) return

      // Which of the two directions this sticker can slide did the finger pick?
      const slot = STICKERS[state.facelet]
      const origin = toPixels(slot.position)
      let bestAxis: Vector3 | null = null
      let bestScore = 0
      for (const axis of dragAxes(slot.normal)) {
        const projected = toPixels(slot.position.clone().addScaledVector(axis, 0.6)).sub(origin)
        const length = Math.hypot(projected.x, projected.y)
        if (length < 0.001) continue
        const score = (dx * projected.x + dy * projected.y) / length
        if (Math.abs(score) > Math.abs(bestScore)) {
          bestScore = score
          bestAxis = axis.clone().multiplyScalar(Math.sign(score))
        }
      }

      drag.current = null
      if (!bestAxis) return
      const move = moveFromDrag(slot.normal, bestAxis, slot.cubie)
      if (move) useCubeStore.getState().enqueue([move])
    }

    const onPointerUp = () => {
      const state = drag.current
      drag.current = null
      if (controls) controls.enableRotate = true
      if (state?.paint && !state.moved) useCubeStore.getState().paintFacelet(state.facelet)
    }

    // Capture on window: this has to land before OrbitControls' own canvas listener.
    window.addEventListener('pointerdown', onPointerDown, { capture: true })
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, { capture: true })
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }, [camera, controls, gl, raycaster])

  useFrame((_, delta) => {
    const active = turn.current
    if (active) {
      active.elapsed += delta * 1000
      const geometry = MOVE_GEOMETRY[active.move]
      const progress = Math.min(1, active.elapsed / active.duration)
      pivot.current.quaternion.setFromAxisAngle(geometry.axis, geometry.angle * ease(progress))
      if (progress >= 1) finish(active.move)
      return
    }
    const next = useCubeStore.getState().queue[0]
    if (next) begin(next)
  })

  function begin(move: Move) {
    for (const index of layerIndices(move)) {
      const cubie = cubies.current[index]
      if (cubie) pivot.current.attach(cubie)
    }
    pivot.current.quaternion.identity()
    turn.current = { move, elapsed: 0, duration: turnDuration(move, useCubeStore.getState().turnSpeed) }
  }

  function finish(move: Move) {
    for (const index of layerIndices(move)) {
      const cubie = cubies.current[index]
      if (!cubie) continue
      root.current.add(cubie)
      cubie.position.set(CUBIES[index][0], CUBIES[index][1], CUBIES[index][2])
      cubie.quaternion.identity()
    }
    pivot.current.quaternion.identity()
    turn.current = null
    // Commit and repaint in the same tick: the plastic goes home and the colours
    // follow it, so there is never a frame where one has happened without the other.
    const store = useCubeStore.getState()
    store.commitMove()
    paint(useCubeStore.getState().facelets)
  }

  return (
    <group ref={root}>
      {CUBIES.map((coord, index) => (
        <group
          key={index}
          ref={(element) => {
            cubies.current[index] = element
          }}
          position={coord as unknown as [number, number, number]}
        >
          <RoundedBox args={[CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE]} radius={CUBIE_RADIUS} smoothness={3}>
            <meshPhysicalMaterial
              color="#0a0a0f"
              roughness={0.38}
              metalness={0.2}
              clearcoat={0.6}
              clearcoatRoughness={0.3}
              envMapIntensity={0.7}
            />
          </RoundedBox>

          {PLACEMENTS_BY_CUBIE[index].map((placement) => (
            <group key={placement.facelet} position={placement.localPosition} quaternion={placement.quaternion}>
              <RoundedBox args={[STICKER_SIZE, STICKER_SIZE, STICKER_DEPTH]} radius={STICKER_RADIUS} smoothness={3}>
                <meshPhysicalMaterial
                  ref={(element) => {
                    materials.current[placement.facelet] = element
                  }}
                  roughness={0.26}
                  metalness={0}
                  clearcoat={1}
                  clearcoatRoughness={0.05}
                  envMapIntensity={1.1}
                  emissiveIntensity={0.09}
                />
              </RoundedBox>

              {/* Flat, invisible target: cheap to hit, and always faces the sticker. */}
              <mesh
                position={[0, 0, HIT_OFFSET]}
                ref={(element) => {
                  if (element) {
                    element.userData.facelet = placement.facelet
                    targets.current[placement.facelet] = element
                  }
                }}
              >
                <planeGeometry args={[STICKER_SIZE, STICKER_SIZE]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
            </group>
          ))}
        </group>
      ))}

      <group ref={pivot} />
    </group>
  )
}
