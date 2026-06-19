import { useEffect, useState } from 'react'
import AdminNav from '../components/AdminNav'
import { getAdminHostingSites } from '../services/admin'
import './AdminDashboardPage.css'
import './AdminPages.css'

function fmtWhen(s) {
  if (!s) return 'Belum deploy'
  const d = new Date(s)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  if (sameDay) return `Hari ini, ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AdminHostingSitesPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true)
      getAdminHostingSites(q).then((r) => setRows(r.data)).catch(() => setRows([])).finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  return (
    <div className="adm-page">
      <AdminNav breadcrumbs={[{ label: 'Pantau Sumber Daya', path: '/admin/monitoring' }, { label: 'Total Hosting Aktif' }]} />
      <main className="adm-main">
        <div className="adm-toolbar">
          <div className="adm-header">
            <h1 className="adm-page-title">Manajemen Static Hosting</h1>
            <p className="adm-page-sub">Pantau situs statis aktif lintas klien.</p>
          </div>
          <div className="adm-input-search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M21 21L16.5 16.5M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"/></svg>
            <input placeholder="Cari situs atau pemilik..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        <div className="adm-table-card">
          <table className="adm-table">
            <thead><tr><th>Nama Situs</th><th>Pemilik</th><th>URL Publik</th><th>Deploy Terakhir</th><th>Status</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="adm-loading-cell">Memuat...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="adm-empty-cell">Tidak ada situs.</td></tr>
              ) : rows.map((s) => (
                <tr key={s.id}>
                  <td className="adm-instance-name">{s.name}</td>
                  <td className="adm-owner-cell">{s.owner_name}</td>
                  <td><a className="adm-link-btn" href={s.url} target="_blank" rel="noreferrer">{s.url} ↗</a></td>
                  <td className="adm-util-cell">{fmtWhen(s.last_deployed_at)}</td>
                  <td><span className="adm-status-pill adm-status-pill--ok">● Aktif</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && <div className="adm-pagi"><span>Menampilkan {rows.length} situs</span></div>}
        </div>
      </main>
    </div>
  )
}
