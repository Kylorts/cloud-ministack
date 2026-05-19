import { useState } from 'react'
import './DashboardPage.css'

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
function CloudOutlineIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z" stroke="#062F28" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function CpuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="4" width="16" height="16" rx="2" stroke="#062F28" strokeWidth="1.5" />
      <rect x="9" y="9" width="6" height="6" stroke="#062F28" strokeWidth="1.5" />
      <path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" stroke="#062F28" strokeWidth="1.5" strokeLinecap="round" />
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
function EyeOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
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
function KeyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" stroke="#062F28" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ── Static Data ──────────────────────────────────────────── */
const virtualResources = [
  {
    id: 'i-04d9c82e7',
    name: 'prod-web-server-01',
    type: 'EC2',
    utilization: '14% CPU / 32% RAM',
    status: 'active',
  },
  {
    id: 'assets-01',
    name: 'user-assets-storage',
    type: 'MinIO',
    utilization: 'Uptime 99.99%',
    status: 'active',
  },
]

const apiCredentials = [
  {
    id: 1,
    name: 'Primary-App-Key',
    created: '24 Sep 2024',
    accessKey: 'AKIA....R4PT',
  },
  {
    id: 2,
    name: 'Staging-Deploy',
    created: '15 Agu 2024',
    accessKey: 'AKIA....M9LL',
  },
]

/* ── Circular Progress SVG ────────────────────────────────── */
function CircularProgress({ value, size = 140 }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className="circular-progress">
      <circle cx="60" cy="60" r={radius} fill="none" stroke="#E8F5E0" strokeWidth="8" />
      <circle
        cx="60" cy="60" r={radius}
        fill="none"
        stroke="#9FE870"
        strokeWidth="8"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 60 60)"
      />
    </svg>
  )
}

/* ── Page Component ───────────────────────────────────────── */
export default function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="dashboard">
      {/* ── Navbar ── */}
      <nav className="navbar">
        <div className="navbar-left">
          <button className="icon-btn" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Menu">
            <MenuIcon />
          </button>
          <span className="navbar-brand">INI AWAN</span>
        </div>
        <div className="navbar-right">
          <div className="search-bar">
            <SearchIcon />
            <input type="text" placeholder="Cari sumber daya..." className="search-input" />
          </div>
          <button className="icon-btn" aria-label="Bantuan"><HelpIcon /></button>
          <button className="icon-btn notif-btn" aria-label="Notifikasi">
            <BellIcon />
            <span className="notif-dot" />
          </button>
          <button className="icon-btn avatar-btn" aria-label="Profil"><UserIcon /></button>
        </div>
      </nav>

      {/* ── Main Content ── */}
      <main className="main-content">

        {/* Page Header */}
        <div className="page-header">
          <p className="greeting">Halo, Dika</p>
          <h1 className="page-title">Ringkasan Infrastruktur</h1>
          <p className="page-subtitle">Pantau dan kelola instans cloud Anda dalam satu portal terpadu.</p>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          {/* Storage Card */}
          <div className="stat-card">
            <div className="stat-card-header">
              <div>
                <p className="stat-label">Kuota Penyimpanan</p>
                <p className="stat-sublabel">Total kapasitas AWS S3 &amp; MinIO</p>
              </div>
              <span className="stat-icon"><CloudOutlineIcon /></span>
            </div>
            <div className="stat-center">
              <div className="stat-progress-wrap">
                <CircularProgress value={45} />
                <div className="stat-value-overlay">
                  <span className="stat-percent">45%</span>
                  <span className="stat-percent-label">Terpakai</span>
                </div>
              </div>
            </div>
            <div className="stat-footer">
              <div className="stat-footer-item">
                <span className="stat-footer-label">Digunakan</span>
                <span className="stat-footer-value">45 GB</span>
              </div>
              <div className="stat-footer-divider" />
              <div className="stat-footer-item">
                <span className="stat-footer-label">Tersedia</span>
                <span className="stat-footer-value">100 GB</span>
              </div>
            </div>
          </div>

          {/* Compute Card */}
          <div className="stat-card">
            <div className="stat-card-header">
              <div>
                <p className="stat-label">Instans Komputasi</p>
                <p className="stat-sublabel">Penggunaan vCPU Inti</p>
              </div>
              <span className="stat-icon"><CpuIcon /></span>
            </div>
            <div className="stat-center">
              <div className="stat-progress-wrap">
                <CircularProgress value={28} />
                <div className="stat-value-overlay">
                  <span className="stat-percent">28%</span>
                  <span className="stat-percent-label">Aktif</span>
                </div>
              </div>
            </div>
            <div className="stat-footer">
              <div className="stat-footer-item">
                <span className="stat-footer-label">vCPU Aktif</span>
                <span className="stat-footer-value">14</span>
              </div>
              <div className="stat-footer-divider" />
              <div className="stat-footer-item">
                <span className="stat-footer-label">Batas Kuota</span>
                <span className="stat-footer-value">50</span>
              </div>
            </div>
          </div>

          {/* Right Column: Network + Security */}
          <div className="stats-right-col">
            {/* Network Card */}
            <div className="stat-card stat-card--dark">
              <div className="network-deco">
                <span className="deco-circle deco-circle--1" />
                <span className="deco-circle deco-circle--2" />
              </div>
              <p className="network-label">Transfer Data Jaringan</p>
              <p className="network-value">1.4 TB / 5.0 TB</p>
              <p className="network-sub">Kuota bandwidth keluar-masuk bulan ini</p>
              <a href="#" className="network-link">Lihat Analisis Trafik →</a>
            </div>

            {/* Security Card */}
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
          {/* Virtual Resources */}
          <div className="table-card">
            <div className="table-card-header">
              <h2 className="table-card-title">Sumber Daya Virtual</h2>
              <a href="#" className="table-link">
                Lihat Semua <ExternalLinkIcon />
              </a>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama Sumber Daya</th>
                  <th>Tipe</th>
                  <th>Utilitas Sistem</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {virtualResources.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="resource-name-cell">
                        <span className="resource-dot" />
                        <div>
                          <span className="resource-name">{r.name}</span>
                          <span className="resource-id">ID: {r.id}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge badge--${r.type.toLowerCase()}`}>{r.type}</span>
                    </td>
                    <td className="util-cell">{r.utilization}</td>
                    <td>
                      <button className="action-btn">Kelola</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* API Credentials */}
          <div className="table-card">
            <div className="table-card-header">
              <h2 className="table-card-title">Kredensial API</h2>
              <button className="new-key-btn">
                <PlusIcon /> Buat Kunci Baru
              </button>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama Kunci</th>
                  <th>Dibuat</th>
                  <th>Access Key</th>
                  <th>Secret Key</th>
                </tr>
              </thead>
              <tbody>
                {apiCredentials.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="key-name-cell">
                        <span className="key-icon"><KeyIcon /></span>
                        <span className="key-name">{c.name}</span>
                      </div>
                    </td>
                    <td className="date-cell">{c.created}</td>
                    <td className="mono-cell">{c.accessKey}</td>
                    <td>
                      <div className="secret-cell">
                        <span className="secret-dots">••••••••</span>
                        <button className="eye-btn" aria-label="Tampilkan"><EyeOffIcon /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
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
