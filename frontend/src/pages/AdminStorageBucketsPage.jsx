import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminNav from '../components/AdminNav'
import { getAdminStorageBuckets } from '../services/admin'
import './AdminDashboardPage.css'
import './AdminPages.css'

function fmtBytes(b) {
  if (!b) return '0 B'
  const gb = b / 1024 ** 3; if (gb >= 1) return `${parseFloat(gb.toFixed(1))} GB`
  return `${Math.round(b / 1024 ** 2)} MB`
}

export default function AdminStorageBucketsPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true)
      getAdminStorageBuckets(q).then((r) => setRows(r.data)).catch(() => setRows([])).finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  return (
    <div className="adm-page">
      <AdminNav breadcrumbs={[{ label: 'Pantau Sumber Daya', path: '/admin/monitoring' }, { label: 'Total Storage Klien' }]} />
      <main className="adm-main">
        <div className="adm-toolbar">
          <div className="adm-header">
            <h1 className="adm-page-title">Manajemen Object Storage</h1>
            <p className="adm-page-sub">Pantau bucket penyimpanan data klien lintas node.</p>
          </div>
          <div className="adm-input-search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M21 21L16.5 16.5M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"/></svg>
            <input placeholder="Cari bucket atau pemilik..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        <div className="adm-table-card">
          <table className="adm-table">
            <thead><tr><th>Nama Bucket</th><th>Pemilik</th><th>Jumlah Objek</th><th>Ukuran Total</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="adm-loading-cell">Memuat...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="adm-empty-cell">Tidak ada bucket.</td></tr>
              ) : rows.map((b) => (
                <tr key={b.id}>
                  <td className="adm-keyid">{b.name}</td>
                  <td className="adm-owner-cell">{b.owner_name}</td>
                  <td className="adm-util-cell">{b.object_count}</td>
                  <td className="adm-owner-cell">{fmtBytes(b.total_size_bytes)}</td>
                  <td><span className="adm-status-pill adm-status-pill--ok">Aktif</span></td>
                  <td><button className="adm-link-btn" onClick={() => navigate(`/admin/monitoring/storage/${b.id}`)}>Lihat Detail</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && <div className="adm-pagi"><span>Menampilkan {rows.length} bucket</span></div>}
        </div>
      </main>
    </div>
  )
}
