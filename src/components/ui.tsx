/** Shared building blocks: buttons, toggles, section shells, small readouts. */
import { motion } from 'motion/react'
import type { ReactNode } from 'react'

type Variant = 'primary' | 'subtle' | 'ghost'
type Size = 'sm' | 'md'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-white text-void font-semibold hover:bg-white/90 shadow-[0_8px_24px_-8px_rgba(255,255,255,0.45)] disabled:bg-white/30',
  subtle:
    'glass-inset text-chalk hover:bg-white/[0.09] active:bg-white/[0.12] disabled:text-dim disabled:hover:bg-white/[0.035]',
  ghost: 'text-mist hover:bg-white/[0.06] hover:text-chalk disabled:text-dim/60 disabled:hover:bg-transparent',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[0.8125rem] rounded-lg gap-1.5',
  md: 'h-10 px-4 text-sm rounded-xl gap-2',
}

interface ButtonProps {
  children: ReactNode
  onClick?: () => void
  variant?: Variant
  size?: Size
  disabled?: boolean
  title?: string
  className?: string
}

export function Button({
  children,
  onClick,
  variant = 'subtle',
  size = 'md',
  disabled,
  title,
  className = '',
}: ButtonProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 700, damping: 30 }}
      className={`focus-ring inline-flex select-none items-center justify-center whitespace-nowrap transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {children}
    </motion.button>
  )
}

export function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="border-b border-white/[0.055] px-5 py-[1.15rem] last:border-b-0">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="eyebrow">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="focus-ring group flex w-full items-center justify-between rounded-lg py-1.5 text-left text-[0.8125rem] text-mist transition-colors hover:text-chalk"
    >
      <span>{label}</span>
      <span
        className={`relative h-[18px] w-8 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-violet-glow/70' : 'bg-white/12'
        }`}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 800, damping: 40 }}
          className="absolute top-[3px] h-3 w-3 rounded-full bg-white shadow"
          style={{ left: checked ? 17 : 3 }}
        />
      </span>
    </button>
  )
}

export function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="glass-inset rounded-lg px-3 py-2">
      <div className="eyebrow text-[0.625rem]">{label}</div>
      <div className={`tabular mt-0.5 text-sm font-semibold ${accent ?? 'text-chalk'}`}>{value}</div>
    </div>
  )
}

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'live' | 'good' }) {
  const tones = {
    neutral: 'text-mist bg-white/[0.05] border-white/[0.07]',
    live: 'text-violet-glow bg-violet-glow/10 border-violet-glow/25',
    good: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/25',
  } as const
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.6875rem] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

/** A row of keys, drawn as little keycaps. */
export function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-white/12 bg-white/[0.06] px-1.5 font-mono text-[0.6875rem] text-mist">
      {children}
    </kbd>
  )
}
