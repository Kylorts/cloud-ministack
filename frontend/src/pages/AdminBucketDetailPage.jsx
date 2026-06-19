import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AdminNav from '../components/AdminNav'
import { getAdminBucketDetail } from '../services/admin'
import './AdminDashboardPage.css'
import './AdminPages.css'

function fmtBytes(b) {
  if (b == null) return '-'
  if (!b) return '0 B'
  const gb = b / 1024 ** 3; if (gb >= 1) return `${parseFloat(gb.toFixed(1))} GB`
  const mb = b / 1024 ** 2; if (mb >= 1) return `${parseFloat(mb.toFixed(1))} MB`
  return `${Math.round(b / 1024)} KB`
}
function fmtDate(s) {
  if (!s) return '-'
  const d = new Date(s)
  return `${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
}

export default function AdminBucketDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [b, setB] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAdminBucketDetail(id).then((r) => setB(r.data)).catch((e) => {
      if (e.response?.status === 404) navigate('/admin/monitoring/storage', { replace: true })
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="adm-page"><AdminNav /><div className="adm-loading">Memuat...</div></div>
  if (!b) return null

  return (
    <div className="adm-page">
      <AdminNav breadcrumbs={[
        { label: 'Pantau Sumber Daya', path: '/admin/monitoring' },
        { label: 'Total Storage Klien', path: '/admin/monitoring/storage' },
        { label: 'Detail Bucket' },
      ]} />
      <main className="adm-main">
        <div className="adm-header">
          <h1 className="adm-page-title">{b.name}</h1>
          <p className="adm-page-sub">Tampilan read-only — milik {b.owner_name}.</p>
        </div>

        <div className="adm-mini-grid">
          <div className="adm-mini"><div className="adm-mini-label">Pemilik</div><div className="adm-mini-value" style={{ fontSize: 18 }}>{b.owner_name}</div></div>
          <div className="adm-mini"><div className="adm-mini-label">Jumlah Objek</div><div className="adm-mini-value">{b.object_count}</div></div>
          <div className="adm-mini"><div className="adm-mini-label">Ukuran Total</div><div className="adm-mini-value">{fmtBytes(b.total_size_bytes)}</div></div>
        </div>

        <div className="adm-table-card">
          <div className="adm-table-header">
            <h2 className="adm-table-title">Daftar Objek</h2>
            <span className="adm-util-cell">Visibilitas: {b.visibility === 'private' ? 'Pribadi' : 'Publik'}</span>
          </div>
          <table className="adm-table">
            <thead><tr><th>Key</th><th>Tipe</th><th>Ukuran</th><th>Diunggah</th></tr></thead>
            <tbody>
              {b.objects.length === 0 ? (
                <tr><td colSpan={4} className="adm-empty-cell">Bucket kosong.</td></tr>
              ) : b.objects.map((o, i) => (
                <tr key={i}>
                  <td className="adm-keyid">{o.key}</td>
                  <td className="adm-util-cell">{o.content_type || '-'}</td>
                  <td className="adm-owner-cell">{fmtBytes(o.size_bytes)}</td>
                  <td className="adm-util-cell">{fmtDate(o.uploaded_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
