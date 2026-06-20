import { useEffect, useState } from 'react'
import { parseUTC } from '../utils/datetime'
import { useNavigate } from 'react-router-dom'
import AdminNav from '../components/AdminNav'
import { getAdminSubscriptions } from '../services/admin'
import './AdminDashboardPage.css'
import './AdminPages.css'

function fmtDate(s) {
  if (!s) return '-'
  return parseUTC(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}
const TABS = [
  { key: 'all', label: 'Semua' },
  { key: 'active', label: 'Aktif' },
  { key: 'over_quota', label: 'Over Quota' },
  { key: 'past_due', label: 'Past Due', disabled: true },
]
function statusPill(s) {
  if (s === 'active') return <span className="adm-status-pill adm-status-pill--ok">Aktif</span>
  if (s === 'over_quota') return <span className="adm-status-pill adm-status-pill--warn">Over Quota</span>
  if (s === 'suspended') return <span className="adm-status-pill adm-status-pill--danger">Disuspend</span>
  return <span className="adm-status-pill adm-status-pill--off">{s}</span>
}

export default function AdminSubscriptionsPage() {
  const [tab, setTab] = useState('all')
  const [subs, setSubs] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    getAdminSubscriptions(tab).then((r) => setSubs(r.data)).catch(() => setSubs([])).finally(() => setLoading(false))
  }, [tab])

  return (
    <div className="adm-page">
      <AdminNav breadcrumbs={[{ label: 'Layanan & Tagihan' }, { label: 'Langganan' }]} />
      <main className="adm-main">
        <div className="adm-header">
          <h1 className="adm-page-title">Daftar Langganan</h1>
          <p className="adm-page-sub">Pantau & kelola langganan seluruh klien.</p>
        </div>

        <div className="adm-tabs">
          {TABS.map((t) => (
            <button key={t.key} className={`adm-tab ${tab === t.key ? 'adm-tab--active' : ''}`}
              disabled={t.disabled} title={t.disabled ? 'Memerlukan modul pembayaran' : ''}
              onClick={() => !t.disabled && setTab(t.key)}>{t.label}</button>
          ))}
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
        </div>
      </main>
    </div>
  )
}
