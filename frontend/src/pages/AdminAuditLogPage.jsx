import { useEffect, useState } from 'react'
import { parseUTC } from '../utils/datetime'
import AdminNav from '../components/AdminNav'
import AdminPagination from '../components/AdminPagination'
import { getAdminAudit } from '../services/admin'
import { actionLabel } from '../utils/actionLabels'
import { exportXlsx, exportPdf } from '../utils/exporters'
import './AdminDashboardPage.css'
import './AdminPages.css'

function fmtDateTime(s) {
  const d = parseUTC(s)
  return `${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} · ${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

const PAGE_SIZE = 15

export default function AdminAuditLogPage() {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  useEffect(() => { setPage(1) }, [q])
  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true)
      getAdminAudit({ q, page, page_size: PAGE_SIZE })
        .then((r) => { setRows(r.data.items); setTotal(r.data.total) })
        .catch(() => { setRows([]); setTotal(0) }).finally(() => setLoading(false))
    }, 200)
    return () => clearTimeout(t)
  }, [q, page])

  const [exporting, setExporting] = useState(false)
  const EXPORT_HEADERS = ['Waktu', 'Admin Pelaku', 'Klien Terdampak', 'Aksi', 'Alasan/Catatan']

  async function doExport(kind) {
    setExporting(true)
    try {
      // Ambil SEMUA baris yang cocok dengan pencarian saat ini (bukan hanya halaman aktif).
      const r = await getAdminAudit({ q, page: 1, page_size: 100000 })
      const all = r.data?.items ?? rows
      const body = all.map((x) => [fmtDateTime(x.created_at), x.admin_name, x.affected, actionLabel(x.action), x.note])
      if (kind === 'xlsx') exportXlsx('audit-admin', 'Audit Admin', EXPORT_HEADERS, body)
      else exportPdf('audit-admin', 'Audit Tindakan Administrator', EXPORT_HEADERS, body)
    } catch {
      alert('Gagal mengekspor.')
    } finally {
      setExporting(false)
    }
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
            <button className="adm-btn-ghost" onClick={() => doExport('xlsx')} disabled={exporting}>{exporting ? '...' : '↓ Excel'}</button>
            <button className="adm-btn-ghost" onClick={() => doExport('pdf')} disabled={exporting}>{exporting ? '...' : '↓ PDF'}</button>
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
          {!loading && <AdminPagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} label="log" />}
        </div>
      </main>
    </div>
  )
}
