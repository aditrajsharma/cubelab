import { AnimatePresence, motion } from 'motion/react'
import type { TabId } from '../TopBar'
import { MovePadSection, PaintSection, PlaySection, SettingsSection, SolveSection } from './sections'

export function ControlPanel({ tab }: { tab: TabId }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        {tab === 'play' && (
          <>
            <PlaySection />
            <SolveSection />
            <MovePadSection />
          </>
        )}
        {tab === 'paint' && <PaintSection />}
        {tab === 'settings' && <SettingsSection />}
      </motion.div>
    </AnimatePresence>
  )
}
