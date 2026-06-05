import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import { getActivityLogs } from '../services/activity'
import './AktivitasPage.css'

/* ── Ikon per jenis action ── */
function ActionIcon({ action }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none' }
  if (action === 'USER_LOGIN') {
    return <svg {...common}><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
  }
  if (action === 'PACKAGE_SUBSCRIBED') {
    return <svg {...common}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="#16a34a" strokeWidth="1.8"/></svg>
  }
  if (action === 'SUBSCRIPTION_CANCELLED') {
    return <svg {...common}><circle cx="12" cy="12" r="9" stroke="#dc2626" strokeWidth="1.8"/><path d="M15 9l-6 6M9 9l6 6" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round"/></svg>
  }
  if (action === 'BUCKET_CREATED') {
    return <svg {...common}><path d="M21 8H3l1.5 11.5A2 2 0 0 0 6.5 21h11a2 2 0 0 0 2-1.5L21 8z" stroke="#16a34a" strokeWidth="1.8"/><path d="M12 4v4M9 6h6" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round"/></svg>
  }
  if (action === 'BUCKET_DELETED') {
    return <svg {...common}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
  }
  if (action === 'FILE_UPLOADED') {
    return <svg {...common}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
  }
  if (action === 'FILE_DELETED') {
    return <svg {...common}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
  }
  return <svg {...common}><circle cx="12" cy="12" r="9" stroke="#6b7280" strokeWidth="1.8"/><path d="M12 8v4M12 16h.01" stroke="#6b7280" strokeWidth="1.8" strokeLinecap="round"/></svg>
}

function actionColor(action) {
  if (action.includes('DELETED') || action.includes('CANCELLED')) return '#fef2f2'
  if (action.includes('CREATED') || action.includes('UPLOADED') || action.includes('SUBSCRIBED')) return '#f0fdf4'
  if (action === 'USER_LOGIN') return '#eff6ff'
  return '#f3f4f6'
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  const time = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  const date = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${date} · ${time}`
}

function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'Baru saja'
  if (min < 60) return `${min} menit lalu`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} jam lalu`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day} hari lalu`
  return formatDateTime(dateStr)
}

export default function AktivitasPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')

  useEffect(() => {
    getActivityLogs(100, 0)
      .then((r) => setLogs(r.data))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = logs.filter((l) => {
    if (filter === 'ALL') return true
    if (filter === 'STORAGE') return l.action.startsWith('FILE_') || l.action.startsWith('BUCKET_')
    if (filter === 'AKUN') return l.action === 'USER_LOGIN' || l.action.includes('SUBSCRI') || l.action.includes('PACKAGE')
    return true
  })

  return (
    <div className="aktivitas-page">
      <Navbar breadcrumbs={[
        { label: 'Ringkasan', path: '/dashboard' },
        { label: 'Log Aktivitas' },
      ]} />

      <main className="aktivitas-main">
        <div className="aktivitas-header">
          <h1 className="aktivitas-title">Log Aktivitas</h1>
          <p className="aktivitas-subtitle">Riwayat aktivitas akun dan layanan Anda.</p>
        </div>

        <div className="aktivitas-filters">
          {[
            { key: 'ALL', label: 'Semua' },
            { key: 'STORAGE', label: 'Storage' },
            { key: 'AKUN', label: 'Akun & Langganan' },
          ].map((f) => (
            <button
              key={f.key}
              className={`aktivitas-filter ${filter === f.key ? 'aktivitas-filter--active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="aktivitas-empty">Memuat aktivitas...</div>
        ) : filtered.length === 0 ? (
          <div className="aktivitas-empty">Belum ada aktivitas.</div>
        ) : (
          <div className="aktivitas-timeline">
            {filtered.map((log) => (
              <div key={log.id} className="aktivitas-item">
                <span className="aktivitas-icon" style={{ background: actionColor(log.action) }}>
                  <ActionIcon action={log.action} />
                </span>
                <div className="aktivitas-content">
                  <p className="aktivitas-desc">{log.description}</p>
                  <div className="aktivitas-meta">
                    <span className="aktivitas-action-tag">{log.action}</span>
                    {log.ip_address && <span className="aktivitas-ip">IP {log.ip_address}</span>}
                  </div>
                </div>
                <span className="aktivitas-time" title={formatDateTime(log.created_at)}>
                  {relativeTime(log.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="aktivitas-footer">
        <span>© 2026 INI AWAN</span>
        <div className="aktivitas-footer-links">
          <a href="#">Dokumentasi</a>
          <a href="#">Privasi</a>
          <a href="#">Syarat &amp; Ketentuan</a>
        </div>
      </footer>
    </div>
  )
}
