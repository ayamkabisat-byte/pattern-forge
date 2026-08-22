import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './AppV05'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
