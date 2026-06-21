import { useEffect, useState } from 'react'
import { parseUTC } from '../utils/datetime'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import DormantNotice from '../components/DormantNotice'
import { getSites, createSite, getHostingUsage } from '../services/hosting'
import { getSubscriptionHistory, categoryState } from '../services/subscriptions'
import { usePinPrompt } from '../utils/usePinPrompt'
import './HostingPage.css'

function PlusIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
}
function GlobeIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#6b7280" strokeWidth="1.6"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" stroke="#6b7280" strokeWidth="1.6"/></svg>
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const gb = bytes / (1024 ** 3)
  if (gb >= 1) return `${parseFloat(gb.toFixed(1))} GB`
  const mb = bytes / (1024 ** 2)
  if (mb >= 1) return `${parseFloat(mb.toFixed(1))} MB`
  const kb = bytes / 1024
  return `${parseFloat(kb.toFixed(0))} KB`
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = parseUTC(dateStr)
  const t = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  return `${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}, ${t} WIB`
}

/* ── Modal Buat Situs ── */
function validateSiteName(val) {
  if (!val) return ''
  if (val.length < 3) return 'Nama situs minimal 3 karakter'
  if (val.length > 63) return 'Nama situs maksimal 63 karakter'
  if (val.startsWith('-')) return 'Tidak boleh diawali tanda hubung (-)'
  if (val.endsWith('-')) return 'Tidak boleh diakhiri tanda hubung (-)'
  return ''
}

function CreateSiteModal({ onClose, onSuccess }) {
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { run: runPin, pinModal } = usePinPrompt({ title: 'Buat Situs', description: 'Masukkan PIN Transaksi untuk membuat situs.' })

  function handleNameChange(e) {
    // Hanya karakter yang valid untuk URL situs: huruf kecil, angka, tanda hubung.
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 63)
    setName(val)
    setNameError(validateSiteName(val))
  }

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    runPin((pin) => createSite(name, pin))
      .then(() => onSuccess())
      .catch((err) => {
        if (err?.pinCancelled) return
        const detail = err.response?.data?.detail
        setError(Array.isArray(detail) ? detail[0]?.msg : (typeof detail === 'string' ? detail : 'Gagal membuat situs'))
      })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Buat Situs Baru</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-field">
            <label className="modal-label">Nama Situs</label>
            <input
              className={`modal-input ${nameError ? 'modal-input--error' : name.length >= 3 ? 'modal-input--valid' : ''}`}
              type="text"
              placeholder="contoh: portofolio-saya"
              value={name}
              onChange={handleNameChange}
              required
            />
            {nameError
              ? <span className="modal-hint modal-hint--error">⚠ {nameError}</span>
              : <span className="modal-hint">3–63 karakter. Huruf kecil, angka, dan tanda hubung (-). Dipakai langsung sebagai URL situs.</span>}
          </div>
          {error && <div className="modal-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="modal-btn-cancel" onClick={onClose}>Batal</button>
            <button type="submit" className="modal-btn-submit" disabled={loading || !!nameError || name.length < 3}>
              {loading ? 'Membuat...' : 'Buat Situs'}
            </button>
          </div>
        </form>
      </div>
      {pinModal}
    </div>
  )
}

