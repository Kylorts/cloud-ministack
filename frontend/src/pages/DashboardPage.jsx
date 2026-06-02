import { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { logout, getStoredUser } from '../services/auth'
import { getMySubscription } from '../services/subscriptions'
import { getBuckets } from '../services/storage'
import './DashboardPage.css'

/* ── Icons ─────────────────────────────────────────────────── */
function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M3 6H21M3 12H21M3 18H21" stroke="#062F28" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M21 21L16.514 16.506M19 10.5C19 15.194 15.194 19 10.5 19C5.806 19 2 15.194 2 10.5C2 5.806 5.806 2 10.5 2C15.194 2 19 5.806 19 10.5Z" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" stroke="#062F28" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function UserIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="#062F28" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="7" r="4" stroke="#062F28" strokeWidth="1.5" />
    </svg>
  )
}
function CloudOutlineIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z" stroke="#062F28" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function PackageIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="#062F28" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" stroke="#062F28" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
function ShieldIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="#062F28" />
      <path d="M9 12l2 2 4-4" stroke="#9FE870" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function ExternalLinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function BucketIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M21 8H3l1.5 11.5A2 2 0 0 0 6.5 21h11a2 2 0 0 0 2-1.5L21 8z" stroke="#062F28" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M21 8a9 9 0 1 0-18 0" stroke="#062F28" strokeWidth="1.5" />
    </svg>
  )
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const gb = bytes / (1024 ** 3)
  if (gb >= 1) return `${parseFloat(gb.toFixed(1))} GB`
  const mb = bytes / (1024 ** 2)
  return `${parseFloat(mb.toFixed(0))} MB`
}

function CircularProgress({ value, size = 140 }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className="circular-progress">
      <circle cx="60" cy="60" r={radius} fill="none" stroke="#E8F5E0" strokeWidth="8" />
      <circle cx="60" cy="60" r={radius} fill="none" stroke="#9FE870" strokeWidth="8"
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 60 60)" />
    </svg>
  )
}

