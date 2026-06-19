import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AdminNav from '../components/AdminNav'
import { getAdminTransaction } from '../services/admin'
import './AdminDashboardPage.css'
import './AdminPages.css'

function fmtDateTime(s) {
  if (!s) return '-'
  const d = new Date(s)
  return `${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`
}
function rp(n) { return 'Rp ' + new Intl.NumberFormat('id-ID').format(n) }

export default function AdminTransactionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [t, setT] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [copied, setCopied] = useState(false)

  function load() {
    return getAdminTransaction(id).then((r) => setT(r.data)).catch((e) => {
      if (e.response?.status === 404) navigate('/admin/transaksi', { replace: true })
    })
  }
  useEffect(() => { load().finally(() => setLoading(false)) }, [id])

  if (loading) return <div className="adm-page"><AdminNav /><div className="adm-loading">Memuat...</div></div>
  if (!t) return null

  const paid = t.invoice_status === 'PAID'

  return (
    <div className="adm-page">
      <AdminNav breadcrumbs={[{ label: 'Riwayat Transaksi', path: '/admin/transaksi' }, { label: 'Detail' }]} />
      <main className="adm-main">
        <div className="adm-header"><h1 className="adm-page-title">Detail Transaksi: {t.invoice_no}</h1></div>

        <div className="adm-sim-banner">⚠ <b>Mode Simulasi</b> — webhook di bawah adalah contoh, bukan notifikasi Midtrans sungguhan.</div>

        <div className="adm-two-col">
          <div className="adm-table-card">
            <div className="adm-tx-total">
              <span className="adm-mini-label">TOTAL PEMBAYARAN</span>
              <span className={`adm-status-pill adm-status-pill--${paid ? 'ok' : 'off'}`} style={{ float: 'right' }}>{t.invoice_status}</span>
              <div className="adm-tx-amount">{rp(t.amount)}</div>
            </div>
            <div className="adm-info-row"><span>Klien</span><span>{t.client_name}</span></div>
            <div className="adm-info-row"><span>Nomor Invoice</span><span>{t.invoice_no}</span></div>
            <div className="adm-info-row"><span>Tanggal</span><span>{fmtDateTime(t.date)}</span></div>
            <div className="adm-info-row"><span>Metode</span><span>{t.method}</span></div>
            <div className="adm-info-row">
              <span>ID Transaksi Midtrans</span>
              <span className="adm-keyid" style={{ cursor: 'pointer' }}
                onClick={() => { navigator.clipboard?.writeText(t.midtrans_id); setCopied(true); setTimeout(() => setCopied(false), 1200) }}>
                {t.midtrans_id} {copied ? '✓' : '⧉'}
              </span>
            </div>
            <button className="adm-btn-ghost" style={{ marginTop: 16 }}
              onClick={() => { setSyncing(true); setTimeout(() => { setSyncing(false); load() }, 700) }} disabled={syncing}>
              {syncing ? 'Menyinkron...' : '↻ Sinkronisasi Ulang Status'}
            </button>
          </div>

          <div className="adm-table-card">
            <div className="adm-table-header"><h2 className="adm-table-title">Raw Notification Data</h2><span className="adm-util-cell">Midtrans Webhook (simulasi)</span></div>
            <pre className="adm-webhook">{JSON.stringify(t.raw_notification, null, 2)}</pre>
          </div>
        </div>
      </main>
    </div>
  )
}
