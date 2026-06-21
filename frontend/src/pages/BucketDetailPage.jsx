import { useEffect, useState } from 'react'
import { parseUTC } from '../utils/datetime'
import { useParams, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import PinPromptModal from '../components/PinPromptModal'
import { getBucket, getObjects, uploadFile, downloadFile, deleteFile, deleteBucket, emptyBucket, getStorageUsage } from '../services/storage'
import { getMySubscription } from '../services/subscriptions'
import { getPinErrorCode } from '../services/security'
import { usePinPrompt } from '../utils/usePinPrompt'
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
  const d = parseUTC(dateStr)
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

/* ── Upload Modal (multi-file, maks 10) ── */
const MAX_UPLOAD_FILES = 10

function UploadModal({ bucketId, maxFileSizeBytes, storageUsedBytes, storageLimitBytes, onClose, onSuccess, onRefresh }) {
  const [items, setItems] = useState([]) // { id, file, status: pending|uploading|done|error, progress, error }
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)

  const maxMb = maxFileSizeBytes ? (maxFileSizeBytes / (1024 * 1024)).toFixed(0) : null

  function addFiles(fileList) {
    const incoming = Array.from(fileList || [])
    if (incoming.length === 0) return
    setNotice('')
    const slotsLeft = MAX_UPLOAD_FILES - items.length
    let overflow = 0, tooBig = 0
    const accepted = []
    for (const f of incoming) {
      if (accepted.length >= slotsLeft) { overflow++; continue }
      if (maxFileSizeBytes && f.size > maxFileSizeBytes) { tooBig++; continue }
      accepted.push({
        id: (window.crypto?.randomUUID?.() || String(Math.random())),
        file: f, status: 'pending', progress: 0, error: '',
      })
    }
    const msgs = []
    if (overflow) msgs.push(`Maksimal ${MAX_UPLOAD_FILES} file per unggah — ${overflow} file diabaikan.`)
    if (tooBig) msgs.push(`${tooBig} file dilewati karena melebihi ${maxMb} MB.`)
    if (msgs.length) setNotice(msgs.join(' '))
    if (accepted.length) setItems((prev) => [...prev, ...accepted])
  }

  function removeItem(id) {
    if (loading) return
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  const pendingSize = items.filter((i) => i.status !== 'done').reduce((a, i) => a + i.file.size, 0)
  const quotaExceeded = !!storageLimitBytes && (storageUsedBytes + pendingSize) > storageLimitBytes
  const uploadable = items.filter((i) => i.status === 'pending' || i.status === 'error')
  const doneCount = items.filter((i) => i.status === 'done').length

  async function handleSubmit(e) {
    e.preventDefault()
    if (loading || uploadable.length === 0 || quotaExceeded) return
    setLoading(true)
    let anyFail = false, anyOk = false
    for (const it of uploadable) {
      setItems((prev) => prev.map((f) => f.id === it.id ? { ...f, status: 'uploading', progress: 0, error: '' } : f))
      try {
        await uploadFile(bucketId, it.file, (p) =>
          setItems((prev) => prev.map((f) => f.id === it.id ? { ...f, progress: p } : f)))
        anyOk = true
        setItems((prev) => prev.map((f) => f.id === it.id ? { ...f, status: 'done', progress: 100 } : f))
      } catch (err) {
        anyFail = true
        const d = err.response?.data?.detail
        const msg = Array.isArray(d) ? d[0]?.msg : (d || 'Gagal mengunggah')
        setItems((prev) => prev.map((f) => f.id === it.id ? { ...f, status: 'error', error: msg } : f))
      }
    }
    setLoading(false)
    if (!anyFail) onSuccess()              // semua sukses → tutup + reload
    else if (anyOk && onRefresh) onRefresh() // sebagian sukses → sinkronkan daftar, modal tetap terbuka
  }

  function statusText(it) {
    if (it.status === 'uploading') return `${it.progress}%`
    if (it.status === 'done') return 'Selesai ✓'
    if (it.status === 'error') return 'Gagal'
    return formatBytes(it.file.size)
  }

  return (
    <div className="modal-overlay" onClick={() => !loading && onClose()}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Unggah File</h2>
          <button className="modal-close" onClick={() => !loading && onClose()}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>

          {/* Drop Zone */}
          <label
            className={`up-drop ${dragging ? 'up-drop--active' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={(e) => { e.preventDefault(); setDragging(false) }}
            onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
          >
            <input type="file" multiple style={{ display: 'none' }}
              onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
            <div className="up-drop-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"
                  stroke="#062F28" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="up-drop-text">Klik atau seret beberapa file ke sini.</p>
            <p className="up-drop-sub">Maksimal {MAX_UPLOAD_FILES} file{maxMb ? ` · ${maxMb}MB per file` : ''}</p>
          </label>

          {/* Daftar file + progress per file */}
          {items.length > 0 && (
            <div className="up-file-list">
              {items.map((it) => (
                <div className="up-file-row" key={it.id}>
                  <div className="up-file-head">
                    <span className="up-file-name">
                      <span className="up-file-type">{getFileTypeBadge(it.file.type, it.file.name)}</span>
                      {it.file.name}
                    </span>
                    <span className={`up-file-pct ${it.status === 'error' ? 'up-file-pct--err' : ''}`}>{statusText(it)}</span>
                    {!loading && it.status !== 'done' && (
                      <button type="button" className="up-file-remove" onClick={() => removeItem(it.id)} title="Hapus dari daftar">✕</button>
                    )}
                  </div>
                  <div className="up-progress"><div className="up-progress-fill" style={{ width: `${it.progress}%` }} /></div>
                  {it.error && <div className="up-file-err">{it.error}</div>}
                </div>
              ))}
            </div>
          )}

          {notice && <div className="modal-error">{notice}</div>}
          {quotaExceeded && (
            <div className="modal-error">
              Kuota storage tidak cukup untuk semua file terpilih. Sisa ruang: {formatBytes(Math.max(0, storageLimitBytes - storageUsedBytes))}.
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="modal-btn-cancel" onClick={onClose} disabled={loading}>
              {doneCount > 0 ? 'Selesai' : 'Tutup'}
            </button>
            <button type="submit" className="modal-btn-submit" disabled={loading || uploadable.length === 0 || quotaExceeded}>
              {loading ? 'Mengunggah...' : `Unggah${uploadable.length ? ` ${uploadable.length} File` : ''}`}
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
  // Rute pakai nama bucket; dipakai sebagai identitas (unik per pengguna) di endpoint.
  const { name: id } = useParams()
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
  const { run: runPin, pinModal } = usePinPrompt({ title: 'Konfirmasi PIN', description: 'Masukkan PIN Transaksi untuk melanjutkan.' })

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

  function handleDelete() {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeletingId(target.id)
    runPin((pin) => deleteFile(id, target.id, pin))
      .then(() => { setObjects((prev) => prev.filter((o) => o.id !== target.id)); setDeleteTarget(null) })
      .catch((err) => { if (!err?.pinCancelled) alert(err.response?.data?.detail || 'Gagal menghapus file') })
      .finally(() => setDeletingId(null))
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

  function handleEmptyBucket() {
    setEmptying(true)
    runPin((pin) => emptyBucket(id, pin))
      .then(() => { setShowEmptyBucket(false); return loadData() })
      .catch((err) => { if (!err?.pinCancelled) alert(err.response?.data?.detail || 'Gagal mengosongkan bucket') })
      .finally(() => setEmptying(false))
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
            <button
              className="btn-outline"
              onClick={() => setShowUpload(true)}
              disabled={bucket.dormant}
              title={bucket.dormant ? 'Bucket dorman — tidak bisa upload' : 'Unggah file'}
            >
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
        {bucket.dormant && (
          <div className="bucket-dormant-banner">
            ⚠ Bucket ini <strong>dorman</strong> karena melebihi batas jumlah bucket paket Anda.
            Anda masih bisa melihat, mengunduh, dan menghapus file, tetapi <strong>tidak bisa upload</strong>.
            Upgrade paket atau hapus bucket lain untuk mengaktifkannya kembali.
          </div>
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
          onRefresh={() => loadData()}
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
      {pinModal}
    </div>
  )
}
