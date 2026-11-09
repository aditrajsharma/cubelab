import { motion } from 'motion/react'
import { useCubeStore } from '../state/useCubeStore'

/** A little isometric cube, drawn rather than imported. */
function CubeMark() {
  const faces = [
    { points: '12 2 22 7 22 17 12 22', fill: '#8b5cf6' },
    { points: '12 2 2 7 2 17 12 22', fill: '#6d3ff0' },
    { points: '2 7 12 12 22 7 12 2', fill: '#a78bfa' },
  ]
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden className="shrink-0">
      {faces.map((face) => (
        <polygon key={face.points} points={face.points} fill={face.fill} />
      ))}
    </svg>
  )
}

const TABS = [
  { id: 'play', label: 'Play' },
  { id: 'paint', label: 'Enter' },
  { id: 'settings', label: 'Settings' },
] as const

export type TabId = (typeof TABS)[number]['id']

export function TopBar({
  tab,
  onTabChange,
}: {
  tab: TabId
  onTabChange: (tab: TabId) => void
}) {
  const solved = useCubeStore((state) => state.solved)
  const phase = useCubeStore((state) => state.phase)

  return (
    <header className="z-20 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-white/[0.055] px-4 backdrop-blur-xl sm:px-6">
      <div className="flex items-center gap-2.5">
        <CubeMark />
        <div className="leading-none">
          <div className="text-[0.9375rem] font-semibold tracking-tight">CubeLab</div>
          <div className="mt-0.5 text-[0.625rem] tracking-[0.16em] text-dim uppercase">
            Kociemba · R3F
          </div>
        </div>
      </div>

      <nav className="glass-inset flex items-center gap-0.5 rounded-xl p-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onTabChange(item.id)}
            className="focus-ring relative rounded-lg px-3 py-1.5 text-[0.8125rem] transition-colors"
          >
            {tab === item.id && (
              <motion.span
                layoutId="tab-pill"
                transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                className="absolute inset-0 rounded-lg bg-white/[0.1]"
              />
            )}
            <span className={`relative ${tab === item.id ? 'text-chalk' : 'text-mist hover:text-chalk'}`}>
              {item.label}
            </span>
          </button>
        ))}
      </nav>

      <div className="hidden w-[132px] justify-end sm:flex">
        <span
          data-testid="status"
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.6875rem] ${
            phase === 'scrambling'
              ? 'border-cyan-glow/25 bg-cyan-glow/10 text-cyan-glow'
              : solved
                ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
                : 'border-white/[0.07] bg-white/[0.05] text-mist'
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {phase === 'scrambling' ? 'Scrambling' : solved ? 'Solved' : 'Scrambled'}
        </span>
      </div>
    </header>
  )
}
