import { useRef, useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getStoredUser, logout } from '../services/auth'
import Sidebar from './Sidebar'
import './Navbar.css'

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M3 6H21M3 12H21M3 18H21" stroke="#062F28" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="7" r="4" stroke="white" strokeWidth="1.5" />
    </svg>
  )
}
function LogoutIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function Navbar({ breadcrumbs = [] }) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const dropdownRef = useRef(null)
  const navigate = useNavigate()
  const user = getStoredUser()

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
    <>
    <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    <nav className="top-nav">
      <div className="top-nav-left">
        <button className="top-nav-menu-btn" aria-label="Menu" onClick={() => setSidebarOpen(true)}>
          <MenuIcon />
        </button>
        <span className="top-nav-brand">INI AWAN</span>
        <div className="top-nav-breadcrumb">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="breadcrumb-item">
              {i > 0 && <span className="breadcrumb-sep">›</span>}
              {crumb.path
                ? <Link to={crumb.path} className="breadcrumb-link">{crumb.label}</Link>
                : <span className="breadcrumb-current">{crumb.label}</span>
              }
            </span>
          ))}
        </div>
      </div>

      <div className="top-nav-right">
        <div className="top-nav-search">
          <SearchIcon />
          <input type="text" placeholder="Cari layanan..." className="top-nav-search-input" />
        </div>

        <button className="top-nav-icon-btn" aria-label="Notifikasi">
          <BellIcon />
        </button>

        <div className="top-nav-avatar-wrap" ref={dropdownRef}>
          <button
            className="top-nav-avatar-btn"
            onClick={() => setDropdownOpen((v) => !v)}
            aria-label="Profil"
          >
            <UserIcon />
          </button>

          {dropdownOpen && (
            <div className="top-nav-dropdown">
              <div className="dropdown-user">
                <span className="dropdown-name">{user?.name ?? 'Pengguna'}</span>
                <span className="dropdown-email">{user?.email ?? ''}</span>
              </div>
              <div className="dropdown-divider" />
              <button className="dropdown-logout" onClick={handleLogout}>
                <LogoutIcon /> Keluar
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
    </>
  )
}
