import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './AppV062'
import './styles.css'
import './v05.css'
import './v06.css'
import './v061.css'
import './v062.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
