import { useEffect, useState } from 'react'
import { parseUTC } from '../utils/datetime'
import AdminNav from '../components/AdminNav'
import { getAdminAudit } from '../services/admin'
import { actionLabel } from '../utils/actionLabels'
import './AdminDashboardPage.css'
import './AdminPages.css'

function fmtDateTime(s) {
  const d = parseUTC(s)
  return `${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
}

export default function AdminAuditLogPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true)
      getAdminAudit({ q }).then((r) => setRows(r.data)).catch(() => setRows([])).finally(() => setLoading(false))
    }, 200)
    return () => clearTimeout(t)
  }, [q])

  function exportCsv() {
    const header = ['Waktu', 'Admin Pelaku', 'Klien Terdampak', 'Aksi', 'Alasan/Catatan']
    const lines = rows.map((r) => [fmtDateTime(r.created_at), r.admin_name, r.affected, actionLabel(r.action), r.note])
    const csv = [header, ...lines].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = 'audit-admin.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="adm-page">
      <AdminNav breadcrumbs={[{ label: 'Keamanan & Log Sistem' }, { label: 'Log Tindakan Admin' }]} />
      <main className="adm-main">
        <div className="adm-toolbar">
          <div className="adm-header">
            <h1 className="adm-page-title">Audit Tindakan Administrator</h1>
            <p className="adm-page-sub">Rekam jejak tindakan sensitif dan perubahan sistem.</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="adm-input-search" style={{ maxWidth: 220 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M21 21L16.5 16.5M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"/></svg>
              <input placeholder="Cari log..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <button className="adm-btn-ghost" onClick={exportCsv}>↓ Ekspor CSV</button>
          </div>
        </div>

        <div className="adm-table-card">
          <table className="adm-table">
            <thead><tr><th>Waktu</th><th>Admin Pelaku</th><th>Klien Terdampak</th><th>Aksi</th><th>Alasan/Catatan</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="adm-loading-cell">Memuat...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="adm-empty-cell">Belum ada tindakan admin tercatat.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id}>
                  <td className="adm-util-cell">{fmtDateTime(r.created_at)}</td>
                  <td className="adm-instance-name">{r.admin_name}</td>
                  <td className="adm-owner-cell">{r.affected}</td>
                  <td><span className="adm-action-tag adm-action-tag--warn">{actionLabel(r.action)}</span></td>
                  <td className="adm-owner-cell">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && <div className="adm-pagi"><span>Menampilkan {rows.length} log</span></div>}
        </div>
      </main>
    </div>
  )
}
