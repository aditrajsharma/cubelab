/**
 * The 3D viewport: camera, lighting and post.
 *
 * The environment is built from lightformers rather than an HDRI file, so the whole
 * thing is self-contained — no CDN fetch, no loading state, and it looks the same
 * offline as it does online.
 */
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { useCubeStore } from '../../state/useCubeStore'
import { RubiksCube } from './RubiksCube'

function Studio() {
  return (
    <>
      <ambientLight intensity={0.22} />
      <directionalLight position={[6, 9, 6]} intensity={1.5} color="#fff4e6" />
      <directionalLight position={[-8, 1, -4]} intensity={0.45} color="#7aa2ff" />
      <directionalLight position={[2, -6, 4]} intensity={0.25} color="#ff9a5c" />

      <Environment resolution={256} frames={1}>
        <color attach="background" args={['#07070c']} />
        {/* Big soft key light overhead. */}
        <Lightformer form="rect" intensity={6} color="#ffffff" position={[0, 7, -2]} scale={[14, 14, 1]} />
        <Lightformer form="rect" intensity={1.6} color="#ffffff" position={[0, -6, 1]} scale={[14, 14, 1]} />
        {/* Cool and warm rim lights, so the plastic picks up colour at its edges. */}
        <Lightformer form="circle" intensity={3} color="#8b5cf6" position={[-8, 1, 3]} scale={[7, 7, 1]} />
        <Lightformer form="circle" intensity={3} color="#22d3ee" position={[8, -1, 3]} scale={[7, 7, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#ff8a3d" position={[0, 2, 9]} scale={[10, 4, 1]} />
      </Environment>
    </>
  )
}

function Effects() {
  return (
    <EffectComposer multisampling={4}>
      <Bloom intensity={0.48} luminanceThreshold={0.74} luminanceSmoothing={0.2} mipmapBlur radius={0.62} />
      <Vignette offset={0.32} darkness={0.5} />
    </EffectComposer>
  )
}

export function CubeScene() {
  const autoRotate = useCubeStore((state) => state.autoRotate)
  const effects = useCubeStore((state) => state.effects)

  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [6.2, 4.8, 7.6], fov: 30, near: 0.1, far: 60 }}
    >
      <Studio />
      <RubiksCube />

      <ContactShadows
        position={[0, -1.9, 0]}
        opacity={0.5}
        scale={16}
        blur={2.6}
        far={4.5}
        resolution={512}
        color="#000000"
      />

      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        autoRotate={autoRotate}
        autoRotateSpeed={0.4}
        minDistance={7}
        maxDistance={22}
        minPolarAngle={0.22}
        maxPolarAngle={Math.PI - 0.22}
      />

      {effects && <Effects />}
    </Canvas>
  )
}