export default function HostingPage() {
  const [sites, setSites] = useState([])
  const [usage, setUsage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [hostingState, setHostingState] = useState('active') // 'active' | 'dormant' | 'none'
  const navigate = useNavigate()

  function loadData() {
    return Promise.all([
      getSites().catch(() => ({ data: [] })),
      getHostingUsage().catch(() => ({ data: null })),
      getSubscriptionHistory().catch(() => ({ data: [] })),
    ]).then(([sitesRes, usageRes, histRes]) => {
      setSites(sitesRes.data || [])
      setUsage(usageRes.data)
      setHostingState(categoryState(histRes.data, 'hosting'))
    })
  }

  useEffect(() => {
    loadData().finally(() => setLoading(false))
  }, [])

  // Belum pernah berlangganan hosting → arahkan ke pilih paket.
  useEffect(() => {
    if (!loading && hostingState === 'none') navigate('/paket?kategori=hosting', { replace: true })
  }, [loading, hostingState, navigate])

  if (loading) return <div className="hosting-loading">Memuat data hosting...</div>

  if (hostingState === 'dormant') {
    return (
      <div className="hosting-page">
        <Navbar breadcrumbs={[
          { label: 'Sumber Daya Virtual', path: '/dashboard' },
          { label: 'Static Hosting' },
        ]} />
        <main className="hosting-main">
          <DormantNotice serviceName="Static Hosting" paketPath="/paket?kategori=hosting" />
        </main>
      </div>
    )
  }

  const siteCount = usage?.site_count ?? sites.length
  const siteLimit = usage?.site_limit ?? 0
  const siteLimitReached = siteLimit > 0 && siteCount >= siteLimit
  const subStatus = usage?.subscription_status
  const addBlocked = subStatus === 'over_quota' || subStatus === 'suspended'
  const createSiteDisabled = siteLimitReached || addBlocked
  const createSiteTitle = subStatus === 'suspended'
    ? 'Langganan disuspend — tidak bisa membuat situs'
    : subStatus === 'over_quota'
      ? 'Kuota terlampaui (OVER_QUOTA) — tidak bisa membuat situs'
      : siteLimitReached
        ? `Batas ${siteLimit} situs tercapai — upgrade paket atau hapus situs lain`
        : 'Buat situs baru'
  const bwUsed = usage?.bandwidth_used_bytes ?? 0
  const bwLimit = usage?.bandwidth_limit_bytes ?? 0
  const bwPercent = bwLimit ? Math.min(100, Math.round((bwUsed / bwLimit) * 100)) : 0

  return (
    <div className="hosting-page">
      <Navbar breadcrumbs={[
        { label: 'Sumber Daya Virtual', path: '/dashboard' },
        { label: 'Static Hosting' },
      ]} />

      <main className="hosting-main">
        <div className="hosting-page-header">
          <div>
            <h1 className="hosting-title">Static Hosting</h1>
            <p className="hosting-subtitle">Kelola dan deploy website statis Anda.</p>
          </div>
          <button className="btn-create-site" onClick={() => setShowModal(true)} disabled={createSiteDisabled} title={createSiteTitle}>
            <PlusIcon /> Buat Situs Baru
          </button>
        </div>

        {usage?.subscription_status === 'over_quota' && (
          <div className="hosting-warning-banner">
            ⚠ Kuota hosting terlampaui (OVER_QUOTA). Anda masih bisa melihat & menghapus,
            tetapi <strong>tidak bisa membuat situs / deploy baru</strong>.
            {usage.grace_until && (
              <> Rapikan sebelum <strong>{parseUTC(usage.grace_until).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong> atau langganan akan di-<strong>suspend</strong> (situs offline).</>
            )}
            {' '}<a href="/paket?kategori=hosting" className="hosting-warning-link">Upgrade paket</a> atau kurangi pemakaian.
          </div>
        )}
        {usage?.subscription_status === 'suspended' && (
          <div className="hosting-warning-banner">
            ⛔ Langganan hosting Anda <strong>disuspend</strong> (grace period habis). Semua situs Anda
            <strong> offline (503)</strong> dan deploy baru dinonaktifkan. Hubungi admin untuk memulihkan.
          </div>
        )}
        {bwLimit > 0 && bwUsed >= bwLimit && (
          <div className="hosting-warning-banner">
            ⛔ <strong>Kuota bandwidth bulan ini habis.</strong> Situs Anda berhenti tayang (HTTP 429)
            sampai periode berikutnya atau Anda upgrade paket.
            {' '}<a href="/paket?kategori=hosting" className="hosting-warning-link">Upgrade paket</a>.
          </div>
        )}
        {sites.some((s) => s.dormant) && (
          <div className="hosting-warning-banner">
            ℹ Beberapa situs <strong>dorman</strong> karena melebihi batas jumlah situs paket Anda
            (situs terbaru). Situs dorman masih bisa dikelola/dihapus, tetapi <strong>tidak bisa deploy baru</strong>.
            {' '}<a href="/paket?kategori=hosting" className="hosting-warning-link">Upgrade paket</a> atau hapus situs lain.
          </div>
        )}

        {/* Stat cards */}
        <div className="hosting-stats">
          <div className="hosting-stat-card">
            <span className="hosting-stat-label">Penggunaan Situs Statis</span>
            <div className="hosting-stat-big">{siteCount}<span className="hosting-stat-of"> dari {siteLimit} Situs</span></div>
          </div>
          <div className="hosting-stat-card">
            <span className="hosting-stat-label">Penggunaan Bandwidth</span>
            <div className="hosting-bw-row">
              <span className="hosting-bw-used">{formatBytes(bwUsed)}</span>
              <span className="hosting-bw-limit">{formatBytes(bwLimit)}</span>
            </div>
            <div className="hosting-bar"><div className="hosting-bar-fill" style={{ width: `${bwPercent}%` }} /></div>
          </div>
        </div>

        {/* Sites table */}
        <table className="hosting-table">
          <colgroup><col /><col /><col /><col /></colgroup>
          <thead>
            <tr>
              <th>NAMA SITUS &amp; URL</th>
              <th>STATUS</th>
              <th>TERAKHIR DIDEPLOY</th>
              <th>AKSI</th>
            </tr>
          </thead>
          <tbody>
            {sites.length === 0 ? (
              <tr><td colSpan={4} className="hosting-table-empty">Belum ada situs. Buat situs pertama Anda.</td></tr>
            ) : sites.map((site) => (
              <tr key={site.id}>
                <td>
                  <div className="site-name-cell">
                    <span className="site-name">{site.site_name}</span>
                    <a href={site.url} target="_blank" rel="noreferrer" className="site-url">{site.url}</a>
                  </div>
                </td>
                <td>
                  {site.dormant
                    ? <span className="site-status site-status--dormant" title="Melebihi batas jumlah situs paket — terkunci dari deploy">Dorman</span>
                    : <span className={`site-status site-status--${site.status}`}>
                        {site.status === 'active' ? 'Aktif' : site.status === 'suspended' ? 'Nonaktif' : site.status}
                      </span>}
                </td>
                <td className="hosting-table-meta">{site.last_deployed_at ? formatDate(site.last_deployed_at) : 'Belum deploy'}</td>
                <td>
                  <button className="site-open-btn" onClick={() => navigate(`/hosting/sites/${site.slug}`)}>Kelola</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sites.length > 0 && <div className="hosting-table-footer">Menampilkan {sites.length} situs</div>}
      </main>

      <footer className="hosting-footer">
        <span>© 2026 JADESTACK</span>
        <div className="hosting-footer-links">
          <a href="#">Dokumentasi</a><a href="#">Privasi</a><a href="#">Syarat &amp; Ketentuan</a>
        </div>
      </footer>

      {showModal && (
        <CreateSiteModal onClose={() => setShowModal(false)} onSuccess={() => { setShowModal(false); loadData() }} />
      )}
    </div>
  )
}
