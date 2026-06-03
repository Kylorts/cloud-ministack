import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { getBucket, getObjects, uploadFile, downloadFile, deleteFile, getStorageUsage } from '../services/storage'
import { getMySubscription } from '../services/subscriptions'
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
  const d = new Date(dateStr)
  const time = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  const date = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${time} · ${date}`
}

function getFileTypeBadge(contentType) {
  if (!contentType || contentType.includes('octet-stream')) return 'FILE'
  if (contentType.includes('pdf')) return 'PDF'
  if (contentType.includes('html')) return 'HTML'
  if (contentType.includes('css')) return 'CSS'
  if (contentType.includes('javascript')) return 'JS'
  if (contentType.includes('json')) return 'JSON'
  if (contentType.includes('xml')) return 'XML'
  if (contentType.includes('zip')) return 'ZIP'
  if (contentType.includes('rar')) return 'RAR'
  if (contentType.includes('png')) return 'PNG'
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'JPG'
  if (contentType.includes('gif')) return 'GIF'
  if (contentType.includes('webp')) return 'WEBP'
  if (contentType.includes('svg')) return 'SVG'
  if (contentType.includes('mp4')) return 'MP4'
  if (contentType.includes('mp3')) return 'MP3'
  if (contentType.includes('text/plain')) return 'TXT'
  if (contentType.includes('image')) return 'IMG'
  if (contentType.includes('video')) return 'VIDEO'
  if (contentType.includes('audio')) return 'AUDIO'
  const sub = contentType.split('/')[1]?.toUpperCase() ?? 'FILE'
  return sub.length > 6 ? 'FILE' : sub
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
function UploadModal({ bucketId, maxFileSizeBytes, storageUsedBytes, storageLimitBytes, onClose, onSuccess }) {
  const [file, setFile] = useState(null)
  const [fileSizeError, setFileSizeError] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)

  function validateAndSetFile(f) {
    if (!f) return
    if (maxFileSizeBytes && f.size > maxFileSizeBytes) {
      const maxMb = (maxFileSizeBytes / (1024 * 1024)).toFixed(0)
      setFileSizeError(`File terlalu besar. Maksimal ${maxMb} MB untuk paket Anda (file ini ${formatBytes(f.size)}).`)
    } else if (storageLimitBytes && (storageUsedBytes + f.size) > storageLimitBytes) {
      const sisa = storageLimitBytes - storageUsedBytes
      setFileSizeError(`Kuota storage tidak cukup. Sisa ruang: ${formatBytes(sisa)}, ukuran file: ${formatBytes(f.size)}.`)
    } else {
      setFileSizeError('')
    }
    setFile(f)
  }

  function handleDragOver(e) { e.preventDefault(); setDragging(true) }
  function handleDragLeave(e) { e.preventDefault(); setDragging(false) }
  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    validateAndSetFile(e.dataTransfer.files[0])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!file || fileSizeError) return
    setError('')
    setLoading(true)
    try {
      await uploadFile(bucketId, file)
      onSuccess()
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(Array.isArray(detail) ? detail[0]?.msg : (detail || 'Gagal mengunggah file'))
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

          {/* Drop Zone */}
          <label
            className={`drop-zone ${dragging ? 'drop-zone--active' : ''} ${file ? 'drop-zone--has-file' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              style={{ display: 'none' }}
              onChange={(e) => validateAndSetFile(e.target.files[0])}
            />
            {!file ? (
              <>
                <div className="drop-zone-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"
                      stroke={dragging ? '#062F28' : '#9ca3af'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p className="drop-zone-text">
                  {dragging ? 'Lepaskan file di sini' : 'Drag & drop file ke sini'}
                </p>
                <p className="drop-zone-sub">
                  atau <span className="drop-zone-browse">klik untuk memilih file</span>
                </p>
              </>
            ) : (
              <>
                <div className="drop-zone-icon drop-zone-icon--file">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#16a34a" strokeWidth="1.5"/>
                    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <p className="drop-zone-filename">{file.name}</p>
                <p className="drop-zone-sub">
                  {formatBytes(file.size)} · <span className="drop-zone-browse">ganti file</span>
                </p>
              </>
            )}
          </label>

          {fileSizeError && <div className="modal-error">{fileSizeError}</div>}
          {error && <div className="modal-error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="modal-btn-cancel" onClick={onClose}>Batal</button>
            <button type="submit" className="modal-btn-submit" disabled={loading || !file || !!fileSizeError}>
              {loading ? 'Mengunggah...' : 'Unggah File'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Konfirmasi Delete Modal ── */
function DeleteConfirmModal({ filename, onConfirm, onCancel, loading }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Hapus File</h2>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>
        <div className="delete-confirm-body">
          <div className="delete-confirm-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className="delete-confirm-text">
            Yakin ingin menghapus file ini?
          </p>
          <p className="delete-confirm-filename">"{filename}"</p>
          <p className="delete-confirm-warn">File yang dihapus tidak dapat dikembalikan.</p>
        </div>
        <div className="modal-actions">
          <button className="modal-btn-cancel" onClick={onCancel} disabled={loading}>Batal</button>
          <button className="modal-btn-delete" onClick={onConfirm} disabled={loading}>
            {loading ? 'Menghapus...' : 'Ya, Hapus'}
          </button>
        </div>
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
  const [subscription, setSubscription] = useState(null)
  const [usage, setUsage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  function loadData() {
    return Promise.all([
      getBucket(id).catch((err) => {
        if (err.response?.status === 403) navigate('/paket', { replace: true })
        if (err.response?.status === 404) navigate('/storage', { replace: true })
        return { data: null }
      }),
      getObjects(id).catch(() => ({ data: [] })),
      getMySubscription().catch(() => ({ data: null })),
      getStorageUsage().catch(() => ({ data: null })),
    ]).then(([bucketRes, objRes, subRes, usageRes]) => {
      setBucket(bucketRes.data)
      setObjects(objRes.data)
      setSubscription(subRes.data)
      setUsage(usageRes.data)
    })
  }

  useEffect(() => {
    loadData().finally(() => setLoading(false))
  }, [id])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeletingId(deleteTarget.id)
    try {
      await deleteFile(id, deleteTarget.id)
      setObjects((prev) => prev.filter((o) => o.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal menghapus file')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleDownload(obj) {
    try {
      await downloadFile(id, obj.id, obj.filename)
    } catch (err) {
      if (err.response?.status === 404) {
        // File sudah dihapus dari DB oleh backend — hapus dari tampilan juga
        setObjects((prev) => prev.filter((o) => o.id !== obj.id))
      }
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
          <colgroup>
            <col /><col /><col /><col /><col />
          </colgroup>
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
                        onClick={() => setDeleteTarget(obj)}
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
          maxFileSizeBytes={usage?.max_file_size_bytes ?? subscription?.plan?.max_file_size_bytes ?? 0}
          storageUsedBytes={usage?.storage_used_bytes ?? 0}
          storageLimitBytes={usage?.storage_limit_bytes ?? 0}
          onClose={() => setShowUpload(false)}
          onSuccess={() => { setShowUpload(false); loadData() }}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          filename={deleteTarget.filename}
          loading={deletingId === deleteTarget.id}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
