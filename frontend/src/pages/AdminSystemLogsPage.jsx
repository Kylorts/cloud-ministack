import { useEffect, useState } from 'react'
import { parseUTC } from '../utils/datetime'
import AdminNav from '../components/AdminNav'
import { getAdminLogs } from '../services/admin'
import { actionLabel } from '../utils/actionLabels'
import './AdminDashboardPage.css'
import './AdminPages.css'

function fmtWhen(s) {
  const d = parseUTC(s); const now = new Date()
  const t = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === now.toDateString()) return `Hari ini, ${t}`
  const y = new Date(now); y.setDate(now.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return `Kemarin, ${t}`
  return `${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}, ${t}`
}
const ACTORS = [['all', 'Semua Aktor'], ['user', 'User'], ['admin', 'Admin'], ['system', 'System'], ['midtrans', 'Midtrans']]
const TYPES = [['all', 'Semua Tipe'], ['storage', 'Storage'], ['hosting', 'Hosting'], ['key', 'Access Key'], ['security', 'Keamanan'], ['account', 'Akun'], ['billing', 'Langganan'], ['admin', 'Admin']]
const PAGE_SIZE = 15

function actorPill(t) {
  const cls = t === 'user' ? 'adm-actor--user' : t === 'midtrans' ? 'adm-actor--midtrans' : t === 'admin' ? 'adm-actor--admin' : 'adm-actor--system'
  return <span className={`adm-actor ${cls}`}>{t.charAt(0).toUpperCase() + t.slice(1)}</span>
}

export default function AdminSystemLogsPage() {
  const [actor, setActor] = useState('all')
  const [type, setType] = useState('all')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => { setPage(1) }, [actor, type, q])
  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true)
      getAdminLogs({ actor, type, q, page, page_size: PAGE_SIZE })
        .then((r) => setData(r.data)).catch(() => setData({ items: [], total: 0 })).finally(() => setLoading(false))
    }, 200)
    return () => clearTimeout(t)
  }, [actor, type, q, page])

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE))
  const start = data.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const end = Math.min(page * PAGE_SIZE, data.total)

  return (
    <div className="adm-page">
      <AdminNav breadcrumbs={[{ label: 'Keamanan & Log Sistem' }, { label: 'System Logs' }]} />
      <main className="adm-main">
        <div className="adm-toolbar">
          <div className="adm-header">
            <h1 className="adm-page-title">Log Sistem & Aktivitas Global</h1>
            <p className="adm-page-sub">Monitor seluruh aktivitas, keamanan, dan event sistem.</p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div className="adm-input-search" style={{ maxWidth: 220 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M21 21L16.5 16.5M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"/></svg>
              <input placeholder="Cari log..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className="adm-select" value={actor} onChange={(e) => setActor(e.target.value)}>
              {ACTORS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select className="adm-select" value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        <div className="adm-table-card">
          <table className="adm-table">
            <thead><tr><th>Waktu</th><th>Aktor</th><th>Aksi</th><th>Target</th><th>IP Address</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="adm-loading-cell">Memuat...</td></tr>
              ) : data.items.length === 0 ? (
                <tr><td colSpan={5} className="adm-empty-cell">Tidak ada log.</td></tr>
              ) : data.items.map((a) => (
                <tr key={a.id}>
                  <td className="adm-util-cell">{fmtWhen(a.created_at)}</td>
                  <td><div className="adm-name-cell">{actorPill(a.actor_type)}<span className="adm-instance-name">{a.actor_name}</span></div></td>
                  <td><span className="adm-action-tag">{actionLabel(a.action)}</span></td>
                  <td className="adm-owner-cell">{a.target}</td>
                  <td className="adm-keyid">{a.ip_address || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && (
            <div className="adm-pagi">
              <span>Menampilkan {start}–{end} dari {data.total} log</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="adm-btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Sebelumnya</button>
                <button className="adm-btn-ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Selanjutnya</button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
