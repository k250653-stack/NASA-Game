import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
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
