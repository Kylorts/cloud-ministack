import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { getSite, deploySite, rollbackDeployment, deleteSite, deleteDeployment } from '../services/hosting'
import './SiteDetailPage.css'

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const mb = bytes / (1024 ** 2)
  if (mb >= 1) return `${parseFloat(mb.toFixed(1))} MB`
  const kb = bytes / 1024
  return `${parseFloat(kb.toFixed(0))} KB`
}
function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  const t = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  const date = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${t} · ${date}`
}

/* ── Deploy Modal (upload ZIP) ── */
function DeployModal({ siteId, onClose, onSuccess }) {
  const [file, setFile] = useState(null)
  const [prefix, setPrefix] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)

  function pick(f) {
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.zip')) {
      setError('File harus berformat .zip')
      return
    }
    setError('')
    setFile(f)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!file) return
    setError(''); setLoading(true)
    try {
      await deploySite(siteId, file, prefix)
      onSuccess()
    } catch (err) {
      const d = err.response?.data?.detail
      setError(Array.isArray(d) ? d[0]?.msg : (d || 'Gagal deploy'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Deploy Versi Baru</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <p className="deploy-desc">Upload file ZIP berisi build website Anda (harus ada <code>index.html</code>).</p>

          <label
            className={`deploy-drop ${dragging ? 'deploy-drop--active' : ''} ${file ? 'deploy-drop--has' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={(e) => { e.preventDefault(); setDragging(false) }}
            onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files[0]) }}
          >
            <input type="file" accept=".zip" style={{ display: 'none' }} onChange={(e) => pick(e.target.files[0])} />
            {!file ? (
              <>
                <div className="deploy-drop-icon">📦</div>
                <p className="deploy-drop-text">{dragging ? 'Lepaskan ZIP di sini' : 'Drag & drop file ZIP'}</p>
                <p className="deploy-drop-sub">atau <span className="deploy-browse">klik untuk pilih file</span></p>
              </>
            ) : (
              <>
                <div className="deploy-drop-icon">✓</div>
                <p className="deploy-drop-name">{file.name}</p>
                <p className="deploy-drop-sub">{formatBytes(file.size)} · <span className="deploy-browse">ganti file</span></p>
              </>
            )}
          </label>

          <div className="modal-field">
            <label className="modal-label">Folder / Prefix (Opsional)</label>
            <input className="modal-input" type="text" placeholder="contoh: build atau public"
              value={prefix} onChange={(e) => setPrefix(e.target.value)} />
            <span className="modal-hint">Kosongkan jika index.html ada di root ZIP. Deployment sebelumnya akan ditimpa.</span>
          </div>

          {error && <div className="modal-error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="modal-btn-cancel" onClick={onClose}>Batal</button>
            <button type="submit" className="modal-btn-submit" disabled={loading || !file}>
              {loading ? 'Deploying...' : 'Mulai Deploy'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function SiteDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [site, setSite] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showDeploy, setShowDeploy] = useState(false)
  const [rollbackTarget, setRollbackTarget] = useState(null)
  const [showDelete, setShowDelete] = useState(false)
  const [deleteDepTarget, setDeleteDepTarget] = useState(null)
  const [busy, setBusy] = useState(false)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 5

  function loadData() {
    return getSite(id)
      .then((r) => setSite(r.data))
      .catch((err) => {
        if (err.response?.status === 403) navigate('/paket?kategori=hosting', { replace: true })
        else if (err.response?.status === 404) navigate('/hosting', { replace: true })
      })
  }

  useEffect(() => { loadData().finally(() => setLoading(false)) }, [id])

  async function confirmRollback() {
    setBusy(true)
    try {
      await rollbackDeployment(id, rollbackTarget.id)
      setRollbackTarget(null)
      await loadData()
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal rollback')
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    setBusy(true)
    try {
      await deleteSite(id)
      navigate('/hosting', { replace: true })
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal menghapus situs')
      setBusy(false)
    }
  }

  async function confirmDeleteDep() {
    setBusy(true)
    try {
      await deleteDeployment(id, deleteDepTarget.id)
      setDeleteDepTarget(null)
      await loadData()
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal menghapus deployment')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="site-loading">Memuat situs...</div>
  if (!site) return <div className="site-loading">Situs tidak ditemukan.</div>

  const activeDep = site.deployments?.find((d) => d.is_active)
  const allDeps = site.deployments ?? []

  return (
    <div className="site-page">
      <Navbar breadcrumbs={[
        { label: 'Sumber Daya Virtual', path: '/dashboard' },
        { label: 'Static Hosting', path: '/hosting' },
        { label: site.site_name },
      ]} />

      <main className="site-main">
        <div className="site-header">
          <div>
            <div className="site-title-row">
              <h1 className="site-name-title">{site.site_name}</h1>
              <span className={`site-status site-status--${site.status}`}>
                {site.status === 'active' ? 'Aktif' : site.status}
              </span>
            </div>
            <a href={site.url} target="_blank" rel="noreferrer" className="site-detail-url">{site.url} ↗</a>
          </div>
          <div className="site-header-actions">
            <button className="btn-danger-outline" onClick={() => setShowDelete(true)}>Hapus Situs</button>
            <a href={site.url} target="_blank" rel="noreferrer" className="btn-outline">Buka Situs</a>
            <button className="btn-primary-dark" onClick={() => setShowDeploy(true)}>Deploy Versi Baru</button>
          </div>
        </div>

        {/* Active deployment */}
        {activeDep ? (
          <div className="active-dep-card">
            <div className="active-dep-item">
              <span className="active-dep-label">ID DEPLOYMENT</span>
              <span className="active-dep-value mono">{activeDep.deployment_ref}</span>
            </div>
            <div className="active-dep-item">
              <span className="active-dep-label">WAKTU DEPLOY</span>
              <span className="active-dep-value">{formatDate(activeDep.deployed_at)}</span>
            </div>
            <div className="active-dep-item">
              <span className="active-dep-label">UKURAN BUILD</span>
              <span className="active-dep-value">{formatBytes(activeDep.total_size_bytes)}</span>
            </div>
            <div className="active-dep-item">
              <span className="active-dep-label">JUMLAH FILE</span>
              <span className="active-dep-value">{activeDep.file_count}</span>
            </div>
          </div>
        ) : (
          <div className="active-dep-empty">Situs belum di-deploy. Klik "Deploy Versi Baru" untuk mulai.</div>
        )}

        {/* Deployment history */}
        <h2 className="site-section-title">Riwayat Deployment</h2>
        <table className="dep-table">
          <colgroup><col /><col /><col /><col /><col /><col /></colgroup>
          <thead>
            <tr>
              <th>ID DEPLOYMENT</th><th>STATUS</th><th>JUMLAH FILE</th>
              <th>UKURAN TOTAL</th><th>WAKTU DEPLOY</th><th>AKSI</th>
            </tr>
          </thead>
          <tbody>
            {allDeps.length === 0 ? (
              <tr><td colSpan={6} className="dep-empty">Belum ada deployment.</td></tr>
            ) : allDeps.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((dep) => (
              <tr key={dep.id}>
                <td className="mono">{dep.deployment_ref}</td>
                <td>
                  {dep.is_active
                    ? <span className="dep-badge dep-badge--active">● Aktif</span>
                    : <span className="dep-badge dep-badge--inactive">Tidak Aktif</span>}
                </td>
                <td>{dep.file_count}</td>
                <td>{formatBytes(dep.total_size_bytes)}</td>
                <td className="dep-meta">{formatDate(dep.deployed_at)}</td>
                <td>
                  {!dep.is_active && (
                    <div className="dep-actions">
                      {dep.status === 'success' && (
                        <button className="dep-rollback" onClick={() => setRollbackTarget(dep)}>
                          Jadikan Aktif
                        </button>
                      )}
                      <button className="dep-delete" onClick={() => setDeleteDepTarget(dep)} title="Hapus deployment">
                        <TrashIcon />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {allDeps.length > PAGE_SIZE && (
          <div className="dep-pagination">
            <span className="dep-pg-info">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, allDeps.length)} dari {allDeps.length} deployment
            </span>
            <div className="dep-pg-controls">
              <button className="dep-pg-btn" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>‹ Sebelumnya</button>
              <span className="dep-pg-page">Hal. {page} / {Math.ceil(allDeps.length / PAGE_SIZE)}</span>
              <button className="dep-pg-btn" disabled={page >= Math.ceil(allDeps.length / PAGE_SIZE)} onClick={() => setPage((p) => p + 1)}>Berikutnya ›</button>
            </div>
          </div>
        )}
      </main>

      <footer className="site-footer">
        <span>© 2026 INI AWAN</span>
        <div className="site-footer-links"><a href="#">Dokumentasi</a><a href="#">Privasi</a><a href="#">Syarat &amp; Ketentuan</a></div>
      </footer>

      {showDeploy && (
        <DeployModal siteId={id} onClose={() => setShowDeploy(false)} onSuccess={() => { setShowDeploy(false); loadData() }} />
      )}

      {rollbackTarget && (
        <div className="modal-overlay" onClick={() => !busy && setRollbackTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Jadikan Versi Aktif</h2>
              <button className="modal-close" onClick={() => setRollbackTarget(null)}>✕</button>
            </div>
            <div className="confirm-body">
              <div className="confirm-icon confirm-icon--blue">✓</div>
              <p className="confirm-text">Jadikan versi ini sebagai deployment aktif?</p>
              <p className="confirm-sub mono">{rollbackTarget.deployment_ref}</p>
              <p className="confirm-note">Situs akan langsung menyajikan versi ini.</p>
            </div>
            <div className="modal-actions">
              <button className="modal-btn-cancel" onClick={() => setRollbackTarget(null)} disabled={busy}>Batal</button>
              <button className="modal-btn-submit" onClick={confirmRollback} disabled={busy}>
                {busy ? 'Memproses...' : 'Ya, Aktifkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDelete && (
        <div className="modal-overlay" onClick={() => !busy && setShowDelete(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Hapus Situs</h2>
              <button className="modal-close" onClick={() => setShowDelete(false)}>✕</button>
            </div>
            <div className="confirm-body">
              <div className="confirm-icon confirm-icon--red">🗑</div>
              <p className="confirm-text">Yakin ingin menghapus situs ini?</p>
              <p className="confirm-sub">"{site.site_name}"</p>
              <p className="confirm-note confirm-note--danger">Semua deployment akan dihapus permanen dan tidak dapat dikembalikan.</p>
            </div>
            <div className="modal-actions">
              <button className="modal-btn-cancel" onClick={() => setShowDelete(false)} disabled={busy}>Batal</button>
              <button className="modal-btn-delete" onClick={confirmDelete} disabled={busy}>
                {busy ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteDepTarget && (
        <div className="modal-overlay" onClick={() => !busy && setDeleteDepTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Hapus Deployment</h2>
              <button className="modal-close" onClick={() => setDeleteDepTarget(null)}>✕</button>
            </div>
            <div className="confirm-body">
              <div className="confirm-icon confirm-icon--red">🗑</div>
              <p className="confirm-text">Hapus versi deployment ini?</p>
              <p className="confirm-sub mono">{deleteDepTarget.deployment_ref}</p>
              <p className="confirm-note confirm-note--danger">File versi ini dihapus permanen dari server.</p>
            </div>
            <div className="modal-actions">
              <button className="modal-btn-cancel" onClick={() => setDeleteDepTarget(null)} disabled={busy}>Batal</button>
              <button className="modal-btn-delete" onClick={confirmDeleteDep} disabled={busy}>
                {busy ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
