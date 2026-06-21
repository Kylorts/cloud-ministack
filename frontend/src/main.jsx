import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

// Jika halaman dipulihkan dari bfcache (tombol Back/Forward browser),
// muat ulang agar selalu memakai bundle & data terbaru — hindari tampilan basi.
window.addEventListener('pageshow', (event) => {
  if (event.persisted) window.location.reload()
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
