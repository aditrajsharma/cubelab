/**
 * The cube unfolded, for typing in a physical cube's colours.
 *
 * Each face is drawn exactly as the solver reads it — row by row, looking straight at
 * that face, U read with B at the top and D with F at the top — so the net below is
 * literally the FaceGrid. Unfolding a cube preserves each face's appearance, which is
 * why no face here needs flipping or mirroring.
 */
import type { Face } from '@turnwise/cube-solver'
import { FACE_INDEX } from '../cube/geometry'
import { FACE_THEME } from '../cube/colors'

interface CubeNetProps {
  facelets: readonly Face[]
  /** Called with the facelet index 0..53 that was clicked. */
  onPick?: (facelet: number) => void
  /** Sticker indices to outline, e.g. to point at a problem. */
  highlight?: readonly number[]
}

function FaceGrid({
  face,
  facelets,
  onPick,
  highlight,
}: {
  face: Face
  facelets: readonly Face[]
  onPick?: (facelet: number) => void
  highlight?: readonly number[]
}) {
  const base = FACE_INDEX[face] * 9
  return (
    <div className="grid grid-cols-3 gap-[3px] rounded-[7px] bg-black/45 p-[3px]">
      {Array.from({ length: 9 }, (_, index) => {
        const facelet = base + index
        const isCentre = index === 4
        const colour = FACE_THEME[facelets[facelet]]
        const flagged = highlight?.includes(facelet)
        return (
          <button
            key={index}
            type="button"
            disabled={!onPick || isCentre}
            onClick={() => onPick?.(facelet)}
            title={isCentre ? `${colour.name} centre — never moves` : `${colour.name} sticker`}
            className={`focus-ring aspect-square rounded-[4px] transition-transform ${
              onPick && !isCentre ? 'cursor-pointer hover:z-10 hover:scale-110' : 'cursor-default'
            } ${flagged ? 'ring-2 ring-red-400 ring-offset-1 ring-offset-black' : ''}`}
            style={{
              background: colour.hex,
              boxShadow: `inset 0 -2px 4px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.35)${
                isCentre ? ', inset 0 0 0 1px rgba(0,0,0,0.25)' : ''
              }`,
            }}
          >
            <span className="sr-only">{colour.name}</span>
          </button>
        )
      })}
    </div>
  )
}

export function CubeNet({ facelets, onPick, highlight }: CubeNetProps) {
  return (
    <div data-testid="cube-net" className="grid grid-cols-4 gap-1.5">
      <div className="col-start-2">
        <FaceGrid face="U" facelets={facelets} onPick={onPick} highlight={highlight} />
      </div>
      <FaceGrid face="L" facelets={facelets} onPick={onPick} highlight={highlight} />
      <FaceGrid face="F" facelets={facelets} onPick={onPick} highlight={highlight} />
      <FaceGrid face="R" facelets={facelets} onPick={onPick} highlight={highlight} />
      <FaceGrid face="B" facelets={facelets} onPick={onPick} highlight={highlight} />
      <div className="col-start-2">
        <FaceGrid face="D" facelets={facelets} onPick={onPick} highlight={highlight} />
      </div>
    </div>
  )
}
