import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource/vt323'
import '@fontsource/press-start-2p'
import '@fontsource/orbitron/400.css'
import '@fontsource/orbitron/700.css'
import '@fontsource/share-tech-mono'
import '@fontsource/pixelify-sans'
import '@fontsource/russo-one'
import '@fontsource/jetbrains-mono'
import './index.css'
import './skins.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
