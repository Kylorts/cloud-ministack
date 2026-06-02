import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import { getMySubscription } from '../services/subscriptions'
import { getBuckets } from '../services/storage'
import './KuotaPage.css'

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const gb = bytes / (1024 ** 3)
  if (gb >= 1) return `${parseFloat(gb.toFixed(1))} GB`
  const mb = bytes / (1024 ** 2)
  if (mb >= 1) return `${parseFloat(mb.toFixed(0))} MB`
  return `${bytes} B`
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function StorageIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <ellipse cx="12" cy="5" rx="9" ry="3" stroke="#062F28" strokeWidth="1.5" />
      <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" stroke="#062F28" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" stroke="#062F28" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function BandwidthIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M7 16l5-5 5 5M7 11l5-5 5 5" stroke="#062F28" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function BucketSmIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M3 6h18l-1.5 11A2 2 0 0 1 17.52 19H6.48A2 2 0 0 1 4.5 17L3 6z" stroke="#062F28" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function SiteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="#6b7280" strokeWidth="1.5" />
      <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function KeySmIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function CircularMini({ value, color = '#9FE870', size = 56 }) {
  const radius = 22
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference
  return (
    <svg width={size} height={size} viewBox="0 0 52 52">
      <circle cx="26" cy="26" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="5" />
      <circle cx="26" cy="26" r={radius} fill="none" stroke={color}
        strokeWidth="5" strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 26 26)" />
      <text x="26" y="30" textAnchor="middle" fontSize="10" fontWeight="700"
        fontFamily="var(--font-display)" fill="#062F28">
        {value}%
      </text>
    </svg>
  )
}

export default function KuotaPage() {
  const [subscription, setSubscription] = useState(null)
  const [buckets, setBuckets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getMySubscription().catch(() => ({ data: null })),
      getBuckets().catch(() => ({ data: [] })),
    ]).then(([subRes, bucketsRes]) => {
      setSubscription(subRes.data)
      setBuckets(bucketsRes.data)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="kuota-loading">Memuat data kuota...</div>

  const plan = subscription?.plan
  const storageLimit = plan?.storage_limit_bytes ?? 0
  const bandwidthLimit = plan?.bandwidth_limit_bytes ?? 0
  const bucketLimit = plan?.bucket_limit ?? 0
  const accessKeyLimit = plan?.access_key_limit ?? 0

  const storageUsed = 0 // akan diperbarui saat usage tracking ada
  const bandwidthUsed = 0
  const bucketCount = buckets.length
  const siteCount = 0
  const keyCount = 0

  const storagePercent = storageLimit ? Math.round((storageUsed / storageLimit) * 100) : 0
  const bandwidthPercent = bandwidthLimit ? Math.round((bandwidthUsed / bandwidthLimit) * 100) : 0
  const bucketPercent = bucketLimit ? Math.round((bucketCount / bucketLimit) * 100) : 0
  const sitePercent = 0
  const keyPercent = accessKeyLimit ? Math.round((keyCount / accessKeyLimit) * 100) : 0

  return (
    <div className="kuota-page">
      <Navbar breadcrumbs={[
        { label: 'Ringkasan', path: '/dashboard' },
        { label: 'Penggunaan & Kuota' },
      ]} />

      <main className="kuota-main">
        {/* Info banner */}
        {subscription && (
          <div className="kuota-banner">
            <span className="kuota-banner-icon">ℹ</span>
            <span>
              Siklus tagihan Anda saat ini akan diatur ulang pada{' '}
              <strong>{formatDate(subscription.current_period_end)}</strong>.
            </span>
          </div>
        )}

        {!subscription && (
          <div className="kuota-banner kuota-banner--warn">
            <span className="kuota-banner-icon">⚠</span>
            <span>Anda belum memiliki langganan aktif. Pilih paket untuk menggunakan layanan storage.</span>
          </div>
        )}

        {/* Lalu Lintas & Penyimpanan */}
        <section className="kuota-section">
          <h2 className="kuota-section-title">Lalu Lintas &amp; Penyimpanan</h2>
          <div className="kuota-traffic-grid">
            <div className="kuota-traffic-card">
              <div className="kuota-traffic-header">
                <div className="kuota-traffic-icon"><StorageIcon /></div>
                <span className="kuota-traffic-label">Object Storage</span>
                <span className="kuota-traffic-percent">{storagePercent}%</span>
              </div>
              <div className="kuota-bar">
                <div className="kuota-bar-fill" style={{ width: `${storagePercent}%`, background: '#9FE870' }} />
              </div>
              <p className="kuota-traffic-sub">
                {formatBytes(storageUsed)} dari {formatBytes(storageLimit)} terpakai
              </p>
            </div>

            <div className="kuota-traffic-card">
              <div className="kuota-traffic-header">
                <div className="kuota-traffic-icon"><BandwidthIcon /></div>
                <span className="kuota-traffic-label">Bandwidth Bulanan</span>
                <span className="kuota-traffic-percent kuota-traffic-percent--bw">{bandwidthPercent}%</span>
              </div>
              <div className="kuota-bar">
                <div className="kuota-bar-fill" style={{ width: `${bandwidthPercent}%`, background: '#f59e0b' }} />
              </div>
              <p className="kuota-traffic-sub">
                {formatBytes(bandwidthUsed)} dari {formatBytes(bandwidthLimit)} terpakai
              </p>
            </div>
          </div>
        </section>

        {/* Batas Sumber Daya */}
        <section className="kuota-section">
          <h2 className="kuota-section-title">Batas Sumber Daya</h2>
          <div className="kuota-resource-grid">
            <div className="kuota-resource-card">
              <div className="kuota-resource-top">
                <BucketSmIcon />
                <span className="kuota-resource-label">Bucket Aktif</span>
              </div>
              <CircularMini value={bucketPercent} color="#9FE870" />
              <p className="kuota-resource-sub">{bucketCount} dari {bucketLimit} Bucket</p>
            </div>

            <div className="kuota-resource-card">
              <div className="kuota-resource-top">
                <SiteIcon />
                <span className="kuota-resource-label">Situs Statis</span>
              </div>
              <CircularMini value={sitePercent} color="#3b82f6" />
              <p className="kuota-resource-sub">{siteCount} dari {plan?.static_site_limit ?? 0} Situs</p>
            </div>

            <div className="kuota-resource-card">
              <div className="kuota-resource-top">
                <KeySmIcon />
                <span className="kuota-resource-label">Access Keys</span>
              </div>
              <CircularMini value={keyPercent} color="#9FE870" />
              <p className="kuota-resource-sub">{keyCount} dari {accessKeyLimit} Keys</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="kuota-footer">
        <span>© 2026 INI AWAN</span>
        <div className="kuota-footer-links">
          <a href="#">Dokumentasi</a>
          <a href="#">Privasi</a>
          <a href="#">Syarat &amp; Ketentuan</a>
        </div>
      </footer>
    </div>
  )
}
