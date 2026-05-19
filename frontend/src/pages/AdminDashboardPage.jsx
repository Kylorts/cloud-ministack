import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { logout, getStoredUser } from '../services/auth'
import './AdminDashboardPage.css'

/* ── Dummy Data ───────────────────────────────────────────── */
const DUMMY_INSTANCES = [
  { id: 1, name: 'prod-web-server-01', instance_id: 'i-04d9c82e7', owner_name: 'Dika', instance_type: 'EC2', utilization: '14% CPU', node: 'Node-A', status: 'running' },
  { id: 2, name: 'user-assets-storage', instance_id: 'minio-assets-01', owner_name: 'Admin-System', instance_type: 'MinIO', utilization: '99% Health', node: 'Node-B', status: 'running' },
]

const DUMMY_API_CREDENTIALS = [
  { id: 1, name: 'prod-web-server-01', instance_id: 'i-04d9c82e7', owner_name: 'Dika', instance_type: 'EC2', utilization: '14% CPU', node: 'Node-A' },
  { id: 2, name: 'user-assets-storage', instance_id: 'minio-assets-01', owner_name: 'Admin-System', instance_type: 'MinIO', utilization: '99% Health', node: 'Node-B' },
]

const DUMMY_STATS = {
  uptime_percent: 99.9,
  physical_nodes_healthy: 4,
  active_users: 128,
  total_instances: 420,
}


/* ── Icons ────────────────────────────────────────────────── */
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
function HelpIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="#062F28" strokeWidth="1.5" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" stroke="#062F28" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="17" r="0.5" fill="#062F28" stroke="#062F28" />
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
function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function ServerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="8" rx="2" stroke="#062F28" strokeWidth="1.5" />
      <rect x="2" y="14" width="20" height="8" rx="2" stroke="#062F28" strokeWidth="1.5" />
      <circle cx="6" cy="6" r="1" fill="#062F28" />
      <circle cx="6" cy="18" r="1" fill="#062F28" />
    </svg>
  )
}
function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="#062F28" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="9" cy="7" r="4" stroke="#062F28" strokeWidth="1.5" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="#062F28" strokeWidth="1.5" strokeLinecap="round" />
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
function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/* ── Decorative Bar Chart ─────────────────────────────────── */
function BarChartDeco() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" opacity="0.15">
      <rect x="4" y="40" width="14" height="36" rx="3" fill="#062F28" />
      <rect x="24" y="24" width="14" height="52" rx="3" fill="#062F28" />
      <rect x="44" y="12" width="14" height="64" rx="3" fill="#062F28" />
      <rect x="64" y="32" width="14" height="44" rx="3" fill="#062F28" />
    </svg>
  )
}


