import { useState, useRef, useEffect, useCallback } from 'react'
import { parseUTC } from '../utils/datetime'
import { useNavigate, Link } from 'react-router-dom'
import { logout, getStoredUser } from '../services/auth'
import Sidebar from '../components/Sidebar'
import { getMySubscription, getSubscriptionHistory, categoryState, everSubscribed } from '../services/subscriptions'
import { getBuckets, getStorageUsage } from '../services/storage'
import { getHostingUsage, getSites } from '../services/hosting'
import { getAccessKeys } from '../services/accessKeys'
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
function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="#062F28" strokeWidth="1.5" />
      <path d="M12 7v5l3 2" stroke="#062F28" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function GlobeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="#062F28" strokeWidth="1.5" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" stroke="#062F28" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
function KeyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3" stroke="#062F28" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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

/* ── Modal Belum Berlangganan ───────────────────────────────── */
function NoSubModal({ serviceName = 'layanan ini', onClose, onGoToPaket }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-x" onClick={onClose} aria-label="Tutup">✕</button>
        <div className="modal-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="#062F28" strokeWidth="1.5"/>
            <path d="M12 8v4M12 16h.01" stroke="#062F28" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <h3 className="modal-heading">Belum Berlangganan</h3>
        <p className="modal-desc">
          Anda perlu memilih paket layanan terlebih dahulu untuk menggunakan {serviceName}.
        </p>
        <button className="modal-btn-primary modal-btn-full" onClick={onGoToPaket}>Pilih Paket</button>
      </div>
    </div>
  )
}

