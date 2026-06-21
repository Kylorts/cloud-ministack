import { useEffect, useState } from 'react'
import { parseUTC } from '../utils/datetime'
import AdminNav from '../components/AdminNav'
import AdminPagination from '../components/AdminPagination'
import { getAdminSubscriptionHistory } from '../services/admin'
import { actionLabel } from '../utils/actionLabels'
import './AdminDashboardPage.css'
import './AdminPages.css'

const PAGE_SIZE = 15

function fmtDateTime(s) {
  if (!s) return '-'
  const d = parseUTC(s)
  return `${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} · ${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

function actionPill(a) {
  const cls = a === 'PACKAGE_SUBSCRIBED' ? 'ok' : a === 'PACKAGE_UPGRADED' ? 'ok' : 'warn'
  return <span className={`adm-status-pill adm-status-pill--${cls}`}>{actionLabel(a)}</span>
}

export default function AdminTransactionsPage() {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { setPage(1) }, [q])
  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true)
      getAdminSubscriptionHistory({ q, page, page_size: PAGE_SIZE })
        .then((r) => { setRows(r.data.items); setTotal(r.data.total) })
        .catch(() => { setRows([]); setTotal(0) }).finally(() => setLoading(false))
    }, 200)
    return () => clearTimeout(t)
  }, [q, page])

  return (
    <div className="adm-page">
      <AdminNav breadcrumbs={[{ label: 'Layanan & Tagihan' }, { label: 'Riwayat Langganan' }]} />
      <main className="adm-main">
        <div className="adm-toolbar">
          <div className="adm-header">
            <h1 className="adm-page-title">Riwayat Langganan</h1>
            <p className="adm-page-sub">Catatan langganan berhasil (berlangganan, upgrade, downgrade) seluruh klien.</p>
          </div>
          <div className="adm-input-search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M21 21L16.5 16.5M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"/></svg>
            <input placeholder="Cari klien / paket..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        <div className="adm-info-banner" style={{ marginBottom: 16 }}>
          ℹ Pembayaran di-skip (simulasi) — langganan langsung aktif &amp; gratis. Halaman ini menampilkan
          riwayat <strong>event langganan yang berhasil</strong> (bukan transaksi pembayaran).
        </div>

        <div className="adm-table-card">
          <table className="adm-table">
            <thead><tr><th>Waktu</th><th>Klien</th><th>Aksi</th><th>Detail</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="adm-loading-cell">Memuat...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={4} className="adm-empty-cell">Belum ada riwayat langganan.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id}>
                  <td className="adm-util-cell">{fmtDateTime(r.created_at)}</td>
                  <td className="adm-instance-name">{r.client_name}</td>
                  <td>{actionPill(r.action)}</td>
                  <td className="adm-owner-cell">{r.detail || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && <AdminPagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} label="event" />}
        </div>
      </main>
    </div>
  )
}