/* ── Page Component ─────────────────────────────────────────── */
export default function DashboardPage() {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [subscription, setSubscription] = useState(null)
  const [buckets, setBuckets] = useState([])
  const dropdownRef = useRef(null)
  const navigate = useNavigate()
  const user = getStoredUser()

  useEffect(() => {
    getMySubscription().then((r) => setSubscription(r.data)).catch(() => {})
    getBuckets().then((r) => setBuckets(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleLogout() { logout(); navigate('/login') }

  const storageLimit = subscription?.plan?.storage_limit_bytes ?? 0
  const storagePercent = 0 // akan diisi saat usage tracking ada
  const activeBuckets = buckets.length
  const bucketLimit = subscription?.plan?.bucket_limit ?? 0
  const bucketPercent = bucketLimit ? Math.round((activeBuckets / bucketLimit) * 100) : 0

  return (
    <div className="dashboard">
      {/* ── Navbar ── */}
      <nav className="navbar">
        <div className="navbar-left">
          <button className="icon-btn" aria-label="Menu"><MenuIcon /></button>
          <span className="navbar-brand">INI AWAN</span>
        </div>
        <div className="navbar-right">
          <div className="search-bar">
            <SearchIcon />
            <input type="text" placeholder="Cari sumber daya..." className="search-input" />
          </div>
          <button className="icon-btn notif-btn" aria-label="Notifikasi">
            <BellIcon /><span className="notif-dot" />
          </button>
          <div className="avatar-wrapper" ref={dropdownRef}>
            <button className="icon-btn avatar-btn" onClick={() => setDropdownOpen((v) => !v)}>
              <UserIcon />
            </button>
            {dropdownOpen && (
              <div className="avatar-dropdown">
                <div className="dropdown-user-info">
                  <span className="dropdown-name">{user?.name ?? 'Pengguna'}</span>
                  <span className="dropdown-email">{user?.email ?? ''}</span>
                  <span className="dropdown-role-badge">{user?.role ?? 'user'}</span>
                </div>
                <div className="dropdown-divider" />
                <button className="dropdown-logout-btn" onClick={handleLogout}>
                  <LogoutIcon /> Keluar
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ── Main Content ── */}
      <main className="main-content">
        <div className="page-header">
          <p className="greeting">Halo, {user?.name ?? 'Pengguna'}</p>
          <h1 className="page-title">Ringkasan Infrastruktur</h1>
          <p className="page-subtitle">Pantau dan kelola layanan cloud Anda dalam satu portal terpadu.</p>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          {/* Storage Card → klik ke /storage */}
          <div className="stat-card stat-card--clickable" onClick={() => navigate('/storage')}>
            <div className="stat-card-header">
              <div>
                <p className="stat-label">Kuota Penyimpanan</p>
                <p className="stat-sublabel">
                  {subscription ? subscription.plan.name : 'Belum berlangganan'}
                </p>
              </div>
              <span className="stat-icon"><CloudOutlineIcon /></span>
            </div>
            <div className="stat-center">
              <div className="stat-progress-wrap">
                <CircularProgress value={storagePercent} />
                <div className="stat-value-overlay">
                  <span className="stat-percent">{storagePercent}%</span>
                  <span className="stat-percent-label">Terpakai</span>
                </div>
              </div>
            </div>
            <div className="stat-footer">
              <div className="stat-footer-item">
                <span className="stat-footer-label">Digunakan</span>
                <span className="stat-footer-value">0 B</span>
              </div>
              <div className="stat-footer-divider" />
              <div className="stat-footer-item">
                <span className="stat-footer-label">Kapasitas</span>
                <span className="stat-footer-value">{formatBytes(storageLimit)}</span>
              </div>
            </div>
          </div>

          {/* Paket & Langganan Card → klik ke /langganan atau /paket */}
          <div
            className="stat-card stat-card--clickable"
            onClick={() => navigate(subscription ? '/langganan' : '/paket')}
          >
            <div className="stat-card-header">
              <div>
                <p className="stat-label">Paket Langganan</p>
                <p className="stat-sublabel">
                  {subscription ? `Aktif hingga ${new Date(subscription.current_period_end).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Pilih paket untuk mulai'}
                </p>
              </div>
              <span className="stat-icon"><PackageIcon /></span>
            </div>
            <div className="stat-center">
              <div className="stat-progress-wrap">
                <CircularProgress value={bucketPercent} />
                <div className="stat-value-overlay">
                  <span className="stat-percent">{activeBuckets}</span>
                  <span className="stat-percent-label">Bucket</span>
                </div>
              </div>
            </div>
            <div className="stat-footer">
              <div className="stat-footer-item">
                <span className="stat-footer-label">Bucket Aktif</span>
                <span className="stat-footer-value">{activeBuckets}</span>
              </div>
              <div className="stat-footer-divider" />
              <div className="stat-footer-item">
                <span className="stat-footer-label">Batas Paket</span>
                <span className="stat-footer-value">{bucketLimit || '-'}</span>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="stats-right-col">
            <div className="stat-card stat-card--dark">
              <div className="network-deco">
                <span className="deco-circle deco-circle--1" />
                <span className="deco-circle deco-circle--2" />
              </div>
              <p className="network-label">Transfer Data Jaringan</p>
              <p className="network-value">0 B / {formatBytes(subscription?.plan?.bandwidth_limit_bytes ?? 0)}</p>
              <p className="network-sub">Kuota bandwidth keluar-masuk bulan ini</p>
              <Link to="/kuota" className="network-link">Lihat Analisis Trafik →</Link>
            </div>
            <div className="stat-card stat-card--accent">
              <div className="security-content">
                <div>
                  <p className="security-label">Status Keamanan</p>
                  <p className="security-value">Sangat Aman</p>
                </div>
                <ShieldIcon />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Grid */}
        <div className="bottom-grid">
          {/* Bucket List */}
          <div className="table-card">
            <div className="table-card-header">
              <h2 className="table-card-title">Object Storage</h2>
              <Link to="/storage" className="table-link">
                Lihat Semua <ExternalLinkIcon />
              </Link>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama Bucket</th>
                  <th>Visibilitas</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {buckets.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: '#9ca3af', fontSize: '13px' }}>
                      Belum ada bucket.{' '}
                      <Link to="/storage" style={{ color: '#062F28', fontWeight: 600 }}>Buat bucket pertama →</Link>
                    </td>
                  </tr>
                ) : (
                  buckets.slice(0, 3).map((b) => (
                    <tr key={b.id}>
                      <td>
                        <div className="resource-name-cell">
                          <span className="resource-dot" />
                          <div>
                            <span className="resource-name">{b.display_name}</span>
                            <span className="resource-id">{b.internal_name}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge badge--${b.visibility === 'public' ? 'ec2' : 'minio'}`}>
                          {b.visibility === 'public' ? 'Publik' : 'Pribadi'}
                        </span>
                      </td>
                      <td className="util-cell">{b.status === 'active' ? '● Aktif' : b.status}</td>
                      <td>
                        <button className="action-btn" onClick={() => navigate(`/storage/buckets/${b.id}`)}>
                          Buka
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Quick Links */}
          <div className="table-card">
            <div className="table-card-header">
              <h2 className="table-card-title">Navigasi Cepat</h2>
            </div>
            <div className="quick-links">
              <Link to="/storage" className="quick-link-item">
                <span className="quick-link-icon"><BucketIcon /></span>
                <div className="quick-link-text">
                  <span className="quick-link-title">Object Storage</span>
                  <span className="quick-link-desc">Kelola bucket dan file Anda</span>
                </div>
                <ExternalLinkIcon />
              </Link>
              <Link to="/paket" className="quick-link-item">
                <span className="quick-link-icon"><PackageIcon /></span>
                <div className="quick-link-text">
                  <span className="quick-link-title">Pilih Paket</span>
                  <span className="quick-link-desc">Lihat dan ubah paket layanan</span>
                </div>
                <ExternalLinkIcon />
              </Link>
              <Link to="/langganan" className="quick-link-item">
                <span className="quick-link-icon"><CloudOutlineIcon /></span>
                <div className="quick-link-text">
                  <span className="quick-link-title">Detail Langganan</span>
                  <span className="quick-link-desc">Status dan periode aktif</span>
                </div>
                <ExternalLinkIcon />
              </Link>
              <Link to="/kuota" className="quick-link-item">
                <span className="quick-link-icon"><ShieldIcon /></span>
                <div className="quick-link-text">
                  <span className="quick-link-title">Penggunaan & Kuota</span>
                  <span className="quick-link-desc">Monitor pemakaian resource</span>
                </div>
                <ExternalLinkIcon />
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="footer">
        <span className="footer-brand">INI AWAN</span>
        <span className="footer-copy">© 2026 INI AWAN.</span>
        <div className="footer-links">
          <a href="#">Dokumentasi</a>
          <a href="#">Privasi</a>
          <a href="#">Syarat &amp; Ketentuan</a>
        </div>
      </footer>
    </div>
  )
}
