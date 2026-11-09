import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { useCubeStore } from './state/useCubeStore'

// Handy in the console while developing, and what the runtime check reads.
if (import.meta.env.DEV) {
  ;(window as unknown as Record<string, unknown>).__cubelab = useCubeStore
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
