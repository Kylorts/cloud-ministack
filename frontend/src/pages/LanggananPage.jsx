import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { getMySubscription, cancelSubscription } from '../services/subscriptions'
import { getStorageUsage } from '../services/storage'
import './LanggananPage.css'

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const gb = bytes / (1024 ** 3)
  if (gb >= 1) return `${gb % 1 === 0 ? gb : gb.toFixed(1)} GB`
  const mb = bytes / (1024 ** 2)
  return `${mb % 1 === 0 ? mb : mb.toFixed(0)} MB`
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatPrice(price) {
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(price)
}

export default function LanggananPage() {
  const [subscription, setSubscription] = useState(null)
  const [usage, setUsage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      getMySubscription().catch(() => null),
      getStorageUsage().catch(() => null),
    ]).then(([subRes, usageRes]) => {
      setSubscription(subRes?.data ?? null)
      setUsage(usageRes?.data ?? null)
    }).finally(() => setLoading(false))
  }, [])

  async function handleCancel() {
    if (!window.confirm('Yakin ingin membatalkan langganan? Anda tidak akan bisa menggunakan layanan storage setelah periode berakhir.')) return
    setCancelling(true)
    try {
      await cancelSubscription()
      navigate('/paket')
    } catch (err) {
      setError(err.response?.data?.detail || 'Gagal membatalkan langganan')
    } finally {
      setCancelling(false)
    }
  }

  if (loading) return <div className="langganan-loading">Memuat data langganan...</div>

  return (
    <div className="langganan-page">
      <Navbar breadcrumbs={[
        { label: 'Ringkasan', path: '/dashboard' },
        { label: 'Detail Langganan' },
      ]} />

      <main className="langganan-main">
        {subscription && (
          <div className="langganan-header">
            <h1 className="langganan-title">Detail Langganan</h1>
            <p className="langganan-subtitle">Kelola paket, metode pembayaran, dan siklus penagihan Anda.</p>
          </div>
        )}

        {error && <div className="langganan-error">{error}</div>}

        {!subscription ? (
          <div className="langganan-empty">
            <p>Anda belum memiliki langganan aktif.</p>
            <button className="btn-primary" onClick={() => navigate('/paket')}>Pilih Paket</button>
          </div>
        ) : (
          <div className="langganan-grid">
            {/* Plan Info Card */}
            <div className="lan-card lan-card--plan">
              <div className="lan-plan-header">
                <div className="lan-plan-title-row">
                  <h2 className="lan-plan-name">{subscription.plan.name}</h2>
                  <span className={`lan-status-badge lan-status--${subscription.status}`}>
                    {subscription.status === 'active' ? 'AKTIF' :
                     subscription.status === 'cancelled' ? 'DIBATALKAN' :
                     subscription.status.toUpperCase()}
                  </span>
                </div>
                <button className="btn-outline" onClick={() => navigate('/paket')}>Ubah Paket</button>
              </div>

              <div className="lan-info-grid">
                <div className="lan-info-item">
                  <span className="lan-info-label">PERIODE AKTIF</span>
                  <span className="lan-info-value">
                    {formatDate(subscription.current_period_start)} – {formatDate(subscription.current_period_end)}
                  </span>
                </div>
                <div className="lan-info-item">
                  <span className="lan-info-label">TANGGAL PERPANJANGAN</span>
                  <span className="lan-info-value">{formatDate(subscription.current_period_end)}</span>
                </div>
                <div className="lan-info-item">
                  <span className="lan-info-label">METODE PEMBAYARAN</span>
                  <span className="lan-info-value">Via Midtrans</span>
                </div>
                <div className="lan-info-item">
                  <span className="lan-info-label">BIAYA LANGGANAN</span>
                  <span className="lan-info-value">{formatPrice(subscription.plan.price)} / bulan</span>
                </div>
              </div>

              {subscription.status === 'active' && (
                <button className="lan-cancel-btn" onClick={handleCancel} disabled={cancelling}>
                  {cancelling ? 'Membatalkan...' : '⊘ Batalkan Langganan'}
                </button>
              )}
            </div>

            {/* Usage Card */}
            <div className="lan-card lan-card--usage">
              <div className="lan-usage-header">
                <h3 className="lan-usage-title">Penggunaan Sumber Daya</h3>
              </div>
              <div className="lan-usage-items">
                <div className="lan-usage-item">
                  <div className="lan-usage-row">
                    <span className="lan-usage-label">STORAGE</span>
                    <span className="lan-usage-value">
                      {usage ? formatBytes(usage.storage_used_bytes) : '0 B'} / {formatBytes(subscription.plan.storage_limit_bytes)}
                    </span>
                  </div>
                  <div className="lan-progress-bar">
                    <div className="lan-progress-fill" style={{ width: `${usage?.storage_percent ?? 0}%` }} />
                  </div>
                  <span className="lan-usage-sub">{usage?.storage_percent ?? 0}% terpakai</span>
                </div>
                <div className="lan-usage-item">
                  <div className="lan-usage-row">
                    <span className="lan-usage-label">BANDWIDTH</span>
                    <span className="lan-usage-value">0 B / {formatBytes(subscription.plan.bandwidth_limit_bytes)}</span>
                  </div>
                  <div className="lan-progress-bar">
                    <div className="lan-progress-fill lan-progress-fill--bandwidth" style={{ width: '0%' }} />
                  </div>
                  <span className="lan-usage-sub">0% terpakai</span>
                </div>
              </div>
              <button className="btn-outline-full" onClick={() => navigate('/kuota')}>
                Lihat Statistik Detail
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="langganan-footer">
        <span>© 2026 INI AWAN</span>
        <div className="langganan-footer-links">
          <a href="#">Dokumentasi</a>
          <a href="#">Privasi</a>
          <a href="#">Syarat &amp; Ketentuan</a>
        </div>
      </footer>
    </div>
  )
}
