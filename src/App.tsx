import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Background } from './components/Background'
import { CubeScene } from './components/cube/CubeScene'
import { ControlPanel } from './components/panel/ControlPanel'
import { TopBar } from './components/TopBar'
import type { TabId } from './components/TopBar'
import { formatTime } from './components/TimerReadout'
import { useKeyboard } from './hooks/useKeyboard'
import { warmSolver } from './cube/solverClient'
import { useCubeStore } from './state/useCubeStore'

/** Floating notes over the 3D viewport. */
function StageOverlay() {
  const solved = useCubeStore((state) => state.solved)
  const scrambleLength = useCubeStore((state) => state.scramble.length)
  const timerElapsed = useCubeStore((state) => state.timerElapsed)
  const timerStart = useCubeStore((state) => state.timerStart)
  const historyLength = useCubeStore((state) => state.history.length)
  const queueLength = useCubeStore((state) => state.queue.length)
  const mode = useCubeStore((state) => state.mode)

  const finished = solved && scrambleLength > 0 && historyLength > 0 && timerStart === null

  return (
    <div data-stage-overlay className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="glass rounded-xl px-3 py-2">
          <div className="eyebrow text-[0.625rem]">Turns</div>
          <div data-testid="turns" className="tabular mt-0.5 font-mono text-lg leading-none">{historyLength}</div>
        </div>
        {queueLength > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-xl px-3 py-2 text-[0.75rem] text-cyan-glow"
          >
            {queueLength} moves queued
          </motion.div>
        )}
      </div>

      <div className="flex flex-col items-center gap-3">
        {finished && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="glass pulse-solved rounded-2xl px-5 py-3 text-center"
          >
            <div className="eyebrow text-[0.625rem] text-emerald-300/70">Solved</div>
            <div className="tabular mt-1 font-mono text-2xl text-emerald-300">{formatTime(timerElapsed)}</div>
          </motion.div>
        )}
        <p className="glass rounded-full px-3.5 py-1.5 text-center text-[0.6875rem] text-mist">
          {mode === 'paint'
            ? 'Tap a sticker to paint it · drag to orbit'
            : 'Drag a face to turn it · drag the background to orbit'}
        </p>
      </div>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState<TabId>('play')
  useKeyboard()

  // Build the solver's tables while the user is still reading the first screen.
  useEffect(() => {
    warmSolver()
  }, [])

  const changeTab = (next: TabId) => {
    setTab(next)
    useCubeStore.getState().setMode(next === 'paint' ? 'paint' : 'play')
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-void">
      <Background />

      <div className="relative flex h-full flex-col">
        <TopBar tab={tab} onTabChange={changeTab} />

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <main className="relative min-h-[54vh] flex-1 lg:min-h-0">
            <CubeScene />
            <StageOverlay />
          </main>

          {/*
            The panel shares the leftover height and scrolls inside itself. Without
            `flex-1` here it sized to its content, overflowed the row, and the browser
            scrolled the root container instead — which slid the cube off the top.
          */}
          <aside className="glass scroll-slim min-h-0 w-full flex-1 overflow-y-auto overscroll-contain border-t border-white/[0.055] lg:w-[22rem] lg:flex-none lg:border-t-0 lg:border-l xl:w-[24rem]">
            <ControlPanel tab={tab} />
          </aside>
        </div>
      </div>
    </div>
  )
}
