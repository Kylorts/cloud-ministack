import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { getBucket, getObjects, uploadFile, downloadFile, deleteFile } from '../services/storage'
import './BucketDetailPage.css'

function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function DownloadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const gb = bytes / (1024 ** 3)
  if (gb >= 1) return `${parseFloat(gb.toFixed(1))} GB`
  const mb = bytes / (1024 ** 2)
  if (mb >= 1) return `${parseFloat(mb.toFixed(1))} MB`
  const kb = bytes / 1024
  if (kb >= 1) return `${parseFloat(kb.toFixed(0))} KB`
  return `${bytes} B`
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function getFileTypeBadge(contentType) {
  if (!contentType) return 'FILE'
  if (contentType.includes('html')) return 'TEXT/HTML'
  if (contentType.includes('css')) return 'TEXT/CSS'
  if (contentType.includes('javascript')) return 'TEXT/JS'
  if (contentType.includes('json')) return 'JSON'
  if (contentType.includes('image')) return 'IMAGE/' + contentType.split('/')[1]?.toUpperCase()
  if (contentType.includes('pdf')) return 'PDF'
  if (contentType.includes('zip')) return 'ZIP'
  if (contentType.includes('text')) return 'TEXT'
  return contentType.split('/')[1]?.toUpperCase() ?? 'FILE'
}

function FileTypeIcon({ contentType }) {
  const type = contentType ?? ''
  let color = '#6b7280'
  if (type.includes('html')) color = '#e34c26'
  else if (type.includes('css')) color = '#264de4'
  else if (type.includes('image')) color = '#10b981'
  else if (type.includes('javascript')) color = '#f59e0b'
  return (
    <span className="file-type-icon" style={{ background: color + '18', color }}>
      {getFileTypeBadge(contentType).slice(0, 4)}
    </span>
  )
}

