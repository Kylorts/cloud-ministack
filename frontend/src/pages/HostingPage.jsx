import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { getSites, createSite, getHostingUsage } from '../services/hosting'
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
  const d = new Date(dateStr)
  const t = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  return `${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}, ${t} WIB`
}

/* ── Modal Buat Situs ── */
function CreateSiteModal({ onClose, onSuccess }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await createSite(name)
      onSuccess()
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(Array.isArray(detail) ? detail[0]?.msg : (detail || 'Gagal membuat situs'))
    } finally {
      setLoading(false)
    }
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
              className="modal-input"
              type="text"
              placeholder="Contoh: Portofolio Saya"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <span className="modal-hint">URL akan dibuat otomatis dari nama situs (slug).</span>
          </div>
          {error && <div className="modal-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="modal-btn-cancel" onClick={onClose}>Batal</button>
            <button type="submit" className="modal-btn-submit" disabled={loading || name.trim().length < 1}>
              {loading ? 'Membuat...' : 'Buat Situs'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function HostingPage() {
  const [sites, setSites] = useState([])
  const [usage, setUsage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const navigate = useNavigate()

  function loadData() {
    return Promise.all([
      getSites().catch((err) => {
        if (err.response?.status === 403) navigate('/paket?kategori=hosting', { replace: true })
        return { data: [] }
      }),
      getHostingUsage().catch(() => ({ data: null })),
    ]).then(([sitesRes, usageRes]) => {
      setSites(sitesRes.data)
      setUsage(usageRes.data)
    })
  }

  useEffect(() => {
    loadData().finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="hosting-loading">Memuat data hosting...</div>

  const siteCount = usage?.site_count ?? sites.length
  const siteLimit = usage?.site_limit ?? 0
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
          <button className="btn-create-site" onClick={() => setShowModal(true)}>
            <PlusIcon /> Buat Situs Baru
          </button>
        </div>

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
                  <span className={`site-status site-status--${site.status}`}>
                    {site.status === 'active' ? 'Aktif' : site.status === 'suspended' ? 'Ditangguhkan' : site.status}
                  </span>
                </td>
                <td className="hosting-table-meta">{site.last_deployed_at ? formatDate(site.last_deployed_at) : 'Belum deploy'}</td>
                <td>
                  <button className="site-open-btn" onClick={() => navigate(`/hosting/sites/${site.id}`)}>Kelola</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sites.length > 0 && <div className="hosting-table-footer">Menampilkan {sites.length} situs</div>}
      </main>

      <footer className="hosting-footer">
        <span>© 2026 INI AWAN</span>
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
