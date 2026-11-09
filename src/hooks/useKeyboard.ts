import { useEffect } from 'react'
import type { Face } from '@turnwise/cube-solver'
import { moveOf } from '../cube/moves'
import { useCubeStore } from '../state/useCubeStore'

const MOVE_KEYS = 'urfdlb'

/** Global shortcuts. Ignored while typing in a field. */
export function useKeyboard() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }

      const store = useCubeStore.getState()
      const key = event.key.toLowerCase()

      if (key.length === 1 && MOVE_KEYS.includes(key)) {
        store.enqueue([moveOf(key.toUpperCase() as Face, event.shiftKey ? 3 : 1)])
        event.preventDefault()
        return
      }

      switch (key) {
        case 'z':
          store.undo()
          break
        case 'n':
          void store.newScramble()
          break
        case 'enter':
          void store.solveCube()
          break
        case ' ':
          event.preventDefault()
          if (store.queue.length > 0) store.stopPlayback()
          else store.playSolution()
          break
        case 'backspace':
          event.preventDefault()
          store.reset()
          break
        case 'escape':
          store.stopPlayback()
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