/* ── Page Component ───────────────────────────────────────── */
export default function AdminDashboardPage() {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const stats = DUMMY_STATS
  const instances = DUMMY_INSTANCES
  const apiKeys = DUMMY_API_CREDENTIALS
  const dropdownRef = useRef(null)
  const navigate = useNavigate()
  const user = getStoredUser()
  const displayName = user?.name ?? 'Administrator'

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="adm-page">

      {/* ── Navbar ── */}
      <nav className="adm-navbar">
        <div className="adm-navbar-left">
          <button className="adm-icon-btn" aria-label="Menu"><MenuIcon /></button>
          <div className="adm-brand-group">
            <span className="adm-brand">INI AWAN</span>
            <span className="adm-brand-sub">Infrastruktur Node</span>
          </div>
        </div>
        <div className="adm-navbar-right">
          <div className="adm-search-bar">
            <SearchIcon />
            <input type="text" placeholder="Cari sumber daya..." className="adm-search-input" />
          </div>
          <button className="adm-icon-btn" aria-label="Bantuan"><HelpIcon /></button>
          <button className="adm-icon-btn adm-notif-btn" aria-label="Notifikasi">
            <BellIcon />
            <span className="adm-notif-dot" />
          </button>
          <div className="adm-avatar-wrapper" ref={dropdownRef}>
            <button className="adm-icon-btn adm-avatar-btn" onClick={() => setDropdownOpen(v => !v)} aria-label="Profil">
              <UserIcon />
            </button>
            {dropdownOpen && (
              <div className="adm-dropdown">
                <div className="adm-dropdown-info">
                  <span className="adm-dropdown-name">{displayName}</span>
                  <span className="adm-dropdown-email">{user?.email ?? ''}</span>
                  <span className="adm-dropdown-badge">{user?.role ?? 'admin'}</span>
                </div>
                <div className="adm-dropdown-divider" />
                <button className="adm-dropdown-logout" onClick={handleLogout}>
                  <LogoutIcon /> Keluar
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ── Main Content ── */}
      <main className="adm-main">

        {/* Page Header */}
        <div className="adm-header">
          <p className="adm-header-pre">Selamat Datang Kembali, {displayName}</p>
          <h1 className="adm-header-title">Halo, {displayName}</h1>
          <p className="adm-header-sub">Pantau dan kelola seluruh infrastruktur sistem dari satu panel terpadu.</p>
        </div>

        {/* Stats Grid */}
        <div className="adm-stats-grid">

          {/* Node Server Status */}
          <div className="adm-stat-card">
            <div className="adm-stat-head">
              <div>
                <p className="adm-stat-label">Status Node Server</p>
                <p className="adm-stat-sublabel">Kesehatan infrastruktur fisik</p>
              </div>
              <span className="adm-stat-icon"><ServerIcon /></span>
            </div>
            <div className="adm-stat-center">
              <span className="adm-stat-big">{stats.uptime_percent}%</span>
              <span className="adm-stat-unit">Uptime</span>
            </div>
            <div className="adm-stat-footer-text">{stats.physical_nodes_healthy} Physical Nodes Healthy</div>
          </div>

          {/* Active Users */}
          <div className="adm-stat-card">
            <div className="adm-stat-head">
              <div>
                <p className="adm-stat-label">Total Pengguna Aktif</p>
                <p className="adm-stat-sublabel">Pengguna dalam sistem saat ini</p>
              </div>
              <span className="adm-stat-icon"><UsersIcon /></span>
            </div>
            <div className="adm-stat-center">
              <span className="adm-stat-big">{stats.active_users}</span>
              <span className="adm-stat-unit">Pengguna Aktif</span>
            </div>
          </div>

          {/* Global Resources */}
          <div className="adm-stat-card adm-stat-card--resource">
            <div className="adm-resource-deco"><BarChartDeco /></div>
            <div className="adm-resource-content">
              <p className="adm-resource-label">Total Resource Global</p>
              <p className="adm-resource-big">{stats.total_instances} Instans</p>
              <p className="adm-resource-sub">Berjalan di Seluruh Sistem</p>
            </div>
          </div>

        </div>

        {/* Bottom Grid */}
        <div className="adm-bottom-grid">

          {/* Instance Management */}
          <div className="adm-table-card">
            <div className="adm-table-header">
              <h2 className="adm-table-title">Manajemen Seluruh Instans</h2>
              <a href="#" className="adm-table-link">Lihat Semua <ExternalLinkIcon /></a>
            </div>
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Nama Instans</th>
                  <th>Pemilik (User)</th>
                  <th>Tipe</th>
                  <th>Utilitas Node</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {instances.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="adm-name-cell">
                        <span className="adm-resource-dot" />
                        <div>
                          <span className="adm-instance-name">{r.name}</span>
                          <span className="adm-instance-id">ID: {r.instance_id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="adm-owner-cell">{r.owner_name}</td>
                    <td><span className={`adm-badge adm-badge--${r.instance_type.toLowerCase()}`}>{r.instance_type}</span></td>
                    <td className="adm-util-cell">{r.utilization} / {r.node}</td>
                    <td><button className="adm-action-btn">Kelola</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* API System Credentials */}
          <div className="adm-table-card">
            <div className="adm-table-header">
              <h2 className="adm-table-title">Kredensial API Sistem</h2>
              <button className="adm-new-btn"><PlusIcon /> Buat Kunci Baru</button>
            </div>
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Nama Instans</th>
                  <th>Pemilik (User)</th>
                  <th>Tipe</th>
                  <th>Utilitas Node</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map((k) => (
                  <tr key={k.id}>
                    <td>
                      <div className="adm-name-cell">
                        <span className="adm-resource-dot" />
                        <div>
                          <span className="adm-instance-name">{k.name}</span>
                          <span className="adm-instance-id">ID: {k.instance_id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="adm-owner-cell">{k.owner_name}</td>
                    <td><span className={`adm-badge adm-badge--${k.instance_type.toLowerCase()}`}>{k.instance_type}</span></td>
                    <td className="adm-util-cell">{k.utilization} / {k.node}</td>
                    <td><button className="adm-action-btn">Kelola</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="adm-footer">
        <span className="adm-footer-brand">INI AWAN</span>
        <span className="adm-footer-copy">© 2026 INI AWAN.</span>
        <div className="adm-footer-links">
          <a href="#">Dokumentasi</a>
          <a href="#">Privasi</a>
          <a href="#">Syarat &amp; Ketentuan</a>
        </div>
      </footer>

    </div>
  )
}
