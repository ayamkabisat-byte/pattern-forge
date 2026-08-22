import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './AppV06'
import './styles.css'
import './v05.css'
import './v06.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
