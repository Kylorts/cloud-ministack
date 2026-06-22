import { useEffect, useState } from 'react'
import { parseUTC } from '../utils/datetime'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import PinPromptModal from '../components/PinPromptModal'
import { getMySubscription, cancelSubscription } from '../services/subscriptions'
import { getStorageUsage } from '../services/storage'
import { getHostingUsage } from '../services/hosting'
import { getPinErrorCode } from '../services/security'
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
  return parseUTC(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}
function formatPrice(price) {
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(price)
}

// past_due (nunggak) ikut dapat tombol batal — itu jalan keluar mandiri (turun ke Free).
// suspended TIDAK bisa dibatalkan sendiri — hanya admin yang dapat unsuspend.
const CANCELLABLE = ['active', 'over_quota', 'past_due']

function StatusBadge({ status }) {
  const label = status === 'active' ? 'AKTIF'
    : status === 'cancelled' ? 'DIBATALKAN'
    : status === 'past_due' ? 'NUNGGAK'
    : status === 'over_quota' ? 'OVER QUOTA'
    : status === 'suspended' ? 'DISUSPEND'
    : status.toUpperCase()
  return <span className={`lan-status-badge lan-status--${status}`}>{label}</span>
}

/* ── Blok satu langganan (storage / hosting) ── */
function SubBlock({ category, sub, storageUsage, hostingUsage, navigate, onCancel, cancelling }) {
  const isStorage = category === 'storage'
  return (
    <div className="langganan-grid">
      {/* Plan Info Card */}
      <div className="lan-card lan-card--plan">
        <div className="lan-plan-header">
          <div className="lan-plan-title-row">
            <h2 className="lan-plan-name">{sub.plan.name}</h2>
            <StatusBadge status={sub.status} />
          </div>
          <button
            className="btn-outline"
            onClick={() => navigate(isStorage ? '/paket' : '/paket?kategori=hosting')}
          >
            Ubah Paket
          </button>
        </div>

        <div className="lan-info-grid">
          <div className="lan-info-item">
            <span className="lan-info-label">LAYANAN</span>
            <span className="lan-info-value">{isStorage ? 'Object Storage' : 'Static Hosting'}</span>
          </div>
          <div className="lan-info-item">
            <span className="lan-info-label">PERIODE AKTIF</span>
            <span className="lan-info-value">
              {formatDate(sub.current_period_start)} – {formatDate(sub.current_period_end)}
            </span>
          </div>
          <div className="lan-info-item">
            <span className="lan-info-label">TANGGAL PERPANJANGAN</span>
            <span className="lan-info-value">{formatDate(sub.current_period_end)}</span>
          </div>
          <div className="lan-info-item">
            <span className="lan-info-label">BIAYA LANGGANAN</span>
            <span className="lan-info-value">{formatPrice(sub.plan.price)} / bulan</span>
          </div>
        </div>

        {sub.scheduled_plan_id && (
          <div className="lan-scheduled">
            ⏳ Downgrade ke <strong>{sub.scheduled_plan_name}</strong> dijadwalkan pada {formatDate(sub.current_period_end)}.
            {' '}<a href={isStorage ? '/paket' : '/paket?kategori=hosting'}>Kelola di Pilih Paket</a>.
          </div>
        )}

        {CANCELLABLE.includes(sub.status) && sub.plan.price > 0 && (
          <button className="lan-cancel-btn" onClick={() => onCancel(category, sub)} disabled={cancelling}>
            ⊘ Turun ke Paket Free
          </button>
        )}
        {sub.status === 'suspended' && (
          <div className="lan-scheduled">
            ⚠ Langganan disuspend. Anda tidak bisa mengubah atau membatalkannya sendiri —
            hubungi admin untuk mengaktifkannya kembali.
          </div>
        )}
      </div>

      {/* Usage Card */}
      <div className="lan-card lan-card--usage">
        <div className="lan-usage-header">
          <h3 className="lan-usage-title">Penggunaan Sumber Daya</h3>
        </div>
        <div className="lan-usage-items">
          {isStorage ? (
            <>
              <div className="lan-usage-item">
                <div className="lan-usage-row">
                  <span className="lan-usage-label">STORAGE</span>
                  <span className="lan-usage-value">
                    {storageUsage ? formatBytes(storageUsage.storage_used_bytes) : '0 B'} / {formatBytes(sub.plan.storage_limit_bytes)}
                  </span>
                </div>
                <div className="lan-progress-bar">
                  <div className="lan-progress-fill" style={{ width: `${storageUsage?.storage_percent ?? 0}%` }} />
                </div>
                <span className="lan-usage-sub">{storageUsage?.storage_percent ?? 0}% terpakai</span>
              </div>
              <div className="lan-usage-item">
                <div className="lan-usage-row">
                  <span className="lan-usage-label">BUCKET</span>
                  <span className="lan-usage-value">
                    {storageUsage?.bucket_count ?? 0} / {storageUsage?.bucket_limit ?? sub.plan.bucket_limit}
                  </span>
                </div>
                <span className="lan-usage-sub">Unit penyimpanan aktif</span>
              </div>
            </>
          ) : (
            <>
              <div className="lan-usage-item">
                <div className="lan-usage-row">
                  <span className="lan-usage-label">SITUS</span>
                  <span className="lan-usage-value">
                    {hostingUsage?.site_count ?? 0} / {hostingUsage?.site_limit ?? sub.plan.static_site_limit}
                  </span>
                </div>
                <span className="lan-usage-sub">Situs statis aktif</span>
              </div>
              <div className="lan-usage-item">
                <div className="lan-usage-row">
                  <span className="lan-usage-label">BANDWIDTH</span>
                  <span className="lan-usage-value">
                    {formatBytes(hostingUsage?.bandwidth_used_bytes ?? 0)} / {formatBytes(hostingUsage?.bandwidth_limit_bytes ?? sub.plan.bandwidth_limit_bytes)}
                  </span>
                </div>
                <div className="lan-progress-bar">
                  <div className="lan-progress-fill lan-progress-fill--bandwidth"
                    style={{ width: `${hostingUsage?.bandwidth_limit_bytes ? Math.round((hostingUsage.bandwidth_used_bytes / hostingUsage.bandwidth_limit_bytes) * 100) : 0}%` }} />
                </div>
                <span className="lan-usage-sub">Trafik situs statis bulan ini</span>
              </div>
            </>
          )}
        </div>
        <button className="btn-outline-full" onClick={() => navigate('/kuota')}>
          Lihat Statistik Detail
        </button>
      </div>
    </div>
  )
}

