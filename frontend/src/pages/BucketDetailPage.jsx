import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import PinPromptModal from '../components/PinPromptModal'
import { getBucket, getObjects, uploadFile, downloadFile, deleteFile, deleteBucket, emptyBucket, getStorageUsage } from '../services/storage'
import { getMySubscription } from '../services/subscriptions'
import { getPinErrorCode } from '../services/security'
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

function getExtension(filename) {
  return filename?.split('.').pop()?.toLowerCase() ?? ''
}

function getFileTypeBadge(contentType, filename = '') {
  const ext = getExtension(filename)

  // Deteksi dari ekstensi file (lebih akurat untuk Office formats)
  const extMap = {
    xlsx: 'XLSX', xls: 'XLS', csv: 'CSV',
    docx: 'DOCX', doc: 'DOC',
    pptx: 'PPTX', ppt: 'PPT',
    pdf: 'PDF', txt: 'TXT', md: 'MD',
    png: 'PNG', jpg: 'JPG', jpeg: 'JPG', gif: 'GIF', webp: 'WEBP', svg: 'SVG', ico: 'ICO', bmp: 'BMP',
    mp4: 'MP4', mov: 'MOV', avi: 'AVI', mkv: 'MKV', webm: 'WEBM',
    mp3: 'MP3', wav: 'WAV', flac: 'FLAC', ogg: 'OGG',
    zip: 'ZIP', rar: 'RAR', gz: 'GZ', tar: 'TAR', '7z': '7Z',
    json: 'JSON', xml: 'XML', yaml: 'YAML', yml: 'YAML',
    html: 'HTML', css: 'CSS', js: 'JS', ts: 'TS',
    sql: 'SQL', db: 'DB', sqlite: 'DB',
    exe: 'EXE', msi: 'MSI', dmg: 'DMG', apk: 'APK', deb: 'DEB',
    iso: 'ISO', bin: 'BIN', dll: 'DLL',
  }
  if (extMap[ext]) return extMap[ext]

  // Fallback dari content type
  if (!contentType || contentType.includes('octet-stream')) return 'FILE'
  if (contentType.includes('pdf')) return 'PDF'
  if (contentType.includes('html')) return 'HTML'
  if (contentType.includes('css')) return 'CSS'
  if (contentType.includes('javascript')) return 'JS'
  if (contentType.includes('json')) return 'JSON'
  if (contentType.includes('zip')) return 'ZIP'
  if (contentType.includes('png')) return 'PNG'
  if (contentType.includes('jpeg')) return 'JPG'
  if (contentType.includes('gif')) return 'GIF'
  if (contentType.includes('mp4')) return 'MP4'
  if (contentType.includes('mp3')) return 'MP3'
  if (contentType.includes('text/plain')) return 'TXT'
  if (contentType.includes('image')) return 'IMG'
  if (contentType.includes('video')) return 'VIDEO'
  if (contentType.includes('audio')) return 'AUDIO'
  if (contentType.includes('xml')) return 'XML'
  return 'FILE'
}