/* ── Page Component ─────────────────────────────────────────── */
export default function DashboardPage() {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [subscription, setSubscription] = useState(null)
  const [buckets, setBuckets] = useState([])
  const [noSubModal, setNoSubModal] = useState(null) // { serviceName, paketPath } | null
  const [usage, setUsage] = useState(null)
  const [hostingUsage, setHostingUsage] = useState(null)
  const [sites, setSites] = useState([])
  const [storageKeys, setStorageKeys] = useState([])
  const [hostingKeys, setHostingKeys] = useState([])
  const [subHistory, setSubHistory] = useState([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const dropdownRef = useRef(null)
  const navigate = useNavigate()
  const user = getStoredUser()

  useEffect(() => {
    getMySubscription().then((r) => setSubscription(r.data)).catch(() => {})
    getBuckets().then((r) => setBuckets(r.data)).catch(() => setBuckets([]))
    getStorageUsage().then((r) => setUsage(r.data)).catch(() => setUsage(null))
    getHostingUsage().then((r) => setHostingUsage(r.data)).catch(() => setHostingUsage(null))
    getSites().then((r) => setSites(r.data)).catch(() => setSites([]))
    getAccessKeys('storage').then((r) => setStorageKeys(r.data)).catch(() => setStorageKeys([]))
    getAccessKeys('hosting').then((r) => setHostingKeys(r.data)).catch(() => setHostingKeys([]))
    getSubscriptionHistory().then((r) => setSubHistory(r.data)).catch(() => setSubHistory([]))
  }, [])

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleLogout() { logout(); navigate('/login') }

  // State per kategori: 'active' | 'dormant' | 'none'
  const storageState = categoryState(subHistory, 'storage')
  const hostingState = categoryState(subHistory, 'hosting')
  const hasSubscribed = everSubscribed(subHistory)

  function handleStorageClick(e) {
    e.preventDefault()
    if (storageState === 'none') {
      setNoSubModal({ serviceName: 'Object Storage', paketPath: '/paket' })
    } else {
      navigate('/storage') // aktif atau dorman → halaman menampilkan keadaannya
    }
  }

  function handleHostingClick(e) {
    e.preventDefault()
    if (hostingState === 'none') {
      setNoSubModal({ serviceName: 'Static Hosting', paketPath: '/paket?kategori=hosting' })
    } else {
      navigate('/hosting')
    }
  }

  const storageLimit = usage?.storage_limit_bytes ?? subscription?.plan?.storage_limit_bytes ?? 0
  const storageUsed = usage?.storage_used_bytes ?? 0
  const storagePercent = usage?.storage_percent ?? 0
  const activeBuckets = buckets.length
  const bucketLimit = usage?.bucket_limit ?? subscription?.plan?.bucket_limit ?? 0
  const bucketPercent = bucketLimit ? Math.round((activeBuckets / bucketLimit) * 100) : 0

  return (
    <div className="dashboard">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {/* ── Navbar ── */}
      <nav className="navbar">
        <div className="navbar-left">
          <button className="icon-btn" aria-label="Menu" onClick={() => setSidebarOpen(true)}><MenuIcon /></button>
          <span className="navbar-brand">JADESTACK</span>
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
          <div className="stat-card stat-card--clickable" onClick={handleStorageClick}>
            <div className="stat-card-header">
              <div>
                <p className="stat-label">Kuota Penyimpanan</p>
                <p className="stat-sublabel">
                  {subscription ? subscription.plan.name
                    : storageState === 'dormant' ? 'Langganan dihentikan (dorman)'
                    : 'Belum berlangganan'}
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
                <span className="stat-footer-value">{formatBytes(storageUsed)}</span>
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
                  {subscription ? `Aktif hingga ${parseUTC(subscription.current_period_end).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Pilih paket untuk mulai'}
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
              <p className="network-label">Bandwidth Hosting</p>
              <p className="network-value">
                {formatBytes(hostingUsage?.bandwidth_used_bytes ?? 0)} / {formatBytes(hostingUsage?.bandwidth_limit_bytes ?? 0)}
              </p>
              <p className="network-sub">
                {hostingUsage ? 'Trafik situs statis bulan ini' : 'Belum berlangganan hosting'}
              </p>
              <Link to="/hosting" className="network-link">Kelola Hosting →</Link>
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
         <div className="bottom-left-col">
          {/* Bucket List */}
          <div className="table-card">
            <div className="table-card-header">
              <h2 className="table-card-title">Object Storage</h2>
              {subscription && (
                <Link to="/storage" className="table-link">
                  Lihat Semua <ExternalLinkIcon />
                </Link>
              )}
            </div>
            {!subscription ? (
              <div className="table-no-sub">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="#d1d5db" strokeWidth="1.5"/>
                </svg>
                {storageState === 'dormant' ? (
                  <>
                    <p className="table-no-sub-text">Langganan dihentikan — layanan dorman.</p>
                    <button className="table-no-sub-btn" onClick={() => navigate('/paket')}>Berlangganan Lagi →</button>
                  </>
                ) : (
                  <>
                    <p className="table-no-sub-text">Anda belum berlangganan.</p>
                    <button className="table-no-sub-btn" onClick={() => navigate('/paket')}>Pilih Paket →</button>
                  </>
                )}
              </div>
            ) : (
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
                          <button className="action-btn" onClick={() => navigate(`/storage/buckets/${b.display_name}`)}>
                            Buka
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Static Hosting List */}
          <div className="table-card">
            <div className="table-card-header">
              <h2 className="table-card-title">Static Hosting</h2>
              {hostingUsage && (
                <Link to="/hosting" className="table-link">Lihat Semua <ExternalLinkIcon /></Link>
              )}
            </div>
            {!hostingUsage ? (
              <div className="table-no-sub">
                <GlobeIcon />
                {hostingState === 'dormant' ? (
                  <>
                    <p className="table-no-sub-text">Langganan hosting dihentikan — dorman.</p>
                    <button className="table-no-sub-btn" onClick={() => navigate('/paket?kategori=hosting')}>Berlangganan Lagi →</button>
                  </>
                ) : (
                  <>
                    <p className="table-no-sub-text">Belum berlangganan hosting.</p>
                    <button className="table-no-sub-btn" onClick={() => navigate('/paket?kategori=hosting')}>Pilih Paket →</button>
                  </>
                )}
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th>Nama Situs</th><th>Status</th><th>Aksi</th></tr>
                </thead>
                <tbody>
                  {sites.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', padding: '24px', color: '#9ca3af', fontSize: '13px' }}>
                        Belum ada situs.{' '}
                        <Link to="/hosting" style={{ color: '#062F28', fontWeight: 600 }}>Buat situs pertama →</Link>
                      </td>
                    </tr>
                  ) : (
                    sites.slice(0, 3).map((s) => (
                      <tr key={s.id}>
                        <td>
                          <div className="resource-name-cell">
                            <span className="resource-dot" />
                            <div>
                              <span className="resource-name">{s.site_name}</span>
                              <span className="resource-id">{s.slug}</span>
                            </div>
                          </div>
                        </td>
                        <td className="util-cell">{s.status === 'active' ? '● Aktif' : s.status}</td>
                        <td>
                          <button className="action-btn" onClick={() => navigate(`/hosting/sites/${s.slug}`)}>Kelola</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Access Keys Summary — hanya tampil jika punya minimal 1 langganan */}
          {hasSubscribed && (
            <div className="table-card">
              <div className="table-card-header">
                <h2 className="table-card-title">Access Keys</h2>
                <Link to="/access-keys" className="table-link">Kelola <ExternalLinkIcon /></Link>
              </div>
              <div className="ak-summary">
                <div className="ak-summary-item">
                  <span className="ak-summary-icon"><KeyIcon /></span>
                  <div className="ak-summary-text">
                    <span className="ak-summary-label">Storage</span>
                    <span className="ak-summary-count">{storageKeys.filter((k) => k.status === 'active').length} kunci aktif</span>
                  </div>
                </div>
                <div className="ak-summary-divider" />
                <div className="ak-summary-item">
                  <span className="ak-summary-icon"><KeyIcon /></span>
                  <div className="ak-summary-text">
                    <span className="ak-summary-label">Hosting</span>
                    <span className="ak-summary-count">{hostingKeys.filter((k) => k.status === 'active').length} kunci aktif</span>
                  </div>
                </div>
              </div>
            </div>
          )}
         </div>

          {/* Quick Links */}
          <div className="table-card">
            <div className="table-card-header">
              <h2 className="table-card-title">Navigasi Cepat</h2>
            </div>
            <div className="quick-links">
              <a href="/storage" className="quick-link-item" onClick={handleStorageClick}>
                <span className="quick-link-icon"><BucketIcon /></span>
                <div className="quick-link-text">
                  <span className="quick-link-title">Object Storage</span>
                  <span className="quick-link-desc">Kelola bucket dan file Anda</span>
                </div>
                <ExternalLinkIcon />
              </a>
              <a href="/hosting" className="quick-link-item" onClick={handleHostingClick}>
                <span className="quick-link-icon"><GlobeIcon /></span>
                <div className="quick-link-text">
                  <span className="quick-link-title">Static Hosting</span>
                  <span className="quick-link-desc">Deploy dan kelola website statis</span>
                </div>
                <ExternalLinkIcon />
              </a>
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
              {hasSubscribed && (
                <Link to="/access-keys" className="quick-link-item">
                  <span className="quick-link-icon"><KeyIcon /></span>
                  <div className="quick-link-text">
                    <span className="quick-link-title">Access Keys</span>
                    <span className="quick-link-desc">Kredensial akses programatik</span>
                  </div>
                  <ExternalLinkIcon />
                </Link>
              )}
              {subscription && (
                <Link to="/kuota" className="quick-link-item">
                  <span className="quick-link-icon"><ShieldIcon /></span>
                  <div className="quick-link-text">
                    <span className="quick-link-title">Penggunaan & Kuota</span>
                    <span className="quick-link-desc">Monitor pemakaian resource</span>
                  </div>
                  <ExternalLinkIcon />
                </Link>
              )}
              <Link to="/aktivitas" className="quick-link-item">
                <span className="quick-link-icon"><ClockIcon /></span>
                <div className="quick-link-text">
                  <span className="quick-link-title">Log Aktivitas</span>
                  <span className="quick-link-desc">Riwayat aktivitas akun Anda</span>
                </div>
                <ExternalLinkIcon />
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="footer">
        <span className="footer-brand">JADESTACK</span>
        <span className="footer-copy">© 2026 JADESTACK.</span>
        <div className="footer-links">
          <a href="#">Dokumentasi</a>
          <a href="#">Privasi</a>
          <a href="#">Syarat &amp; Ketentuan</a>
        </div>
      </footer>

      {noSubModal && (
        <NoSubModal
          serviceName={noSubModal.serviceName}
          onClose={() => setNoSubModal(null)}
          onGoToPaket={() => navigate(noSubModal.paketPath)}
        />
      )}
    </div>
  )
}
