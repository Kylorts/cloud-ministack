import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { getBuckets, createBucket, deleteBucket } from '../services/storage'
import { getMySubscription } from '../services/subscriptions'
import './StoragePage.css'

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}
function BucketIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M21 8H3l1.5 11.5A2 2 0 0 0 6.5 21h11a2 2 0 0 0 2-1.5L21 8z" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M21 8a9 9 0 1 0-18 0" stroke="#6b7280" strokeWidth="1.5" />
    </svg>
  )
}
function SearchSmIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M21 21L16.514 16.506M19 10.5C19 15.194 15.194 19 10.5 19C5.806 19 2 15.194 2 10.5C2 5.806 5.806 2 10.5 2C15.194 2 19 5.806 19 10.5Z" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" />
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
  return `${parseFloat(kb.toFixed(0))} KB`
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

/* ── Modal Buat Bucket ── */
function CreateBucketModal({ onClose, onSuccess }) {
  const [name, setName] = useState('')
  const [visibility, setVisibility] = useState('private')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await createBucket({ display_name: name, visibility })
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.detail || 'Gagal membuat bucket')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Buat Bucket Baru</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-field">
            <label className="modal-label">Nama Bucket</label>
            <input
              className="modal-input"
              type="text"
              placeholder="huruf kecil, angka, dan strip"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <span className="modal-hint">Gunakan nama yang unik secara global. Contoh: bucket-aset-proyek-01</span>
          </div>

          <div className="modal-field">
            <label className="modal-label">Visibilitas</label>
            <select
              className="modal-select"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
            >
              <option value="private">Pribadi (Default)</option>
              <option value="public">Publik</option>
            </select>
            <span className="modal-hint">Pengaturan visibilitas dapat diubah kapan saja melalui panel kontrol.</span>
          </div>

          {error && <div className="modal-error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="modal-btn-cancel" onClick={onClose}>Batal</button>
            <button type="submit" className="modal-btn-submit" disabled={loading}>
              {loading ? 'Membuat...' : 'Buat Bucket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Main Page ── */
export default function StoragePage() {
  const [buckets, setBuckets] = useState([])
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const navigate = useNavigate()

  function loadData() {
    return Promise.all([
      getBuckets().catch((err) => {
        if (err.response?.status === 403) navigate('/paket', { replace: true })
        return { data: [] }
      }),
      getMySubscription().catch(() => ({ data: null })),
    ]).then(([bucketsRes, subRes]) => {
      setBuckets(bucketsRes.data)
      setSubscription(subRes.data)
    })
  }

  useEffect(() => {
    loadData().finally(() => setLoading(false))
  }, [])

  const filtered = buckets.filter((b) =>
    b.display_name.toLowerCase().includes(search.toLowerCase())
  )

  const storageUsed = 0
  const storageLimit = subscription?.plan?.storage_limit_bytes ?? 0
  const storagePercent = storageLimit ? Math.round((storageUsed / storageLimit) * 100) : 0
  const storageLeft = storageLimit - storageUsed

  if (loading) return <div className="storage-loading">Memuat data storage...</div>

  return (
    <div className="storage-page">
      <Navbar breadcrumbs={[
        { label: 'Sumber Daya Virtual', path: '/dashboard' },
        { label: 'Object Storage' },
      ]} />

      <main className="storage-main">
        <div className="storage-page-header">
          <div>
            <h1 className="storage-title">Object Storage</h1>
            <p className="storage-subtitle">Kelola infrastruktur penyimpanan data cloud Anda dengan efisien.</p>
          </div>
          <button className="btn-create-bucket" onClick={() => setShowModal(true)}>
            <PlusIcon /> Buat Bucket
          </button>
        </div>

        {/* Stat Cards */}
        <div className="storage-stats">
          <div className="storage-stat-card">
            <span className="storage-stat-label">PENGGUNAAN PENYIMPANAN</span>
            <div className="storage-stat-value">{formatBytes(storageUsed)} <span className="storage-stat-total">/ {formatBytes(storageLimit)}</span></div>
            <div className="storage-bar"><div className="storage-bar-fill" style={{ width: `${storagePercent}%` }} /></div>
            <div className="storage-stat-meta">
              <span>{storagePercent}% Terpakai</span>
              <span className="storage-stat-right">{formatBytes(storageLeft)} SISA</span>
            </div>
          </div>

          <div className="storage-stat-card storage-stat-card--center">
            <span className="storage-stat-label">BUCKET AKTIF</span>
            <div className="storage-stat-big">{buckets.length}</div>
            <div className="storage-stat-sub">Unit penyimpanan tersedia yang aktif.</div>
          </div>

          <div className="storage-stat-card">
            <span className="storage-stat-label">PENGGUNAAN BANDWIDTH</span>
            <div className="storage-stat-value">0 B <span className="storage-stat-total">/ {formatBytes(subscription?.plan?.bandwidth_limit_bytes ?? 0)}</span></div>
            <div className="storage-bar"><div className="storage-bar-fill storage-bar-fill--bw" style={{ width: '0%' }} /></div>
            <div className="storage-stat-meta">
              <span>0% Kuota</span>
              <span className="storage-stat-right">{formatBytes(subscription?.plan?.bandwidth_limit_bytes ?? 0)} SISA</span>
            </div>
          </div>
        </div>

        {/* Bucket List */}
        <div className="storage-section">
          <div className="storage-section-header">
            <h2 className="storage-section-title">Buckets</h2>
            <div className="storage-search">
              <SearchSmIcon />
              <input
                type="text"
                className="storage-search-input"
                placeholder="Cari bucket..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <table className="storage-table">
            <thead>
              <tr>
                <th>NAMA BUCKET</th>
                <th>VISIBILITAS</th>
                <th>JUMLAH OBJEK</th>
                <th>TOTAL UKURAN</th>
                <th>STATUS</th>
                <th>DIBUAT PADA</th>
                <th>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="storage-table-empty">
                    {search ? 'Tidak ada bucket yang cocok.' : 'Belum ada bucket. Buat bucket pertama Anda.'}
                  </td>
                </tr>
              ) : (
                filtered.map((bucket) => (
                  <tr key={bucket.id}>
                    <td>
                      <div className="bucket-name-cell">
                        <BucketIcon />
                        <span className="bucket-name">{bucket.display_name}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`visibility-badge visibility-badge--${bucket.visibility}`}>
                        {bucket.visibility === 'private' ? 'Pribadi' : 'Publik'}
                      </span>
                    </td>
                    <td className="storage-table-meta">-</td>
                    <td className="storage-table-meta">-</td>
                    <td>
                      <span className={`status-badge status-badge--${bucket.status}`}>
                        {bucket.status === 'active' ? '● Aktif' : bucket.status}
                      </span>
                    </td>
                    <td className="storage-table-meta">{formatDate(bucket.created_at)}</td>
                    <td>
                      <button
                        className="bucket-open-btn"
                        onClick={() => navigate(`/storage/buckets/${bucket.id}`)}
                      >
                        Buka
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {filtered.length > 0 && (
            <div className="storage-table-footer">
              Menampilkan {filtered.length} dari {buckets.length} buckets
            </div>
          )}
        </div>
      </main>

      <footer className="storage-footer">
        <span>© 2026 INI AWAN</span>
        <div className="storage-footer-links">
          <a href="#">Dokumentasi</a>
          <a href="#">Privasi</a>
          <a href="#">Syarat &amp; Ketentuan</a>
        </div>
      </footer>

      {showModal && (
        <CreateBucketModal
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); loadData() }}
        />
      )}
    </div>
  )
}
