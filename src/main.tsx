import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted fonts (no CDN). Font names are mapped to tokens in index.css.
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'
import '@fontsource/space-grotesk/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import './index.css'
import App from './App'
import { loadContent } from '@/content/load'
import { ContentError } from '@/ui/ContentError'

const root = createRoot(document.getElementById('root')!)

// Validate every content JSON file before the first render. A bad field shows a readable
// error panel naming the file and field instead of a blank page.
try {
  loadContent()
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} catch (error) {
  console.error(error)
  root.render(<ContentError error={error} />)
}
