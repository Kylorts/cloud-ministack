import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { register } from '../services/auth'
import './LoginPage.css'
import './RegisterPage.css'

function CloudIcon() {
  return (
    <svg width="36" height="28" viewBox="0 0 36 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M29.25 11.083C29.25 11.083 29.25 11 29.25 10.917C29.25 6.108 25.392 2.25 20.583 2.25C17.667 2.25 15.075 3.717 13.5 5.958C12.708 5.583 11.833 5.333 10.917 5.333C7.667 5.333 5 8 5 11.25C5 11.417 5 11.583 5.017 11.75C3.25 12.583 2 14.4 2 16.5C2 19.533 4.467 22 7.5 22H29.25C31.875 22 34 19.875 34 17.25C34 14.458 31.958 12.158 29.25 11.083Z" fill="#062F28" />
    </svg>
  )
}
function EyeIcon({ open }) {
  return open ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M2.71 3.16a1 1 0 00-.02 1.41L6.3 8.18C4.32 9.5 2.72 11.41 2 13.5c1.73 4.39 6 7.5 11 7.5 2.06 0 3.98-.53 5.65-1.45l3.34 3.34a1 1 0 101.41-1.41L4.12 3.14a1 1 0 00-1.41.02z" fill="#6B7280"/></svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 4.5C7 4.5 2.73 7.61 1 12C2.73 16.39 7 19.5 12 19.5C17 19.5 21.27 16.39 23 12C21.27 7.61 17 4.5 12 4.5ZM12 17C9.24 17 7 14.76 7 12C7 9.24 9.24 7 12 7C14.76 7 17 9.24 17 12C17 14.76 14.76 17 12 17ZM12 9C10.34 9 9 10.34 9 12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12C15 10.34 13.66 9 12 9Z" fill="#6B7280"/></svg>
  )
}
function ArrowRight() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 4L10.59 5.41L16.17 11H4V13H16.17L10.59 18.59L12 20L20 12L12 4Z" fill="#062F28" /></svg>
}

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Kata sandi minimal 8 karakter.'); return }
    setLoading(true)
    try {
      await register(name, email, password)
      navigate('/dashboard')
    } catch (err) {
      const d = err.response?.data?.detail
      setError(Array.isArray(d) ? d[0]?.msg : (typeof d === 'string' ? d : 'Gagal mendaftar, coba lagi.'))
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
          <div className="card-header">
            <h2 className="card-title">Daftar Akun Baru</h2>
            <p className="card-subtitle">Mulai kelola sumber daya cloud Anda secara mandiri.</p>
          </div>

          <form className="reg-form" onSubmit={handleSubmit}>
            <div className="reg-group">
              <label className="reg-label" htmlFor="name">Nama Lengkap</label>
              <input id="name" className="reg-input" type="text" value={name}
                onChange={(e) => setName(e.target.value)} placeholder="Masukkan nama lengkap"
                required autoComplete="name" />
            </div>

            <div className="reg-group">
              <label className="reg-label" htmlFor="email">Alamat Email</label>
              <input id="email" className="reg-input" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="alamat@email.com"
                required autoComplete="email" />
            </div>

            <div className="reg-group">
              <label className="reg-label" htmlFor="password">Kata Sandi</label>
              <div className="reg-input-wrap">
                <input id="password" className="reg-input" type={showPassword ? 'text' : 'password'}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 8 karakter" required autoComplete="new-password" />
                <button type="button" className="reg-eye"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}>
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            <p className="reg-terms">
              Dengan mendaftar, Anda menyetujui Ketentuan Layanan dan Kebijakan Privasi kami.
            </p>

            {error && <div className="error-banner" role="alert">{error}</div>}

            <button type="submit" className={`submit-btn${loading ? ' submit-btn--loading' : ''}`} disabled={loading}>
              <span>{loading ? 'Memproses...' : 'Daftar Sekarang'}</span>
              {!loading && <ArrowRight />}
            </button>
          </form>

          <div className="card-divider" />

          <p className="register-row">
            Sudah memiliki akun?{' '}
            <Link to="/login" className="register-link">Masuk</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
