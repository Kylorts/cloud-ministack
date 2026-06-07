import { useEffect, useState, useRef } from 'react'
import Navbar from '../components/Navbar'
import { getActivityLogs } from '../services/activity'
import './AktivitasPage.css'

const ACTION_LABELS = {
  USER_LOGIN: 'Login Berhasil',
  PACKAGE_SUBSCRIBED: 'Berlangganan Paket',
  SUBSCRIPTION_CANCELLED: 'Batalkan Langganan',
  BUCKET_CREATED: 'Buat Bucket',
  BUCKET_DELETED: 'Hapus Bucket',
  FILE_UPLOADED: 'Unggah File',
  FILE_DELETED: 'Hapus File',
  STATIC_SITE_CREATED: 'Buat Situs',
  STATIC_SITE_DEPLOYED: 'Deploy Static Site',
  STATIC_SITE_ROLLBACK: 'Rollback Situs',
  STATIC_SITE_DELETED: 'Hapus Situs',
  STATIC_SITE_DEPLOYMENT_DELETED: 'Hapus Deployment',
  ACCESS_KEY_CREATED: 'Buat Access Key',
  ACCESS_KEY_REVOKED: 'Cabut Access Key',
  PASSWORD_CHANGED: 'Ubah Kata Sandi',
  PIN_SET: 'Atur PIN Transaksi',
  PIN_CHANGED: 'Ubah PIN Transaksi',
  PIN_REMOVED: 'Nonaktifkan PIN',
}

function actionLabel(a) {
  return ACTION_LABELS[a] || a
}

function getResource(log) {
  const m = log.description?.match(/'([^']+)'/)
  if (m) return m[1]
  if (log.action === 'USER_LOGIN') return 'Sistem Autentikasi'
  if (log.target_type) return log.target_type
  return '-'
}

function statusOf(log) {
  return /FAIL|DENIED|GAGAL/i.test(log.action) ? 'denied' : 'success'
}

function formatWita(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  const s = d.toLocaleString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar',
  })
  return `${s} WITA`
}

const FILTERS = [
  { key: 'ALL', label: 'Semua Aktivitas' },
  { key: 'STORAGE', label: 'Storage' },
  { key: 'HOSTING', label: 'Hosting' },
  { key: 'KEY', label: 'Access Key' },
  { key: 'AKUN', label: 'Akun & Langganan' },
  { key: 'KEAMANAN', label: 'Keamanan' },
]

export default function AktivitasPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showFilter, setShowFilter] = useState(false)
  const filterRef = useRef(null)
  const PAGE_SIZE = 10

  useEffect(() => {
    getActivityLogs(200, 0)
      .then((r) => setLogs(r.data))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    function onClick(e) {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function matchFilter(l) {
    if (filter === 'ALL') return true
    if (filter === 'STORAGE') return l.action.startsWith('FILE_') || l.action.startsWith('BUCKET_')
    if (filter === 'HOSTING') return l.action.startsWith('STATIC_SITE')
    if (filter === 'KEY') return l.action.startsWith('ACCESS_KEY')
    if (filter === 'AKUN') return l.action === 'USER_LOGIN' || l.action.includes('SUBSCRI') || l.action.includes('PACKAGE')
    if (filter === 'KEAMANAN') return l.action.startsWith('PIN_') || l.action === 'PASSWORD_CHANGED'
    return true
  }

  const filtered = logs.filter((l) => {
    if (!matchFilter(l)) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      actionLabel(l.action).toLowerCase().includes(q) ||
      getResource(l).toLowerCase().includes(q) ||
      (l.description || '').toLowerCase().includes(q)
    )
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function changeFilter(key) {
    setFilter(key)
    setShowFilter(false)
    setPage(1)
  }

  function exportCsv() {
    const header = ['Waktu', 'Tindakan', 'Resource', 'IP', 'Status']
    const rows = filtered.map((l) => [
      formatWita(l.created_at), actionLabel(l.action), getResource(l),
      l.ip_address || '-', statusOf(l) === 'denied' ? 'Denied' : 'Success',
    ])
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'riwayat-aktivitas.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="aktivitas-page">
      <Navbar breadcrumbs={[
        { label: 'Ringkasan', path: '/dashboard' },
        { label: 'Log Aktivitas' },
      ]} />

      <main className="aktivitas-main">
        <div className="aktivitas-header">
          <h1 className="aktivitas-title">Riwayat Aktivitas Akun</h1>
          <p className="aktivitas-subtitle">Pantau semua tindakan keamanan dan perubahan infrastruktur pada akun Anda.</p>
        </div>

        {/* Toolbar */}
        <div className="aktivitas-toolbar">
          <div className="aktivitas-search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M21 21L16.5 16.5M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <input type="text" placeholder="Cari aktivitas..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }} className="aktivitas-search-input" />
          </div>
          <div className="aktivitas-toolbar-actions">
            <div className="aktivitas-filter-wrap" ref={filterRef}>
              <button className="aktivitas-tool-btn" onClick={() => setShowFilter((v) => !v)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                Filter{filter !== 'ALL' ? `: ${FILTERS.find((f) => f.key === filter)?.label}` : ''}
              </button>
              {showFilter && (
                <div className="aktivitas-filter-menu">
                  {FILTERS.map((f) => (
                    <button key={f.key} className={`aktivitas-filter-item ${filter === f.key ? 'active' : ''}`}
                      onClick={() => changeFilter(f.key)}>{f.label}</button>
                  ))}
                </div>
              )}
            </div>
            <button className="aktivitas-tool-btn" onClick={exportCsv}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Export
            </button>
          </div>
        </div>

        {/* Table */}
        <table className="aktivitas-table">
          <colgroup><col /><col /><col /><col /><col /></colgroup>
          <thead>
            <tr>
              <th>WAKTU (WITA)</th><th>TINDAKAN</th><th>RESOURCE</th><th>ALAMAT IP</th><th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="aktivitas-table-empty">Memuat...</td></tr>
            ) : paginated.length === 0 ? (
              <tr><td colSpan={5} className="aktivitas-table-empty">Belum ada aktivitas.</td></tr>
            ) : paginated.map((l) => (
              <tr key={l.id}>
                <td className="ak-time">{formatWita(l.created_at)}</td>
                <td className="ak-action">{actionLabel(l.action)}</td>
                <td className="ak-resource">{getResource(l)}</td>
                <td className="ak-ip">{l.ip_address || '-'}</td>
                <td>
                  {statusOf(l) === 'denied'
                    ? <span className="ak-status ak-status--denied">● Denied</span>
                    : <span className="ak-status ak-status--success">● Success</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && filtered.length > 0 && (
          <div className="aktivitas-pagination">
            <span className="aktivitas-pg-info">
              Menampilkan {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, filtered.length)} dari {filtered.length} riwayat
            </span>
            <div className="aktivitas-pg-controls">
              <button className="aktivitas-pg-arrow" disabled={currentPage === 1} onClick={() => setPage((p) => p - 1)}>‹</button>
              <button className="aktivitas-pg-arrow" disabled={currentPage >= totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
            </div>
          </div>
        )}
      </main>

      <footer className="aktivitas-footer">
        <span>© 2026 INI AWAN</span>
        <div className="aktivitas-footer-links">
          <a href="#">Dokumentasi</a><a href="#">Privasi</a><a href="#">Syarat &amp; Ketentuan</a>
        </div>
      </footer>
    </div>
  )
}
