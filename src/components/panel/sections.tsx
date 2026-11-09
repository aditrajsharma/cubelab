import type { Face } from '@turnwise/cube-solver'
import { FACE_THEME, PALETTE_ORDER } from '../../cube/colors'
import { moveOf } from '../../cube/moves'
import { stickerCounts } from '../../cube/state'
import { useCubeStore } from '../../state/useCubeStore'
import { Button, Key, Pill, Section, Stat, Toggle } from '../ui'
import { TimerReadout, formatTime } from '../TimerReadout'
import { CubeNet } from '../CubeNet'

/* -------------------------------------------------------------------------- */
/* Play                                                                        */
/* -------------------------------------------------------------------------- */

export function PlaySection() {
  const scrambleText = useCubeStore((state) => state.scrambleText)
  const phase = useCubeStore((state) => state.phase)
  const queueLength = useCubeStore((state) => state.queue.length)
  const historyLength = useCubeStore((state) => state.history.length)
  const records = useCubeStore((state) => state.records)
  const scramble = useCubeStore((state) => state.scramble)
  const newScramble = useCubeStore((state) => state.newScramble)
  const reset = useCubeStore((state) => state.reset)
  const undo = useCubeStore((state) => state.undo)

  const best = records[0]?.timeMs ?? null
  const scrambling = phase === 'scrambling'

  return (
    <>
      <Section
        title="Timer"
        action={
          queueLength > 0 ? <Pill tone="live">{queueLength} queued</Pill> : <Pill>{scramble.length} move scramble</Pill>
        }
      >
        <div className="glass-inset flex items-baseline justify-between rounded-xl px-4 py-3">
          <TimerReadout className="text-[2.15rem] leading-none" />
          <div className="text-right">
            <div className="eyebrow text-[0.625rem]">Best</div>
            <div className="tabular mt-0.5 font-mono text-sm text-mist">
              {best === null ? '—' : formatTime(best)}
            </div>
          </div>
        </div>
        <p className="mt-2 text-[0.75rem] leading-relaxed text-dim">
          {scramble.length === 0
            ? 'Generate a scramble, then make your first turn to start the clock.'
            : 'The clock starts on your first turn and stops the moment the cube is solved.'}
        </p>
      </Section>

      <Section title="Scramble">
        <div data-testid="scramble-text" className="glass-inset min-h-[3.25rem] rounded-xl px-3.5 py-3 font-mono text-[0.8125rem] leading-relaxed break-words text-chalk">
          {scrambleText || <span className="text-dim">Solved — no scramble yet</span>}
        </div>
        <div className="mt-3 flex gap-2">
          <Button variant="primary" onClick={() => void newScramble()} disabled={scrambling} className="flex-1">
            {scrambling ? 'Scrambling…' : 'New scramble'}
          </Button>
          <Button onClick={undo} disabled={historyLength === 0 || queueLength > 0} title="Undo last turn (Z)">
            Undo
          </Button>
          <Button onClick={reset} title="Back to a solved cube (Backspace)">
            Reset
          </Button>
        </div>
      </Section>

      <Section title="This solve">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Turns" value={String(historyLength)} />
          <Stat label="Solves" value={String(records.length)} />
          <Stat label="Average" value={records.length ? formatTime(records.reduce((a, r) => a + r.timeMs, 0) / records.length) : '—'} />
        </div>
      </Section>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Solve                                                                       */
/* -------------------------------------------------------------------------- */

export function SolveSection() {
  const solution = useCubeStore((state) => state.solution)
  const solutionText = useCubeStore((state) => state.solutionText)
  const phase = useCubeStore((state) => state.phase)
  const queueLength = useCubeStore((state) => state.queue.length)
  const notice = useCubeStore((state) => state.notice)
  const solved = useCubeStore((state) => state.solved)
  const solveCube = useCubeStore((state) => state.solveCube)
  const playSolution = useCubeStore((state) => state.playSolution)
  const stopPlayback = useCubeStore((state) => state.stopPlayback)
  const dismissNotice = useCubeStore((state) => state.dismissNotice)

  const solving = phase === 'solving'

  return (
    <Section
      title="Solver"
      action={solution.length > 0 ? <Pill tone="good">{solution.length} moves</Pill> : null}
    >
      <Button
        variant="primary"
        onClick={() => void solveCube()}
        disabled={solving || solved}
        className="w-full"
      >
        {solving ? 'Solving…' : solved ? 'Cube is solved' : 'Solve this cube'}
      </Button>

      {notice && (
        <div data-testid="notice" className="mt-3 flex gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.07] px-3 py-2.5 text-[0.8125rem] leading-relaxed text-amber-200">
          <span className="flex-1">{notice}</span>
          <button type="button" onClick={dismissNotice} className="focus-ring shrink-0 text-amber-200/60 hover:text-amber-100">
            ✕
          </button>
        </div>
      )}

      {solutionText && (
        <>
          <div data-testid="solution-text" className="glass-inset mt-3 rounded-xl px-3.5 py-3 font-mono text-[0.8125rem] leading-relaxed break-words">
            {solutionText}
          </div>
          <div className="mt-3 flex gap-2">
            <Button onClick={playSolution} disabled={queueLength > 0} className="flex-1">
              Play solution
            </Button>
            <Button onClick={stopPlayback} disabled={queueLength === 0} variant="ghost">
              Stop
            </Button>
          </div>
        </>
      )}
    </Section>
  )
}

/* -------------------------------------------------------------------------- */
/* Move pad                                                                    */
/* -------------------------------------------------------------------------- */

const PAD_FACES: readonly Face[] = ['U', 'R', 'F', 'D', 'L', 'B']
const PAD_TURNS = [1, 3, 2] as const

export function MovePadSection() {
  const enqueue = useCubeStore((state) => state.enqueue)
  const phase = useCubeStore((state) => state.phase)

  return (
    <Section title="Turn by hand" action={<span className="text-[0.6875rem] text-dim">or drag the cube</span>}>
      <div className="grid grid-cols-6 gap-1.5">
        {PAD_FACES.map((face) => (
          <div key={face} className="flex flex-col gap-1">
            <div className="text-center text-[0.625rem] font-semibold text-dim">{face}</div>
            {PAD_TURNS.map((turn) => {
              const move = moveOf(face, turn)
              const label = turn === 1 ? face : turn === 3 ? `${face}'` : `${face}2`
              return (
                <button
                  key={move}
                  type="button"
                  disabled={phase === 'scrambling'}
                  onClick={() => enqueue([move])}
                  className="focus-ring glass-inset h-7 rounded-md font-mono text-[0.6875rem] text-mist transition-colors hover:bg-white/[0.1] hover:text-chalk disabled:opacity-40"
                >
                  {label}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[0.6875rem] text-dim">
        <Key>U</Key>
        <Key>R</Key>
        <Key>F</Key>
        <Key>D</Key>
        <Key>L</Key>
        <Key>B</Key>
        <span>turn</span>
        <span className="text-white/20">·</span>
        <Key>Shift</Key>
        <span>+ key for prime</span>
      </div>
    </Section>
  )
}

/* -------------------------------------------------------------------------- */
/* Enter a cube                                                                */
/* -------------------------------------------------------------------------- */

export function PaintSection() {
  const facelets = useCubeStore((state) => state.facelets)
  const paint = useCubeStore((state) => state.paint)
  const setPaint = useCubeStore((state) => state.setPaint)
  const paintFacelet = useCubeStore((state) => state.paintFacelet)
  const reset = useCubeStore((state) => state.reset)
  const counts = stickerCounts(facelets)

  return (
    <>
      <Section title="Enter your own cube" action={<Pill>paint mode</Pill>}>
        <p className="text-[0.75rem] leading-relaxed text-dim">
          Pick a colour, then tap stickers — either on the net below or straight onto the cube in the
          viewport. Centres are fixed. When the sticker counts are right, press Solve.
        </p>

        <div className="mt-3 grid grid-cols-6 gap-1.5">
          {PALETTE_ORDER.map((face) => {
            const theme = FACE_THEME[face]
            const selected = paint === face
            return (
              <button
                key={face}
                type="button"
                onClick={() => setPaint(face)}
                title={theme.name}
                aria-pressed={selected}
                className={`focus-ring flex aspect-square items-center justify-center rounded-lg transition-all ${
                  selected ? 'ring-2 ring-white ring-offset-2 ring-offset-void' : 'opacity-80 hover:opacity-100'
                }`}
                style={{ background: theme.hex, boxShadow: 'inset 0 -3px 6px rgba(0,0,0,0.3)' }}
              >
                <span className="sr-only">{theme.name}</span>
              </button>
            )
          })}
        </div>

        <div className="mt-4">
          <CubeNet facelets={facelets} onPick={paintFacelet} />
        </div>

        <div className="mt-4 grid grid-cols-6 gap-1.5">
          {PALETTE_ORDER.map((face) => {
            const count = counts[face]
            const wrong = count !== 9
            return (
              <div
                key={face}
                className={`rounded-md px-1 py-1.5 text-center transition-colors ${
                  wrong ? 'bg-red-500/15 text-red-300' : 'bg-white/[0.04] text-mist'
                }`}
              >
                <div className="tabular font-mono text-[0.75rem] font-semibold">{count}</div>
                <div
                  className="mx-auto mt-1 h-1 w-4 rounded-full"
                  style={{ background: FACE_THEME[face].hex }}
                />
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-[0.6875rem] text-dim">
          {PALETTE_ORDER.every((face) => counts[face] === 9)
            ? 'Nine of each colour — this could be a real cube.'
            : 'Every colour needs exactly nine stickers.'}
        </p>

        <div className="mt-3 flex gap-2">
          <Button onClick={reset} className="flex-1">
            Reset to solved
          </Button>
        </div>
      </Section>

      <SolveSection />
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                    */
/* -------------------------------------------------------------------------- */

const SHORTCUTS: ReadonlyArray<readonly [readonly string[], string]> = [
  [['U', 'R', 'F', 'D', 'L', 'B'], 'turn that face clockwise'],
  [['Shift', 'U'], 'counter-clockwise'],
  [['Z'], 'undo the last turn'],
  [['N'], 'new scramble'],
  [['Enter'], 'solve'],
  [['Space'], 'play or stop the solution'],
  [['Backspace'], 'reset to solved'],
]

export function SettingsSection() {
  const turnSpeed = useCubeStore((state) => state.turnSpeed)
  const autoRotate = useCubeStore((state) => state.autoRotate)
  const effects = useCubeStore((state) => state.effects)
  const records = useCubeStore((state) => state.records)
  const setTurnSpeed = useCubeStore((state) => state.setTurnSpeed)
  const setAutoRotate = useCubeStore((state) => state.setAutoRotate)
  const setEffects = useCubeStore((state) => state.setEffects)
  const clearRecords = useCubeStore((state) => state.clearRecords)

  return (
    <>
      <Section title="Animation">
        <label className="block">
          <div className="mb-2 flex items-center justify-between text-[0.8125rem]">
            <span className="text-mist">Turn speed</span>
            <span className="tabular font-mono text-[0.75rem] text-chalk">{turnSpeed} ms</span>
          </div>
          <input
            type="range"
            min={50}
            max={420}
            step={10}
            value={turnSpeed}
            onChange={(event) => setTurnSpeed(Number(event.target.value))}
          />
          <div className="mt-1.5 flex justify-between text-[0.625rem] text-dim">
            <span>Snappy</span>
            <span>Study</span>
          </div>
        </label>
      </Section>

      <Section title="Viewport">
        <div className="space-y-1">
          <Toggle label="Slowly rotate the view" checked={autoRotate} onChange={setAutoRotate} />
          <Toggle label="Bloom and vignette" checked={effects} onChange={setEffects} />
        </div>
        <p className="mt-2 text-[0.6875rem] leading-relaxed text-dim">
          Drag the cube to turn a layer. Drag the background to orbit, scroll to zoom.
        </p>
      </Section>

      <Section title="Keyboard">
        <dl className="space-y-1.5 text-[0.75rem]">
          {SHORTCUTS.map(([keys, description]) => (
            <div key={description} className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1">
                {keys.map((key) => (
                  <Key key={key}>{key}</Key>
                ))}
              </dt>
              <dd className="text-right text-dim">{description}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section
        title="Recent solves"
        action={records.length > 0 ? <button onClick={clearRecords} className="focus-ring text-[0.6875rem] text-dim hover:text-chalk">Clear</button> : null}
      >
        {records.length === 0 ? (
          <p className="text-[0.75rem] text-dim">No timed solves yet. Times are kept in this browser only.</p>
        ) : (
          <ol className="space-y-1">
            {records.slice(0, 6).map((record) => (
              <li
                key={record.at}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 text-[0.75rem] odd:bg-white/[0.03]"
              >
                <span className="tabular font-mono text-chalk">{formatTime(record.timeMs)}</span>
                <span className="text-dim">{record.moves} turns</span>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </>
  )
}
