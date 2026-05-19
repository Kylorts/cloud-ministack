import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../services/auth'
import './LoginPage.css'

function CloudIcon() {
  return (
    <svg width="36" height="28" viewBox="0 0 36 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M29.25 11.083C29.25 11.083 29.25 11 29.25 10.917C29.25 6.108 25.392 2.25 20.583 2.25C17.667 2.25 15.075 3.717 13.5 5.958C12.708 5.583 11.833 5.333 10.917 5.333C7.667 5.333 5 8 5 11.25C5 11.417 5 11.583 5.017 11.75C3.25 12.583 2 14.4 2 16.5C2 19.533 4.467 22 7.5 22H29.25C31.875 22 34 19.875 34 17.25C34 14.458 31.958 12.158 29.25 11.083Z"
        fill="#062F28"
      />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M20 4H4C2.897 4 2 4.897 2 6V18C2 19.103 2.897 20 4 20H20C21.103 20 22 19.103 22 18V6C22 4.897 21.103 4 20 4ZM20 6L12 11L4 6H20ZM4 18V7.873L12 13L20 7.873V18H4Z"
        fill="#6B7280"
      />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M17 8H16V6C16 3.791 14.209 2 12 2C9.791 2 8 3.791 8 6V8H7C5.897 8 5 8.897 5 10V20C5 21.103 5.897 22 7 22H17C18.103 22 19 21.103 19 20V10C19 8.897 18.103 8 17 8ZM10 6C10 4.897 10.897 4 12 4C13.103 4 14 4.897 14 6V8H10V6ZM17 20H7V10H17V20Z"
        fill="#6B7280"
      />
      <circle cx="12" cy="15" r="2" fill="#6B7280" />
    </svg>
  )
}

function EyeIcon({ open }) {
  if (!open) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M12 4.5C7 4.5 2.73 7.61 1 12C2.73 16.39 7 19.5 12 19.5C17 19.5 21.27 16.39 23 12C21.27 7.61 17 4.5 12 4.5ZM12 17C9.24 17 7 14.76 7 12C7 9.24 9.24 7 12 7C14.76 7 17 9.24 17 12C17 14.76 14.76 17 12 17ZM12 9C10.34 9 9 10.34 9 12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12C15 10.34 13.66 9 12 9Z"
          fill="#6B7280"
        />
      </svg>
    )
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M2.71 3.16a1 1 0 00-.02 1.41L6.3 8.18C4.32 9.5 2.72 11.41 2 13.5c1.73 4.39 6 7.5 11 7.5 2.06 0 3.98-.53 5.65-1.45l3.34 3.34a1 1 0 101.41-1.41L4.12 3.14a1 1 0 00-1.41.02zM12 18.5c-3.79 0-7.17-2.13-8.82-5.5.64-1.29 1.56-2.4 2.66-3.28l1.97 1.97A4 4 0 0012 17c.36 0 .72-.05 1.06-.14l1.43 1.43c-.76.2-1.55.31-2.36.25C12.09 18.5 12.04 18.5 12 18.5zm7.36-.26l-3.28-3.28A4 4 0 0012 9c-.36 0-.72.05-1.06.14L9.51 7.71A9.38 9.38 0 0112 7.5c3.79 0 7.17 2.13 8.82 5.5a10.05 10.05 0 01-2.12 3.18l-.59.56.01.01-.76-.01z"
        fill="#6B7280"
      />
    </svg>
  )
}

function ArrowRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 4L10.59 5.41L16.17 11H4V13H16.17L10.59 18.59L12 20L20 12L12 4Z" fill="#062F28" />
    </svg>
  )
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberDevice, setRememberDevice] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await login(email, password)
      navigate(data.user.role === 'admin' ? '/admin' : '/dashboard')
    } catch (err) {
      const msg = err.response?.data?.detail || 'Terjadi kesalahan, coba lagi.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-wrapper">
        {/* App Branding */}
        <div className="app-branding">
          <div className="app-icon">
            <CloudIcon />
          </div>
          <h1 className="app-name">INI AWAN</h1>
        </div>

        {/* Login Card */}
        <div className="login-card">
          <div className="card-header">
            <h2 className="card-title">Masuk Portal</h2>
            <p className="card-subtitle">Kelola sumber daya virtual Anda sendiri</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            {/* Email Field */}
            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Alamat Email
              </label>
              <div className="input-wrapper">
                <span className="input-icon input-icon--left">
                  <MailIcon />
                </span>
                <input
                  id="email"
                  className="form-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@perusahaan.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="form-group">
              <div className="label-row">
                <label className="form-label" htmlFor="password">
                  Kata Sandi
                </label>
                <a href="#" className="forgot-link">Lupa kata sandi?</a>
              </div>
              <div className="input-wrapper">
                <span className="input-icon input-icon--left">
                  <LockIcon />
                </span>
                <input
                  id="password"
                  className="form-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="input-icon input-icon--right toggle-eye"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            {/* Remember Device */}
            <label className="remember-row" htmlFor="remember">
              <span className="custom-checkbox">
                <input
                  id="remember"
                  type="checkbox"
                  checked={rememberDevice}
                  onChange={(e) => setRememberDevice(e.target.checked)}
                />
                <span className="checkbox-box" />
              </span>
              <span className="remember-label">Ingat perangkat ini</span>
            </label>

            {/* Error Message */}
            {error && (
              <div className="error-banner" role="alert">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className={`submit-btn${loading ? ' submit-btn--loading' : ''}`}
              disabled={loading}
            >
              <span>{loading ? 'Memproses...' : 'Masuk ke Dashboard'}</span>
              {!loading && <ArrowRight />}
            </button>
          </form>

          <div className="card-divider" />

          <p className="register-row">
            Belum memiliki akun?{' '}
            <a href="/register" className="register-link">Daftar sekarang</a>
          </p>
        </div>
      </div>
    </div>
  )
}