/* ── Upload Modal ── */
function UploadModal({ bucketId, onClose, onSuccess }) {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!file) return
    setError('')
    setLoading(true)
    try {
      await uploadFile(bucketId, file)
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.detail || 'Gagal mengunggah file')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Unggah File</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-field">
            <label className="modal-label">Pilih File</label>
            <input
              type="file"
              className="modal-file-input"
              onChange={(e) => setFile(e.target.files[0])}
              required
            />
            {file && (
              <span className="modal-hint">
                {file.name} ({formatBytes(file.size)})
              </span>
            )}
          </div>
          {error && <div className="modal-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="modal-btn-cancel" onClick={onClose}>Batal</button>
            <button type="submit" className="modal-btn-submit" disabled={loading || !file}>
              {loading ? 'Mengunggah...' : 'Unggah File'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Main Page ── */
export default function BucketDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [bucket, setBucket] = useState(null)
  const [objects, setObjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  function loadData() {
    return Promise.all([
      getBucket(id),
      getObjects(id),
    ]).then(([bucketRes, objRes]) => {
      setBucket(bucketRes.data)
      setObjects(objRes.data)
    })
  }

  useEffect(() => {
    loadData().finally(() => setLoading(false))
  }, [id])

  async function handleDelete(obj) {
    if (!window.confirm(`Hapus file "${obj.filename}"?`)) return
    setDeletingId(obj.id)
    try {
      await deleteFile(id, obj.id)
      setObjects((prev) => prev.filter((o) => o.id !== obj.id))
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal menghapus file')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleDownload(obj) {
    try {
      await downloadFile(id, obj.id, obj.filename)
    } catch {
      alert('Gagal mengunduh file')
    }
  }

  const totalSize = objects.reduce((acc, o) => acc + (o.size_bytes ?? 0), 0)

  if (loading) return <div className="bucket-loading">Memuat bucket...</div>
  if (!bucket) return <div className="bucket-loading">Bucket tidak ditemukan.</div>

  return (
    <div className="bucket-page">
      <Navbar breadcrumbs={[
        { label: 'Sumber Daya Virtual', path: '/dashboard' },
        { label: 'Object Storage', path: '/storage' },
        { label: bucket.display_name },
      ]} />

      <main className="bucket-main">
        {/* Header */}
        <div className="bucket-header">
          <div className="bucket-header-left">
            <div className="bucket-title-row">
              <h1 className="bucket-name">{bucket.display_name}</h1>
              <span className="bucket-visibility-badge">
                {bucket.visibility === 'private' ? 'Pribadi' : 'Publik'}
              </span>
            </div>
            <div className="bucket-meta">
              <span>Total Ukuran: {formatBytes(totalSize)}</span>
              <span className="bucket-meta-sep">|</span>
              <span>{objects.length} Objek</span>
            </div>
          </div>
          <div className="bucket-header-actions">
            <button className="btn-outline" onClick={() => setShowUpload(true)}>
              <UploadIcon /> Unggah File
            </button>
          </div>
        </div>

        {/* Info cards */}
        <div className="bucket-info-cards">
          <div className="bucket-info-card">
            <span className="bucket-info-label">Jumlah File</span>
            <span className="bucket-info-value">{objects.length}</span>
          </div>
          <div className="bucket-info-card">
            <span className="bucket-info-label">Total Ukuran</span>
            <span className="bucket-info-value">{formatBytes(totalSize)}</span>
          </div>
          <div className="bucket-info-card">
            <span className="bucket-info-label">Visibilitas</span>
            <span className="bucket-info-value">
              {bucket.visibility === 'private' ? 'Pribadi' : 'Publik'}
            </span>
          </div>
          <div className="bucket-info-card">
            <span className="bucket-info-label">Status</span>
            <span className="bucket-info-value bucket-info-status">● {bucket.status === 'active' ? 'Aktif' : bucket.status}</span>
          </div>
        </div>

        {/* File table */}
        <table className="bucket-table">
          <thead>
            <tr>
              <th>NAMA FILE</th>
              <th>UKURAN</th>
              <th>TIPE FILE</th>
              <th>DIUNGGAH PADA</th>
              <th>AKSI</th>
            </tr>
          </thead>
          <tbody>
            {objects.length === 0 ? (
              <tr>
                <td colSpan={5} className="bucket-table-empty">
                  Belum ada file. Unggah file pertama Anda.
                </td>
              </tr>
            ) : (
              objects.map((obj) => (
                <tr key={obj.id}>
                  <td>
                    <div className="file-name-cell">
                      <FileTypeIcon contentType={obj.content_type} />
                      <span className="file-name">{obj.filename}</span>
                    </div>
                  </td>
                  <td className="file-meta">{formatBytes(obj.size_bytes)}</td>
                  <td>
                    <span className="file-type-badge">{getFileTypeBadge(obj.content_type)}</span>
                  </td>
                  <td className="file-meta">{formatDate(obj.uploaded_at)}</td>
                  <td>
                    <div className="file-actions">
                      <button
                        className="file-action-btn file-action-btn--download"
                        onClick={() => handleDownload(obj)}
                        title="Unduh"
                      >
                        <DownloadIcon />
                      </button>
                      <button
                        className="file-action-btn file-action-btn--delete"
                        onClick={() => handleDelete(obj)}
                        disabled={deletingId === obj.id}
                        title="Hapus"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {objects.length > 0 && (
          <div className="bucket-table-footer">
            Menampilkan {objects.length} file
          </div>
        )}
      </main>

      <footer className="bucket-footer">
        <span>© 2026 INI AWAN</span>
        <div className="bucket-footer-links">
          <a href="#">Dokumentasi</a>
          <a href="#">Privasi</a>
          <a href="#">Syarat &amp; Ketentuan</a>
        </div>
      </footer>

      {showUpload && (
        <UploadModal
          bucketId={id}
          onClose={() => setShowUpload(false)}
          onSuccess={() => { setShowUpload(false); loadData() }}
        />
      )}
    </div>
  )
}
