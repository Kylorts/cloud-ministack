import { useEffect, useState } from 'react'
import { parseUTC } from '../utils/datetime'
import { useNavigate } from 'react-router-dom'
import AdminNav from '../components/AdminNav'
import { getAdminSubscriptions } from '../services/admin'
import AdminPagination from '../components/AdminPagination'
import './AdminDashboardPage.css'
import './AdminPages.css'

const PAGE_SIZE = 15

function fmtDate(s) {
  if (!s) return '-'
  return parseUTC(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}
const TABS = [
  { key: 'all', label: 'Semua' },
  { key: 'active', label: 'Aktif' },
  { key: 'over_quota', label: 'Over Quota' },
  { key: 'past_due', label: 'Nunggak' },
]
function statusPill(s) {
  if (s === 'active') return <span className="adm-status-pill adm-status-pill--ok">Aktif</span>
  if (s === 'over_quota') return <span className="adm-status-pill adm-status-pill--warn">Over Quota</span>
  if (s === 'past_due') return <span className="adm-status-pill adm-status-pill--warn">Nunggak</span>
  if (s === 'suspended') return <span className="adm-status-pill adm-status-pill--danger">Disuspend</span>
  return <span className="adm-status-pill adm-status-pill--off">{s}</span>
}

export default function AdminSubscriptionsPage() {
  const [tab, setTab] = useState('all')
  const [q, setQ] = useState('')
  const [subs, setSubs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { setPage(1) }, [tab, q])
  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true)
      getAdminSubscriptions(tab, { q, page, page_size: PAGE_SIZE })
        .then((r) => { setSubs(r.data.items); setTotal(r.data.total) })
        .catch(() => { setSubs([]); setTotal(0) }).finally(() => setLoading(false))
    }, 200)
    return () => clearTimeout(t)
  }, [tab, q, page])

  return (
    <div className="adm-page">
      <AdminNav breadcrumbs={[{ label: 'Layanan & Tagihan' }, { label: 'Langganan' }]} />
      <main className="adm-main">
        <div className="adm-header">
          <h1 className="adm-page-title">Daftar Langganan</h1>
          <p className="adm-page-sub">Pantau & kelola langganan seluruh klien.</p>
        </div>

        <div className="adm-toolbar">
          <div className="adm-tabs" style={{ marginBottom: 0, border: 'none' }}>
            {TABS.map((t) => (
              <button key={t.key} className={`adm-tab ${tab === t.key ? 'adm-tab--active' : ''}`}
                disabled={t.disabled} title={t.disabled ? 'Memerlukan modul pembayaran' : ''}
                onClick={() => !t.disabled && setTab(t.key)}>{t.label}</button>
            ))}
          </div>
          <div className="adm-input-search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M21 21L16.5 16.5M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"/></svg>
            <input placeholder="Cari klien / paket..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        <div className="adm-table-card">
          <table className="adm-table">
            <thead><tr><th>Klien</th><th>Paket Aktif</th><th>Kategori</th><th>Status</th><th>Akhir Periode</th><th>Perubahan Terjadwal</th><th>Aksi</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="adm-loading-cell">Memuat...</td></tr>
              ) : subs.length === 0 ? (
                <tr><td colSpan={7} className="adm-empty-cell">Tidak ada langganan.</td></tr>
              ) : subs.map((s) => (
                <tr key={s.id}>
                  <td className="adm-instance-name">{s.client_name}</td>
                  <td className="adm-owner-cell">{s.plan_name}</td>
                  <td><span className="adm-badge adm-badge--minio">{s.category}</span></td>
                  <td>{statusPill(s.status)}</td>
                  <td className="adm-util-cell">{fmtDate(s.current_period_end)}</td>
                  <td className="adm-util-cell">{s.scheduled_change || '–'}</td>
                  <td><button className="adm-link-btn" onClick={() => navigate(`/admin/langganan/${s.id}`)}>Detail</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && <AdminPagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} label="langganan" />}
        </div>
      </main>
    </div>
  )
}
