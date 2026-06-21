import { useState } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../services/auth'
import './LoginPage.css'

function CloudIcon() {
  return (
    <svg width="36" height="28" viewBox="0 0 36 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M29.25 11.083C29.25 11.083 29.25 11 29.25 10.917C29.25 6.108 25.392 2.25 20.583 2.25C17.667 2.25 15.075 3.717 13.5 5.958C12.708 5.583 11.833 5.333 10.917 5.333C7.667 5.333 5 8 5 11.25C5 11.417 5 11.583 5.017 11.75C3.25 12.583 2 14.4 2 16.5C2 19.533 4.467 22 7.5 22H29.25C31.875 22 34 19.875 34 17.25C34 14.458 31.958 12.158 29.25 11.083Z" fill="#062F28" />
    </svg>
  )
}
function MailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 4H4C2.897 4 2 4.897 2 6V18C2 19.103 2.897 20 4 20H20C21.103 20 22 19.103 22 18V6C22 4.897 21.103 4 20 4ZM20 6L12 11L4 6H20ZM4 18V7.873L12 13L20 7.873V18H4Z" fill="#6B7280" />
    </svg>
  )
}

export default function LupaSandiPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await forgotPassword(email)
      setSent(true)
    } catch (err) {
      setError(err.response ? 'Terjadi kesalahan. Coba lagi.' : 'Tidak dapat terhubung ke server.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-wrapper">
        <div className="app-branding">
          <div className="app-icon"><CloudIcon /></div>
          <h1 className="app-name">JADESTACK</h1>
        </div>

        <div className="login-card">
          {sent ? (
            <>
              <div className="card-header">
                <h2 className="card-title">Cek email Anda</h2>
                <p className="card-subtitle">
                  Jika email terdaftar, kami telah mengirim tautan untuk mengatur ulang kata sandi.
                  Tautan berlaku 30 menit.
                </p>
              </div>
              <div className="error-banner" style={{ background: '#eef9e7', color: '#2f5d12', border: '1px solid #cdeeb0' }}>
                💡 Demo lokal: email tertangkap di inbox Mailpit →{' '}
                <a href="http://localhost:8025" target="_blank" rel="noreferrer" style={{ color: '#2f5d12', fontWeight: 600 }}>localhost:8025</a>
              </div>
              <Link to="/login" className="submit-btn" style={{ textDecoration: 'none', marginTop: 16 }}>
                <span>Kembali ke Masuk</span>
              </Link>
            </>
          ) : (
            <>
              <div className="card-header">
                <h2 className="card-title">Lupa kata sandi?</h2>
                <p className="card-subtitle">Masukkan email akun Anda — kami kirim tautan untuk mengaturnya ulang.</p>
              </div>
              <form className="login-form" onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label" htmlFor="email">Alamat Email</label>
                  <div className="input-wrapper">
                    <span className="input-icon input-icon--left"><MailIcon /></span>
                    <input
                      id="email" className="form-input" type="email" value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nama@perusahaan.com" required autoComplete="email"
                    />
                  </div>
                </div>

                {error && <div className="error-banner" role="alert">{error}</div>}

                <button type="submit" className={`submit-btn${loading ? ' submit-btn--loading' : ''}`} disabled={loading}>
                  <span>{loading ? 'Mengirim...' : 'Kirim tautan reset'}</span>
                </button>
              </form>

              <div className="card-divider" />
              <p className="register-row">
                Ingat kata sandi?{' '}
                <Link to="/login" className="register-link">Masuk</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
