import { useEffect, useState } from 'react'
import { parseUTC } from '../utils/datetime'
import Navbar from '../components/Navbar'
import PinPromptModal from '../components/PinPromptModal'
import { getAccessKeys, createAccessKey, revokeAccessKey, getKeyPolicies } from '../services/accessKeys'
import { getPinErrorCode } from '../services/security'
import './AccessKeysPage.css'

function PlusIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
}
function CopyIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.8"/></svg>
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-'
  const d = parseUTC(dateStr)
  const t = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  return `${t} · ${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

/* ── Modal Buat Kunci ── */
function CreateKeyModal({ category, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [policyId, setPolicyId] = useState('')
  const [policies, setPolicies] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getKeyPolicies(category).then((r) => {
      const list = r.data || []
      setPolicies(list)
      // Default: policy "Full" bila ada, jika tidak opsi pertama.
      const def = list.find((p) => /full/i.test(p.name)) || list[0]
      if (def) setPolicyId(String(def.id))
    }).catch(() => setPolicies([]))
  }, [category])

  const selected = policies.find((p) => String(p.id) === policyId)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res = await createAccessKey(category, {
        name: name || null,
        policy_id: policyId ? Number(policyId) : null,
      })
      onCreated(res.data)
    } catch (err) {
      const d = err.response?.data?.detail
      setError(Array.isArray(d) ? d[0]?.msg : (d || 'Gagal membuat kunci'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Buat Access Key Baru</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-field">
            <label className="modal-label">Nama / Deskripsi (Opsional)</label>
            <input className="modal-input" type="text" placeholder="kunci-server-prod"
              value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="modal-field">
            <label className="modal-label">Izin Akses (IAM Policy)</label>
            {policies.length === 0 ? (
              <span className="modal-hint">Belum ada IAM policy tersedia untuk kategori ini.</span>
            ) : (
              <select className="modal-select" value={policyId} onChange={(e) => setPolicyId(e.target.value)}>
                {policies.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}{p.policy_type === 'system' ? ' (system)' : ''}</option>
                ))}
              </select>
            )}
            <span className="modal-hint">
              {selected?.description || 'Policy menentukan operasi yang diizinkan kunci ini. Atur policy di panel Admin → IAM.'}
            </span>
          </div>
          {error && <div className="modal-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="modal-btn-cancel" onClick={onClose}>Batal</button>
            <button type="submit" className="modal-btn-submit" disabled={loading}>
              {loading ? 'Membuat...' : 'Generate Key'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Panel Detail & Secret (setelah generate) ── */
function SecretPanel({ created, onDone }) {
  const [copied, setCopied] = useState('')

  function copy(text, which) {
    navigator.clipboard?.writeText(text)
    setCopied(which)
    setTimeout(() => setCopied(''), 1500)
  }

  const masked = created.secret_key.slice(0, 6) + '••••••••••••' + created.secret_key.slice(-3)

  return (
    <div className="secret-panel">
      <h1 className="secret-title">Access Key Detail &amp; Secret</h1>
      <p className="secret-subtitle">Kunci akses baru Anda telah berhasil dibuat dan siap digunakan.</p>

      <div className="secret-warn">
        ⚠ <strong>Simpan Secret Key Anda sekarang!</strong> Kunci ini tidak akan ditampilkan lagi setelah Anda menutup halaman ini.
      </div>

      <div className="secret-card">
        <div className="secret-row">
          <div>
            <span className="secret-label">Access Key ID</span>
            <span className="secret-value mono">{created.access_key_id}</span>
          </div>
          <button className="secret-copy-btn" onClick={() => copy(created.access_key_id, 'id')}>
            <CopyIcon /> {copied === 'id' ? 'Tersalin' : 'Salin'}
          </button>
        </div>
        <div className="secret-divider" />
        <div className="secret-row">
          <div>
            <span className="secret-label">Secret Access Key</span>
            <span className="secret-value mono">{masked}</span>
          </div>
          <button className="secret-copy-btn" onClick={() => copy(created.secret_key, 'secret')}>
            <CopyIcon /> {copied === 'secret' ? 'Tersalin' : 'Salin Secret'}
          </button>
        </div>
      </div>

      <div className="secret-config-label">Contoh Penggunaan (curl)</div>
      <div className="secret-config-box">
        <code className="secret-config-code">{created.usage_example}</code>
        <button className="secret-config-copy" onClick={() => copy(created.usage_example, 'mc')}>
          <CopyIcon /> {copied === 'mc' ? 'Tersalin' : 'Salin'}
        </button>
      </div>

      <button className="secret-done-btn" onClick={onDone}>✓ Saya Sudah Menyimpan Kunci Ini</button>
      <p className="secret-done-note">Mengklik tombol ini akan membawa Anda kembali ke daftar Access Keys.</p>
    </div>
  )
}

export default function AccessKeysPage() {
  const [category, setCategory] = useState('storage')
  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [created, setCreated] = useState(null)
  const [revokeTarget, setRevokeTarget] = useState(null)
  const [busy, setBusy] = useState(false)
  const [pinOpen, setPinOpen] = useState(false)
  const [pinErr, setPinErr] = useState('')

  function loadKeys() {
    setLoading(true)
    return getAccessKeys(category)
      .then((r) => setKeys(r.data))
      .catch(() => setKeys([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadKeys() }, [category])

  async function doRevoke(pin) {
    setBusy(true)
    try {
      await revokeAccessKey(revokeTarget.id, pin)
      setRevokeTarget(null)
      setPinOpen(false); setPinErr('')
      await loadKeys()
    } catch (err) {
      const code = getPinErrorCode(err)
      if (code === 'PIN_REQUIRED') { setPinOpen(true); setPinErr('') }
      else if (code === 'PIN_INVALID') { setPinErr('PIN Transaksi salah.') }
      else {
        const d = err.response?.data?.detail
        alert(typeof d === 'string' ? d : 'Gagal mencabut kunci')
      }
    } finally {
      setBusy(false)
    }
  }

  const activeCount = keys.filter((k) => k.status === 'active').length

  return (
    <div className="ak-page">
      <Navbar breadcrumbs={[
        { label: 'Kredensial API', path: '/dashboard' },
        { label: 'Access Keys' },
      ]} />

      <main className="ak-main">
        {created ? (
          <SecretPanel created={created} onDone={() => { setCreated(null); loadKeys() }} />
        ) : (
          <>
            <div className="ak-header">
              <div>
                <h1 className="ak-title">Access Keys</h1>
                <p className="ak-subtitle">Kelola kredensial akses API untuk akun MiniStack Anda.</p>
              </div>
              <button className="ak-create-btn" onClick={() => setShowModal(true)}>
                <PlusIcon /> Buat Kunci Baru
              </button>
            </div>

            {/* Tabs */}
            <div className="ak-tabs">
              <button className={`ak-tab ${category === 'storage' ? 'ak-tab--active' : ''}`} onClick={() => setCategory('storage')}>Storage</button>
              <button className={`ak-tab ${category === 'hosting' ? 'ak-tab--active' : ''}`} onClick={() => setCategory('hosting')}>Hosting</button>
            </div>

            <div className="ak-info-banner">
              ℹ Kunci Rahasia hanya akan ditampilkan satu kali saat pembuatan. Harap simpan dengan aman.
            </div>

            <table className="ak-table">
              <colgroup><col /><col /><col /><col /><col /><col /></colgroup>
              <thead>
                <tr>
                  <th>ID KUNCI AKSES</th><th>STATUS</th><th>IZIN / POLICY</th><th>DIBUAT PADA</th><th>TERAKHIR DIGUNAKAN</th><th>AKSI</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="ak-empty">Memuat...</td></tr>
                ) : keys.length === 0 ? (
                  <tr><td colSpan={6} className="ak-empty">Belum ada access key. Buat kunci pertama Anda.</td></tr>
                ) : keys.map((k) => (
                  <tr key={k.id} className={k.status === 'revoked' ? 'ak-row-revoked' : ''}>
                    <td className="mono ak-keyid">{k.access_key_id}{k.name ? <span className="ak-keyname"> · {k.name}</span> : ''}</td>
                    <td>
                      {k.status === 'active'
                        ? <span className="ak-badge ak-badge--active">● Aktif</span>
                        : <span className="ak-badge ak-badge--revoked">Dicabut</span>}
                    </td>
                    <td className="ak-meta">
                      {k.policy_name
                        ? <span className="ak-badge ak-badge--policy">🛡 {k.policy_name}</span>
                        : (k.permission === 'read_only' ? 'Read-Only' : 'Full Access')}
                    </td>
                    <td className="ak-meta">{formatDateTime(k.created_at)}</td>
                    <td className="ak-meta">{k.last_used_at ? formatDateTime(k.last_used_at) : '-'}</td>
                    <td>
                      {k.status === 'active'
                        ? <button className="ak-revoke" onClick={() => setRevokeTarget(k)}>Cabut</button>
                        : <span className="ak-revoke-disabled">Cabut</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && keys.length > 0 && (
              <div className="ak-footer-info">{activeCount} kunci aktif · {keys.length} total kredensial</div>
            )}
          </>
        )}
      </main>

      <footer className="ak-footer">
        <span>© 2026 JADESTACK</span>
        <div className="ak-footer-links"><a href="#">Dokumentasi</a><a href="#">Privasi</a><a href="#">Syarat &amp; Ketentuan</a></div>
      </footer>

      {showModal && (
        <CreateKeyModal category={category} onClose={() => setShowModal(false)}
          onCreated={(data) => { setShowModal(false); setCreated(data) }} />
      )}

      {revokeTarget && (
        <div className="modal-overlay" onClick={() => !busy && setRevokeTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Cabut Access Key</h2>
              <button className="modal-close" onClick={() => setRevokeTarget(null)}>✕</button>
            </div>
            <div className="ak-confirm-body">
              <div className="ak-confirm-icon">🔑</div>
              <p className="ak-confirm-text">Cabut kunci ini secara permanen?</p>
              <p className="ak-confirm-sub mono">{revokeTarget.access_key_id}</p>
              <p className="ak-confirm-note">Aplikasi yang memakai kunci ini tidak akan bisa akses lagi.</p>
            </div>
            <div className="modal-actions">
              <button className="modal-btn-cancel" onClick={() => setRevokeTarget(null)} disabled={busy}>Batal</button>
              <button className="modal-btn-delete" onClick={() => doRevoke()} disabled={busy}>
                {busy ? 'Mencabut...' : 'Ya, Cabut'}
              </button>
            </div>
          </div>
        </div>
      )}

      <PinPromptModal
        open={pinOpen}
        title="Cabut Access Key"
        description="Masukkan PIN Transaksi untuk mencabut access key ini."
        error={pinErr}
        busy={busy}
        onSubmit={(pin) => doRevoke(pin)}
        onClose={() => { setPinOpen(false); setPinErr('') }}
      />
    </div>
  )
}