function FileTypeIcon({ contentType, filename }) {
  const color = '#6b7280'
  return (
    <span className="file-type-icon" style={{ background: '#f3f4f6', color }}>
      {getFileTypeBadge(contentType, filename).slice(0, 4)}
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
  const [progress, setProgress] = useState(0)

  const maxMb = maxFileSizeBytes ? (maxFileSizeBytes / (1024 * 1024)).toFixed(0) : null

  function validateAndSetFile(f) {
    if (!f) return
    if (maxFileSizeBytes && f.size > maxFileSizeBytes) {
      setFileSizeError(`File terlalu besar. Maksimal ${maxMb} MB per file (file ini ${formatBytes(f.size)}).`)
    } else if (storageLimitBytes && (storageUsedBytes + f.size) > storageLimitBytes) {
      const sisa = storageLimitBytes - storageUsedBytes
      setFileSizeError(`Kuota storage tidak cukup. Sisa ruang: ${formatBytes(sisa)}.`)
    } else {
      setFileSizeError('')
    }
    setFile(f)
    setProgress(0)
  }

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
    setProgress(0)
    try {
      await uploadFile(bucketId, file, setProgress)
      onSuccess()
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(Array.isArray(detail) ? detail[0]?.msg : (detail || 'Gagal mengunggah file'))
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={() => !loading && onClose()}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Unggah File</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>

          {/* Drop Zone */}
          <label
            className={`up-drop ${dragging ? 'up-drop--active' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={(e) => { e.preventDefault(); setDragging(false) }}
            onDrop={handleDrop}
          >
            <input type="file" style={{ display: 'none' }}
              onChange={(e) => validateAndSetFile(e.target.files[0])} />
            <div className="up-drop-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"
                  stroke="#062F28" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="up-drop-text">Klik untuk memilih file atau seret file ke sini.</p>
            {maxMb && <p className="up-drop-sub">(Maks {maxMb}MB per file)</p>}
          </label>

          {/* File terpilih + progress */}
          {file && (
            <div className="up-file-row">
              <div className="up-file-head">
                <span className="up-file-name">
                  <span className="up-file-type">{getFileTypeBadge(file.type, file.name)}</span>
                  {file.name}
                </span>
                <span className={`up-file-pct ${progress === 100 && !loading ? '' : ''}`}>
                  {loading ? `${progress}% (Uploading...)` : (progress === 100 ? 'Selesai' : formatBytes(file.size))}
                </span>
              </div>
              <div className="up-progress"><div className="up-progress-fill" style={{ width: `${loading || progress ? progress : 0}%` }} /></div>
            </div>
          )}

          {fileSizeError && <div className="modal-error">{fileSizeError}</div>}
          {error && <div className="modal-error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="modal-btn-cancel" onClick={onClose} disabled={loading}>Tutup</button>
            <button type="submit" className="modal-btn-submit" disabled={loading || !file || !!fileSizeError}>
              {loading ? 'Mengunggah...' : 'Mulai Unggah'}
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
  const [showDeleteBucket, setShowDeleteBucket] = useState(false)
  const [deletingBucket, setDeletingBucket] = useState(false)
  const [pinOpen, setPinOpen] = useState(false)
  const [pinErr, setPinErr] = useState('')
  const [showEmptyBucket, setShowEmptyBucket] = useState(false)
  const [emptying, setEmptying] = useState(false)

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

  async function confirmDeleteBucket(pin) {
    setDeletingBucket(true)
    try {
      await deleteBucket(id, pin)
      navigate('/storage', { replace: true })
    } catch (err) {
      const code = getPinErrorCode(err)
      if (code === 'PIN_REQUIRED') { setShowDeleteBucket(false); setPinOpen(true); setPinErr(''); setDeletingBucket(false); return }
      if (code === 'PIN_INVALID') { setPinErr('PIN Transaksi salah.'); setDeletingBucket(false); return }
      const d = err.response?.data?.detail
      alert(typeof d === 'string' ? d : 'Gagal menghapus bucket')
      setDeletingBucket(false)
    }
  }

  async function handleEmptyBucket() {
    setEmptying(true)
    try {
      await emptyBucket(id)
      setShowEmptyBucket(false)
      await loadData()
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal mengosongkan bucket')
    } finally {
      setEmptying(false)
    }
  }

  const isEmpty = objects.length === 0
  const totalSize = objects.reduce((acc, o) => acc + (o.size_bytes ?? 0), 0)

  // ── Search & Pagination ──
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  const filtered = objects.filter((o) =>
    o.filename.toLowerCase().includes(search.toLowerCase())
  )
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function handleSearch(val) {
    setSearch(val)
    setPage(1)
  }

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
          </div>
          <div className="bucket-header-actions">
            <button className="btn-outline" onClick={() => setShowUpload(true)}>
              <UploadIcon /> Unggah File
            </button>
            <button
              className="btn-danger-outline"
              onClick={() => setShowEmptyBucket(true)}
              disabled={isEmpty}
              title={isEmpty ? 'Bucket sudah kosong' : 'Hapus semua file di bucket ini'}
            >
              <TrashIcon /> Hapus Semua File
            </button>
            <button
              className="btn-danger-outline"
              onClick={() => setShowDeleteBucket(true)}
              disabled={!isEmpty}
              title={isEmpty ? 'Hapus bucket ini' : 'Kosongkan bucket dulu (hapus semua file) sebelum menghapus'}
            >
              <TrashIcon /> Hapus Bucket
            </button>
          </div>
        </div>
        {!isEmpty && (
          <p className="bucket-delete-hint">
            Bucket hanya bisa dihapus jika kosong. Hapus semua file di dalamnya terlebih dahulu.
          </p>
        )}

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

        {/* Search bar */}
        <div className="bucket-table-toolbar">
          <div className="bucket-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M21 21L16.514 16.506M19 10.5C19 15.194 15.194 19 10.5 19C5.806 19 2 15.194 2 10.5C2 5.806 5.806 2 10.5 2C15.194 2 19 5.806 19 10.5Z" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              className="bucket-search-input"
              placeholder="Cari file..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
            {search && (
              <button className="bucket-search-clear" onClick={() => handleSearch('')}>✕</button>
            )}
          </div>
          <span className="bucket-table-count">
            {filtered.length} dari {objects.length} file
          </span>
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
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={5} className="bucket-table-empty">
                  {search ? `Tidak ada file yang cocok dengan "${search}"` : 'Belum ada file. Unggah file pertama Anda.'}
                </td>
              </tr>
            ) : (
              paginated.map((obj) => (
                <tr key={obj.id}>
                  <td>
                    <div className="file-name-cell">
                      <span className="file-name">{obj.filename}</span>
                    </div>
                  </td>
                  <td className="file-meta">{formatBytes(obj.size_bytes)}</td>
                  <td>
                    <span className="file-type-badge">{getFileTypeBadge(obj.content_type, obj.filename)}</span>
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

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="bucket-pagination">
            <span className="pagination-info">
              {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} dari {filtered.length} file
            </span>
            <div className="pagination-controls">
              <button
                className="pagination-btn"
                disabled={currentPage === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ‹ Sebelumnya
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .reduce((acc, p, idx, arr) => {
                  if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...')
                  acc.push(p)
                  return acc
                }, [])
                .map((p, idx) =>
                  p === '...'
                    ? <span key={`ellipsis-${idx}`} className="pagination-ellipsis">...</span>
                    : <button
                        key={p}
                        className={`pagination-num ${p === currentPage ? 'pagination-num--active' : ''}`}
                        onClick={() => setPage(p)}
                      >{p}</button>
                )
              }

              <button
                className="pagination-btn"
                disabled={currentPage === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Berikutnya ›
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="bucket-footer">
        <span>© 2026 JADESTACK</span>
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

      {showEmptyBucket && (
        <div className="modal-overlay" onClick={() => !emptying && setShowEmptyBucket(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Hapus Semua File</h2>
              <button className="modal-close" onClick={() => setShowEmptyBucket(false)}>✕</button>
            </div>
            <div className="delete-confirm-body">
              <div className="delete-confirm-icon"><TrashIcon /></div>
              <p className="delete-confirm-text">Hapus semua file di bucket ini?</p>
              <p className="delete-confirm-filename">{objects.length} file akan dihapus dari "{bucket.display_name}"</p>
              <p className="delete-confirm-warn">File yang dihapus tidak dapat dikembalikan.</p>
            </div>
            <div className="modal-actions">
              <button className="modal-btn-cancel" onClick={() => setShowEmptyBucket(false)} disabled={emptying}>Batal</button>
              <button className="modal-btn-delete" onClick={handleEmptyBucket} disabled={emptying}>
                {emptying ? 'Menghapus...' : 'Ya, Hapus Semua'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteBucket && (
        <div className="modal-overlay" onClick={() => !deletingBucket && setShowDeleteBucket(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Hapus Bucket</h2>
              <button className="modal-close" onClick={() => setShowDeleteBucket(false)}>✕</button>
            </div>
            <div className="delete-confirm-body">
              <div className="delete-confirm-icon"><TrashIcon /></div>
              <p className="delete-confirm-text">Yakin ingin menghapus bucket ini?</p>
              <p className="delete-confirm-filename">"{bucket.display_name}"</p>
              <p className="delete-confirm-warn">Bucket kosong ini akan dihapus permanen.</p>
            </div>
            <div className="modal-actions">
              <button className="modal-btn-cancel" onClick={() => setShowDeleteBucket(false)} disabled={deletingBucket}>Batal</button>
              <button className="modal-btn-delete" onClick={() => confirmDeleteBucket()} disabled={deletingBucket}>
                {deletingBucket ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      <PinPromptModal
        open={pinOpen}
        title="Hapus Bucket"
        description="Masukkan PIN Transaksi untuk menghapus bucket ini."
        error={pinErr}
        busy={deletingBucket}
        onSubmit={(pin) => confirmDeleteBucket(pin)}
        onClose={() => { setPinOpen(false); setPinErr('') }}
      />
    </div>
  )
}
