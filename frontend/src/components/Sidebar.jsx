import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { logout, getStoredUser } from '../services/auth'
import { getSubscriptionHistory, everSubscribed } from '../services/subscriptions'
import './Sidebar.css'

function GridIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7"/></svg>
}
function BucketIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M21 8H3l1.5 11.5A2 2 0 0 0 6.5 21h11a2 2 0 0 0 2-1.5L21 8z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><path d="M21 8a9 9 0 1 0-18 0" stroke="currentColor" strokeWidth="1.7"/></svg>
}
function PackageIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
}
function CardIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.7"/><path d="M2 10h20" stroke="currentColor" strokeWidth="1.7"/></svg>
}
function GlobeIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" stroke="currentColor" strokeWidth="1.7"/></svg>
}
function ChartIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 3v18h18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><path d="M7 14l3-3 3 3 5-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function ClockIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7"/><path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function KeyIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function ShieldIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function LogoutIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function CloseIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
}

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Ringkasan', icon: GridIcon },
  { path: '/storage',   label: 'Object Storage', icon: BucketIcon },
  { path: '/hosting',   label: 'Static Hosting', icon: GlobeIcon },
  { path: '/paket',     label: 'Pilih Paket', icon: PackageIcon },
  { path: '/langganan', label: 'Detail Langganan', icon: CardIcon },
  { path: '/access-keys', label: 'Access Keys', icon: KeyIcon, requiresSub: true },
  { path: '/keamanan',  label: 'Keamanan & MFA', icon: ShieldIcon },
  { path: '/kuota',     label: 'Penggunaan & Kuota', icon: ChartIcon, requiresSub: true },
  { path: '/aktivitas', label: 'Log Aktivitas', icon: ClockIcon },
]

export default function Sidebar({ open, onClose }) {
  const location = useLocation()
  const navigate = useNavigate()
  const user = getStoredUser()
  // "pernah berlangganan" (aktif ATAU dorman) → menu penuh.
  // Hanya user yang BELUM PERNAH berlangganan yang menunya diciutkan.
  const [hasSubscribed, setHasSubscribed] = useState(false)

  useEffect(() => {
    let active = true
    getSubscriptionHistory()
      .then((r) => { if (active) setHasSubscribed(everSubscribed(r.data)) })
      .catch(() => { if (active) setHasSubscribed(false) })
    return () => { active = false }
  }, [])

  const navItems = NAV_ITEMS.filter((item) => !item.requiresSub || hasSubscribed)

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <>
      <div className={`sidebar-overlay ${open ? 'sidebar-overlay--show' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${open ? 'sidebar--open' : ''}`}>
        <div className="sidebar-header">
          <span className="sidebar-brand">JADESTACK</span>
          <button className="sidebar-close" onClick={onClose} aria-label="Tutup"><CloseIcon /></button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`sidebar-link ${active ? 'sidebar-link--active' : ''}`}
                onClick={onClose}
              >
                <Icon />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{(user?.name ?? 'U').charAt(0).toUpperCase()}</div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user?.name ?? 'Pengguna'}</span>
              <span className="sidebar-user-email">{user?.email ?? ''}</span>
            </div>
          </div>
          <button className="sidebar-logout" onClick={handleLogout}>
            <LogoutIcon /> Keluar
          </button>
        </div>
      </aside>
    </>
  )
}
