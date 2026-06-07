import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PinInput from './PinInput'
import './PinPromptModal.css'

/**
 * Modal step-up auth: minta PIN Transaksi sebelum aksi kritis.
 *
 * Props:
 *  - open: boolean
 *  - title: judul aksi (mis. "Cabut Access Key")
 *  - description: penjelasan singkat aksi
 *  - error: pesan error eksternal (mis. "PIN salah") — opsional
 *  - busy: boolean (saat aksi sedang diproses)
 *  - onSubmit(pin): dipanggil saat user konfirmasi
 *  - onClose(): tutup modal
 */
export default function PinPromptModal({
  open, title = 'Konfirmasi PIN Transaksi', description,
  error, busy = false, onSubmit, onClose,
}) {
  const [pin, setPin] = useState('')
  const navigate = useNavigate()

  if (!open) return null

  function handleSubmit(e) {
    e.preventDefault()
    if (pin.length !== 6 || busy) return
    onSubmit(pin)
  }

  return (
    <div className="pinmodal-overlay" onClick={() => !busy && onClose()}>
      <form className="pinmodal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="pinmodal-icon">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <rect x="4" y="10" width="16" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.8"/>
            <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            <circle cx="12" cy="15.5" r="1.4" fill="currentColor"/>
          </svg>
        </div>
        <h2 className="pinmodal-title">{title}</h2>
        <p className="pinmodal-desc">
          {description || 'Masukkan PIN Transaksi 6 digit Anda untuk melanjutkan.'}
        </p>

        <PinInput value={pin} onChange={setPin} disabled={busy} autoFocus />

        {error && <div className="pinmodal-error">{error}</div>}

        <button type="submit" className="pinmodal-submit" disabled={pin.length !== 6 || busy}>
          {busy ? 'Memproses...' : 'Konfirmasi'}
        </button>
        <button type="button" className="pinmodal-cancel" onClick={onClose} disabled={busy}>
          Batal
        </button>

        <button
          type="button"
          className="pinmodal-forgot"
          onClick={() => navigate('/keamanan')}
        >
          Lupa PIN? Atur ulang lewat halaman Keamanan
        </button>
      </form>
    </div>
  )
}
