import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { logout, getStoredUser } from '../services/auth'
import './AdminNav.css'

function MenuIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 6H21M3 12H21M3 18H21" stroke="#062F28" strokeWidth="2" strokeLinecap="round" /></svg>
}
function SearchIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 21L16.5 16.5M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" /></svg>
}
function BellIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" stroke="#062F28" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
function UserIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="#062F28" strokeWidth="1.5" strokeLinecap="round" /><circle cx="12" cy="7" r="4" stroke="#062F28" strokeWidth="1.5" /></svg>
}
function LogoutIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
function CloseIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
}
function GridIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7"/></svg>
}
function UsersIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.7"/></svg>
}
function PackageIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg>
}
function CardIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.7"/><path d="M2 10h20" stroke="currentColor" strokeWidth="1.7"/></svg>
}
function ChartIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 3v18h18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><path d="M7 14l3-3 3 3 5-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function ReceiptIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2V2l-3 2-3-2-3 2-3-2-3 2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M8 9h8M8 13h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
}
function LogIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 5h16M4 12h16M4 19h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
}
function AuditIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
}
function KeyIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function ShieldIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
}

const ADMIN_NAV = [
  { path: '/admin', label: 'Dasbor', icon: GridIcon },
  { path: '/admin/monitoring', label: 'Monitoring Sumber Daya', icon: ChartIcon },
  { path: '/admin/pengguna', label: 'Manajemen Pengguna', icon: UsersIcon },
  { path: '/admin/langganan', label: 'Langganan', icon: CardIcon },
  { path: '/admin/transaksi', label: 'Riwayat Langganan', icon: ReceiptIcon },
  { path: '/admin/logs', label: 'Log Sistem', icon: LogIcon },
  { path: '/admin/audit', label: 'Audit Admin', icon: AuditIcon },
  { path: '/admin/keys', label: 'Access Keys Global', icon: KeyIcon },
  { path: '/admin/iam', label: 'Policy IAM', icon: ShieldIcon },
]

export default function AdminNav({ breadcrumbs = [] }) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const dropdownRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()
  const user = getStoredUser()

  useEffect(() => {
    function onClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function handleLogout() { logout(); navigate('/login') }

  return (
    <>
      {/* Sidebar */}
      <div className={`adm-sb-overlay ${sidebarOpen ? 'adm-sb-overlay--show' : ''}`} onClick={() => setSidebarOpen(false)} />
      <aside className={`adm-sidebar ${sidebarOpen ? 'adm-sidebar--open' : ''}`}>
        <div className="adm-sidebar-head">
          <span className="adm-sidebar-brand">JADESTACK</span>
          <button className="adm-sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Tutup"><CloseIcon /></button>
        </div>
        <nav className="adm-sidebar-nav">
          {ADMIN_NAV.map((item) => {
            const Icon = item.icon
            const active = location.pathname === item.path
            if (item.soon) {
              return (
                <span key={item.path} className="adm-sidebar-link adm-sidebar-link--soon" title="Segera hadir">
                  <Icon /> <span>{item.label}</span><span className="adm-soon-tag">segera</span>
                </span>
              )
            }
            return (
              <Link key={item.path} to={item.path}
                className={`adm-sidebar-link ${active ? 'adm-sidebar-link--active' : ''}`}
                onClick={() => setSidebarOpen(false)}>
                <Icon /> <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
        <div className="adm-sidebar-footer">
          <span className="adm-sidebar-role">Mode Administrator</span>
        </div>
      </aside>

      {/* Top nav */}
      <nav className="adm-navbar">
        <div className="adm-navbar-left">
          <button className="adm-icon-btn" aria-label="Menu" onClick={() => setSidebarOpen(true)}><MenuIcon /></button>
          <span className="adm-brand">JADESTACK</span>
          {breadcrumbs.length > 0 && (
            <div className="adm-breadcrumb">
              {breadcrumbs.map((c, i) => (
                <span key={i} className="adm-bc-item">
                  {i > 0 && <span className="adm-bc-sep">›</span>}
                  {c.path ? <Link to={c.path} className="adm-bc-link">{c.label}</Link>
                          : <span className="adm-bc-current">{c.label}</span>}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="adm-navbar-right">
          <div className="adm-avatar-wrapper" ref={dropdownRef}>
            <button className="adm-icon-btn adm-avatar-btn" onClick={() => setDropdownOpen(v => !v)} aria-label="Profil"><UserIcon /></button>
            {dropdownOpen && (
              <div className="adm-dropdown">
                <div className="adm-dropdown-info">
                  <span className="adm-dropdown-name">{user?.name ?? 'Administrator'}</span>
                  <span className="adm-dropdown-email">{user?.email ?? ''}</span>
                  <span className="adm-dropdown-badge">{user?.role ?? 'admin'}</span>
                </div>
                <div className="adm-dropdown-divider" />
                <button className="adm-dropdown-logout" onClick={handleLogout}><LogoutIcon /> Keluar</button>
              </div>
            )}
          </div>
        </div>
      </nav>
    </>
  )
}
