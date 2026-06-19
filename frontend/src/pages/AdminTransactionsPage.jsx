import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminNav from '../components/AdminNav'
import { getAdminTransactions } from '../services/admin'
import './AdminDashboardPage.css'
import './AdminPages.css'

function fmtDate(s) {
  if (!s) return '-'
  return new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}
function rp(n) { return 'Rp ' + new Intl.NumberFormat('id-ID').format(n) }

export default function AdminTransactionsPage() {
  const [tx, setTx] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const navigate = useNavigate()

  function load() { return getAdminTransactions().then((r) => setTx(r.data)).catch(() => setTx([])) }
  useEffect(() => { load().finally(() => setLoading(false)) }, [])

  function syncAll() {
    setSyncing(true)
    setTimeout(() => { setSyncing(false); load() }, 700) // simulasi sinkronisasi
  }

  return (
    <div className="adm-page">
      <AdminNav breadcrumbs={[{ label: 'Layanan & Tagihan' }, { label: 'Riwayat Transaksi' }]} />
      <main className="adm-main">
        <div className="adm-toolbar">
          <div className="adm-header">
            <h1 className="adm-page-title">Riwayat Transaksi</h1>
            <p className="adm-page-sub">Pantau status pembayaran klien.</p>
          </div>
          <button className="adm-btn-ghost" onClick={syncAll} disabled={syncing}>
            {syncing ? 'Menyinkron...' : '↻ Sinkronisasi Semua Status'}
          </button>
        </div>

        <div className="adm-sim-banner">
          ⚠ <b>Mode Simulasi</b> — Midtrans belum diintegrasikan. Data transaksi di sini dibangkitkan
          dari langganan aktif sebagai placeholder (tidak ada pembayaran nyata).
        </div>

        <div className="adm-table-card">
          <table className="adm-table">
            <thead><tr><th>No Invoice</th><th>Klien</th><th>Nominal</th><th>Status Invoice</th><th>Status Midtrans</th><th>Metode</th><th>Tanggal</th><th>Aksi</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="adm-loading-cell">Memuat...</td></tr>
              ) : tx.length === 0 ? (
                <tr><td colSpan={8} className="adm-empty-cell">Belum ada transaksi.</td></tr>
              ) : tx.map((t) => (
                <tr key={t.id}>
                  <td className="adm-keyid">{t.invoice_no}</td>
                  <td className="adm-instance-name">{t.client_name}</td>
                  <td className="adm-owner-cell">{rp(t.amount)}</td>
                  <td>
                    <span className={`adm-status-pill adm-status-pill--${t.invoice_status === 'PAID' ? 'ok' : 'off'}`}>
                      {t.invoice_status}
                    </span>
                  </td>
                  <td className="adm-util-cell">{t.midtrans_status}</td>
                  <td><span className="adm-badge adm-badge--minio">{t.method}</span></td>
                  <td className="adm-util-cell">{fmtDate(t.date)}</td>
                  <td><button className="adm-link-btn" onClick={() => navigate(`/admin/transaksi/${t.id}`)}>Detail</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
