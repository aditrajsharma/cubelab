import { useEffect, useState } from 'react'
import { useCubeStore } from '../state/useCubeStore'

export function formatTime(ms: number): string {
  if (ms <= 0) return '0:00.00'
  const total = Math.floor(ms)
  const minutes = Math.floor(total / 60000)
  const seconds = Math.floor((total % 60000) / 1000)
  const hundredths = Math.floor((total % 1000) / 10)
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`
}

/**
 * Redraws every frame while the clock runs. Deliberately driven by requestAnimationFrame
 * rather than a timer, so the digits never drift from the animation they sit next to.
 */
export function TimerReadout({ className = '' }: { className?: string }) {
  const timerStart = useCubeStore((state) => state.timerStart)
  const timerElapsed = useCubeStore((state) => state.timerElapsed)
  const [, setTick] = useState(0)

  useEffect(() => {
    if (timerStart === null) return
    let frame = 0
    const tick = () => {
      setTick((n) => n + 1)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [timerStart])

  const ms = timerStart !== null ? performance.now() - timerStart : timerElapsed
  const running = timerStart !== null

  return (
    <div className={className}>
      <div
        className={`tabular font-mono font-semibold tracking-tight transition-colors ${
          running ? 'text-chalk' : 'text-mist'
        }`}
      >
        {formatTime(ms)}
      </div>
    </div>
  )
}
