import { useEffect, useState } from 'react'
import { parseUTC } from '../utils/datetime'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { getPlans } from '../services/plans'
import { getMySubscription, subscribe, scheduleDowngrade, cancelScheduled } from '../services/subscriptions'
import './PaketPage.css'

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="#062F28" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 4L12 14.01l-3-3" stroke="#062F28" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const gb = bytes / (1024 ** 3)
  if (gb >= 1) return `${gb % 1 === 0 ? gb : gb.toFixed(1)} GB`
  const mb = bytes / (1024 ** 2)
  return `${mb % 1 === 0 ? mb : mb.toFixed(0)} MB`
}

function formatPrice(price) {
  if (!price || price === 0) return 'Gratis'
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(price)
}

function formatDate(s) {
  if (!s) return '-'
  return parseUTC(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function PaketPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [category, setCategory] = useState(searchParams.get('kategori') === 'hosting' ? 'hosting' : 'storage')
  const [plans, setPlans] = useState([])
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const navigate = useNavigate()

  function reload() {
    setLoading(true)
    return Promise.all([
      getPlans(category),
      getMySubscription(category).catch(() => ({ data: null })),
    ]).then(([plansRes, subRes]) => {
      setPlans([...(plansRes.data || [])].sort((a, b) => a.price - b.price))
      setSubscription(subRes.data)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { reload() }, [category])

  function switchCategory(cat) {
    setCategory(cat)
    setSearchParams({ kategori: cat })
    setError(''); setNotice('')
  }

  async function handleAction(plan, type) {
    setSubscribing(plan.id); setError(''); setNotice('')
    try {
      if (type === 'downgrade') {
        const res = await scheduleDowngrade(plan.id)
        setNotice(res.data?.message || 'Downgrade dijadwalkan.')
        await reload()
      } else {
        await subscribe(plan.id)
        navigate(category === 'hosting' ? '/hosting' : '/langganan')
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Gagal memproses')
    } finally {
      setSubscribing(null)
    }
  }

  async function handleCancelScheduled() {
    try { await cancelScheduled(category); setNotice('Jadwal downgrade dibatalkan.'); await reload() }
    catch (err) { setError(err.response?.data?.detail || 'Gagal membatalkan jadwal') }
  }

  const ACTIVE_LIKE = ['active', 'over_quota', 'suspended', 'past_due', 'pending_payment']
  const hasActivePlan = subscription && ACTIVE_LIKE.includes(subscription.status)
  const currentPlanId = hasActivePlan ? subscription.plan_id : null
  const currentPlanPrice = hasActivePlan ? (subscription.plan?.price ?? null) : null
  // Langganan NUNGGAK (past_due) atau DISUSPEND dikunci dari perubahan paket.
  const isPastDue = hasActivePlan && subscription.status === 'past_due'
  const isSuspended = hasActivePlan && subscription.status === 'suspended'
  const isLocked = isPastDue || isSuspended

  function getPlanAction(plan) {
    if (!currentPlanId) return { label: 'Pilih Paket', type: 'subscribe' }
    if (plan.id === currentPlanId) return { label: 'Paket Saat Ini', type: 'current' }
    if (plan.price > currentPlanPrice) return { label: 'Upgrade', type: 'upgrade' }
    return { label: 'Downgrade', type: 'downgrade' }
  }

  function getPlanBadge(plan, index) {
    if (plan.price === 0) return 'Gratis'
    return (['Mulai', 'Populer', 'Enterprise'])[index - 1] ?? ''
  }

  function planFeatures(plan) {
    if (category === 'hosting') {
      return [
        `${plan.static_site_limit} ${plan.static_site_limit === 1 ? 'Situs' : 'Situs'}`,
        `${formatBytes(plan.storage_limit_bytes)} Total Build`,
        `Bandwidth ${formatBytes(plan.bandwidth_limit_bytes)}/bulan`,
        `Deploy via ZIP`,
      ]
    }
    return [
      `${formatBytes(plan.storage_limit_bytes)} Storage`,
      `${plan.bucket_limit} ${plan.bucket_limit === 1 ? 'Bucket' : 'Buckets'}`,
      `Maks. ${formatBytes(plan.max_file_size_bytes)}/file`,
      `Bandwidth ${formatBytes(plan.bandwidth_limit_bytes)}/bulan`,
    ]
  }

  return (
    <div className="paket-page">
      <Navbar breadcrumbs={[
        { label: 'Ringkasan', path: '/dashboard' },
        { label: 'Paket Langganan' },
      ]} />

      <main className="paket-main">
        <div className="paket-header">
          <h1 className="paket-title">Pilih Paket Layanan</h1>
          <p className="paket-subtitle">Tingkatkan sumber daya cloud Anda sesuai kebutuhan proyek.</p>
        </div>

        {/* Tab kategori */}
        <div className="paket-tabs">
          <button className={`paket-tab ${category === 'storage' ? 'paket-tab--active' : ''}`} onClick={() => switchCategory('storage')}>
            Object Storage
          </button>
          <button className={`paket-tab ${category === 'hosting' ? 'paket-tab--active' : ''}`} onClick={() => switchCategory('hosting')}>
            Static Hosting
          </button>
        </div>

        {error && <div className="paket-error">{error}</div>}
        {notice && <div className="paket-notice">{notice}</div>}
        {subscription?.scheduled_plan_id && (
          <div className="paket-scheduled">
            ⏳ <strong>Downgrade ke {subscription.scheduled_plan_name}</strong> dijadwalkan berlaku pada{' '}
            <strong>{formatDate(subscription.current_period_end)}</strong>. Anda tetap di paket sekarang sampai itu.
            <button className="paket-scheduled-cancel" onClick={handleCancelScheduled}>Batalkan</button>
          </div>
        )}
        {isPastDue && (
          <div className="paket-error">
            ⚠ Langganan Anda <strong>belum lunas (nunggak)</strong>. Anda tidak bisa upgrade atau mengganti paket
            sampai tunggakan diselesaikan. Untuk berhenti, batalkan langganan (turun ke paket Free) di menu Langganan.
          </div>
        )}
        {isSuspended && (
          <div className="paket-error">
            ⚠ Langganan Anda <strong>sedang disuspend</strong>. Anda tidak bisa upgrade, mengganti, maupun
            membatalkan paket sendiri. Hubungi admin untuk mengaktifkannya kembali.
          </div>
        )}

        {loading ? (
          <div className="paket-loading-inline">Memuat paket...</div>
        ) : (
          <div className="paket-grid">
            {plans.map((plan, index) => {
              const action = getPlanAction(plan)
              const isCurrent = action.type === 'current'
              const isScheduled = subscription?.scheduled_plan_id === plan.id
              const lockedChange = isLocked && !isCurrent
              const disabled = isCurrent || isScheduled || subscribing === plan.id || lockedChange
              return (
                <div key={plan.id} className={`plan-card ${isCurrent ? 'plan-card--active' : ''}`}>
                  {isCurrent && <div className="plan-ribbon">AKTIF</div>}
                  {isScheduled && <div className="plan-ribbon plan-ribbon--scheduled">TERJADWAL</div>}
                  <div className="plan-badge">{getPlanBadge(plan, index)}</div>
                  <h2 className="plan-name">{plan.name}</h2>
                  <div className="plan-price">
                    <span className="plan-price-value">{formatPrice(plan.price)}</span>
                    <span className="plan-price-period"> /bulan</span>
                  </div>
                  <ul className="plan-features">
                    {planFeatures(plan).map((f, i) => (
                      <li key={i}><CheckIcon /> {f}</li>
                    ))}
                  </ul>
                  <button
                    className={`plan-btn plan-btn--${action.type}`}
                    disabled={disabled}
                    onClick={() => !disabled && handleAction(plan, action.type)}
                  >
                    {subscribing === plan.id ? 'Memproses...'
                      : isScheduled ? 'Terjadwal'
                      : lockedChange ? (isSuspended ? 'Terkunci (disuspend)' : 'Terkunci (nunggak)')
                      : action.label}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </main>

      <footer className="paket-footer">
        <span>© 2026 JADESTACK</span>
        <div className="paket-footer-links">
          <a href="#">Dokumentasi</a>
          <a href="#">Privasi</a>
          <a href="#">Syarat &amp; Ketentuan</a>
        </div>
      </footer>
    </div>
  )
}