export default function LanggananPage() {
  const [storageSub, setStorageSub] = useState(null)
  const [hostingSub, setHostingSub] = useState(null)
  const [storageUsage, setStorageUsage] = useState(null)
  const [hostingUsage, setHostingUsage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [cancelTarget, setCancelTarget] = useState(null) // { category, sub }
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState('')
  const [pinOpen, setPinOpen] = useState(false)
  const [pinErr, setPinErr] = useState('')
  const [pinCategory, setPinCategory] = useState(null)
  const navigate = useNavigate()

  function loadData() {
    return Promise.all([
      getMySubscription('storage').catch(() => null),
      getMySubscription('hosting').catch(() => null),
      getStorageUsage().catch(() => null),
      getHostingUsage().catch(() => null),
    ]).then(([s, h, su, hu]) => {
      setStorageSub(s?.data ?? null)
      setHostingSub(h?.data ?? null)
      setStorageUsage(su?.data ?? null)
      setHostingUsage(hu?.data ?? null)
    })
  }

  useEffect(() => { loadData().finally(() => setLoading(false)) }, [])

  async function doCancel(category, pin) {
    setCancelling(true)
    setError('')
    try {
      await cancelSubscription(category, pin)
      setCancelTarget(null); setPinOpen(false); setPinErr('')
      await loadData()
    } catch (err) {
      const code = getPinErrorCode(err)
      if (code === 'PIN_REQUIRED') {
        setCancelTarget(null); setPinCategory(category); setPinOpen(true); setPinErr('')
      } else if (code === 'PIN_INVALID') {
        setPinErr('PIN Transaksi salah.')
      } else {
        const d = err.response?.data?.detail
        setError(typeof d === 'string' ? d : 'Gagal membatalkan langganan')
      }
    } finally {
      setCancelling(false)
    }
  }

  if (loading) return <div className="langganan-loading">Memuat data langganan...</div>

  const hasAny = storageSub || hostingSub
  const cancelLabel = cancelTarget?.category === 'hosting' ? 'Hosting' : 'Storage'
  const cancelResource = cancelTarget?.category === 'hosting' ? 'situs' : 'bucket'

  return (
    <div className="langganan-page">
      <Navbar breadcrumbs={[
        { label: 'Ringkasan', path: '/dashboard' },
        { label: 'Detail Langganan' },
      ]} />

      <main className="langganan-main">
        <div className="langganan-header">
          <h1 className="langganan-title">Detail Langganan</h1>
          <p className="langganan-subtitle">Kelola paket layanan storage dan hosting Anda.</p>
        </div>

        {error && <div className="langganan-error">{error}</div>}

        {!hasAny ? (
          <div className="langganan-empty">
            <p>Anda belum memiliki langganan aktif.</p>
            <button className="btn-primary" onClick={() => navigate('/paket')}>Pilih Paket</button>
          </div>
        ) : (
          <div className="langganan-stack">
            {storageSub && (
              <section className="lan-service-section">
                <h2 className="lan-service-heading">Object Storage</h2>
                <SubBlock category="storage" sub={storageSub}
                  storageUsage={storageUsage} hostingUsage={hostingUsage}
                  navigate={navigate} onCancel={(c, s) => setCancelTarget({ category: c, sub: s })}
                  cancelling={cancelling} />
              </section>
            )}
            {hostingSub && (
              <section className="lan-service-section">
                <h2 className="lan-service-heading">Static Hosting</h2>
                <SubBlock category="hosting" sub={hostingSub}
                  storageUsage={storageUsage} hostingUsage={hostingUsage}
                  navigate={navigate} onCancel={(c, s) => setCancelTarget({ category: c, sub: s })}
                  cancelling={cancelling} />
              </section>
            )}
          </div>
        )}
      </main>

      <footer className="langganan-footer">
        <span>© 2026 JADESTACK</span>
        <div className="langganan-footer-links">
          <a href="#">Dokumentasi</a>
          <a href="#">Privasi</a>
          <a href="#">Syarat &amp; Ketentuan</a>
        </div>
      </footer>

      {/* Modal konfirmasi batalkan langganan */}
      {cancelTarget && (
        <div className="modal-overlay" onClick={() => !cancelling && setCancelTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Turun ke Paket Free {cancelLabel}</h2>
              <button className="modal-close" onClick={() => setCancelTarget(null)}>✕</button>
            </div>
            <div className="lan-cancel-body">
              <p className="lan-cancel-text">
                Turunkan langganan <strong>{cancelTarget.sub.plan.name}</strong> ke <strong>paket Free</strong>?
              </p>
              <ul className="lan-cancel-list">
                <li>Anda <strong>tetap berlangganan</strong>, tetapi di paket <strong>Free</strong> (kapasitas lebih kecil).</li>
                <li>{cancelResource === 'situs' ? 'Situs' : 'Bucket'} &amp; data <strong>tidak dihapus</strong>. Jika pemakaian melebihi limit Free → status <strong>OVER_QUOTA</strong> (hanya bisa lihat/hapus sampai dirapikan).</li>
                <li>Access key <strong>tetap aktif</strong> (langganan berlanjut).</li>
              </ul>
            </div>
            <div className="modal-actions">
              <button className="modal-btn-cancel" onClick={() => setCancelTarget(null)} disabled={cancelling}>Batal</button>
              <button className="modal-btn-delete" onClick={() => doCancel(cancelTarget.category)} disabled={cancelling}>
                {cancelling ? 'Memproses...' : 'Ya, Turun ke Free'}
              </button>
            </div>
          </div>
        </div>
      )}

      <PinPromptModal
        open={pinOpen}
        title="Turun ke Paket Free"
        description="Masukkan PIN Transaksi untuk menurunkan langganan ke paket Free."
        error={pinErr}
        busy={cancelling}
        onSubmit={(pin) => doCancel(pinCategory, pin)}
        onClose={() => { setPinOpen(false); setPinErr('') }}
      />
    </div>
  )
}
