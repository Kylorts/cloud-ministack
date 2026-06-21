import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { resetPassword } from '../services/auth'
import './LoginPage.css'

function CloudIcon() {
  return (
    <svg width="36" height="28" viewBox="0 0 36 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M29.25 11.083C29.25 11.083 29.25 11 29.25 10.917C29.25 6.108 25.392 2.25 20.583 2.25C17.667 2.25 15.075 3.717 13.5 5.958C12.708 5.583 11.833 5.333 10.917 5.333C7.667 5.333 5 8 5 11.25C5 11.417 5 11.583 5.017 11.75C3.25 12.583 2 14.4 2 16.5C2 19.533 4.467 22 7.5 22H29.25C31.875 22 34 19.875 34 17.25C34 14.458 31.958 12.158 29.25 11.083Z" fill="#062F28" />
    </svg>
  )
}
function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17 8H16V6C16 3.791 14.209 2 12 2C9.791 2 8 3.791 8 6V8H7C5.897 8 5 8.897 5 10V20C5 21.103 5.897 22 7 22H17C18.103 22 19 21.103 19 20V10C19 8.897 18.103 8 17 8ZM10 6C10 4.897 10.897 4 12 4C13.103 4 14 4.897 14 6V8H10V6ZM17 20H7V10H17V20Z" fill="#6B7280" />
      <circle cx="12" cy="15" r="2" fill="#6B7280" />
    </svg>
  )
}

export default function ResetSandiPage() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (pw.length < 8) return setError('Kata sandi minimal 8 karakter.')
    if (pw !== pw2) return setError('Konfirmasi kata sandi tidak cocok.')
    setLoading(true)
    try {
      await resetPassword(token, pw)
      setDone(true)
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      const d = err.response?.data?.detail
      setError(typeof d === 'string' ? d : 'Tautan tidak valid atau telah kedaluwarsa.')
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
          {!token ? (
            <div className="card-header">
              <h2 className="card-title">Tautan tidak lengkap</h2>
              <p className="card-subtitle">Token reset tidak ditemukan. Minta tautan baru.</p>
              <Link to="/lupa-sandi" className="submit-btn" style={{ textDecoration: 'none', marginTop: 16 }}>
                <span>Minta tautan baru</span>
              </Link>
            </div>
          ) : done ? (
            <div className="card-header">
              <h2 className="card-title">Kata sandi diperbarui ✓</h2>
              <p className="card-subtitle">Mengarahkan ke halaman masuk...</p>
            </div>
          ) : (
            <>
              <div className="card-header">
                <h2 className="card-title">Atur kata sandi baru</h2>
                <p className="card-subtitle">Buat kata sandi baru untuk akun Anda.</p>
              </div>
              <form className="login-form" onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label" htmlFor="pw">Kata Sandi Baru</label>
                  <div className="input-wrapper">
                    <span className="input-icon input-icon--left"><LockIcon /></span>
                    <input id="pw" className="form-input" type="password" value={pw}
                      onChange={(e) => setPw(e.target.value)} placeholder="••••••••" required
                      minLength={8} autoComplete="new-password" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="pw2">Ulangi Kata Sandi</label>
                  <div className="input-wrapper">
                    <span className="input-icon input-icon--left"><LockIcon /></span>
                    <input id="pw2" className="form-input" type="password" value={pw2}
                      onChange={(e) => setPw2(e.target.value)} placeholder="••••••••" required
                      minLength={8} autoComplete="new-password" />
                  </div>
                </div>

                {error && <div className="error-banner" role="alert">{error}</div>}

                <button type="submit" className={`submit-btn${loading ? ' submit-btn--loading' : ''}`} disabled={loading}>
                  <span>{loading ? 'Menyimpan...' : 'Simpan kata sandi'}</span>
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
