/**
 * The solver throws a different error class for each way a cube can be impossible.
 * Those names are worth showing to the user verbatim: "one edge is flipped" is far
 * more useful than "invalid cube".
 */
import { InvalidCubeError } from '@turnwise/cube-solver'

const MESSAGES: Record<string, string> = {
  StickerCountError: 'Every colour needs exactly nine stickers. The counts below show which are off.',
  UnknownPieceError: 'One corner or edge is showing a combination of colours that no real piece has.',
  DuplicatePieceError: 'The same piece is in two places at once.',
  CornerTwistError: 'A single corner is twisted in place. No legal cube can be in this state.',
  EdgeFlipError: 'A single edge is flipped in place. No legal cube can be in this state.',
  ParityError: 'Two pieces have traded places. Swapping one more pair will make this solvable.',
  FaceletStringError: 'That is not a 54-sticker cube string.',
}

export function describeCubeError(error: unknown): string {
  if (error instanceof InvalidCubeError || (error instanceof Error && error.name in MESSAGES)) {
    return MESSAGES[(error as Error).name] ?? (error as Error).message
  }
  if (error instanceof Error) return error.message
  return String(error)
}
