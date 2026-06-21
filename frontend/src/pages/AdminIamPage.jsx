import { useEffect, useState } from 'react'
import AdminNav from '../components/AdminNav'
import { getIamPolicies, createIamPolicy, updateIamPolicy, deleteIamPolicy } from '../services/admin'
import './AdminDashboardPage.css'
import './AdminPages.css'

const SAMPLE = '{\n  "Version": "2026-06-01",\n  "Statement": [\n    { "Effect": "Allow", "Action": "s3:Get*", "Resource": "*" }\n  ]\n}'

function PolicyModal({ initial, onClose, onSaved }) {
  const [name, setName] = useState(initial?.name || '')
  const [desc, setDesc] = useState(initial?.description || '')
  const [doc, setDoc] = useState(initial?.document || SAMPLE)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function save(e) {
    e.preventDefault(); setErr('')
    try { JSON.parse(doc) } catch { setErr('Dokumen JSON tidak valid.'); return }
    setBusy(true)
    try {
      const payload = { name, description: desc || null, document: doc }
      if (initial?.id) await updateIamPolicy(initial.id, payload)
      else await createIamPolicy(payload)
      onSaved()
    } catch (e2) {
      const d = e2.response?.data?.detail
      setErr(Array.isArray(d) ? d[0]?.msg : (d || 'Gagal menyimpan policy'))
    } finally { setBusy(false) }
  }

  return (
    <div className="adm-modal-overlay" onClick={onClose}>
      <form className="adm-modal" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h2 className="adm-modal-title">{initial?.id ? 'Edit Policy' : 'Buat Policy Baru'}</h2>
        <div className="adm-field adm-field--full" style={{ marginBottom: 14 }}>
          <label>Nama Policy *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Contoh: S3ReadAccess" />
        </div>
        <div className="adm-field adm-field--full" style={{ marginBottom: 14 }}>
          <label>Deskripsi (opsional)</label>
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Jelaskan tujuan policy ini..." />
        </div>
        <div className="adm-field adm-field--full">
          <label>Dokumen Policy (JSON)</label>
          <textarea className="adm-json-editor" value={doc} onChange={(e) => setDoc(e.target.value)} rows={10} spellCheck={false} />
          <span style={{ fontSize: 12, color: '#9ca3af' }}>Pastikan JSON valid sebelum menyimpan.</span>
        </div>
        {err && <div style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{err}</div>}
        <div className="adm-modal-actions">
          <button type="button" className="adm-btn-ghost" onClick={onClose} disabled={busy}>Batal</button>
          <button type="submit" className="adm-btn-primary" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan Policy'}</button>
        </div>
      </form>
    </div>
  )
}

function JsonViewModal({ policy, onClose }) {
  return (
    <div className="adm-modal-overlay" onClick={onClose}>
      <div className="adm-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="adm-modal-title">{policy.name}</h2>
        <pre className="adm-webhook">{policy.document}</pre>
        <div className="adm-modal-actions"><button className="adm-btn-ghost" onClick={onClose}>Tutup</button></div>
      </div>
    </div>
  )
}

export default function AdminIamPage() {
  const [pols, setPols] = useState([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState(null)   // {} new | policy edit
  const [view, setView] = useState(null)

  function load() { return getIamPolicies().then((r) => setPols(r.data)).catch(() => setPols([])) }
  useEffect(() => { load().finally(() => setLoading(false)) }, [])

  async function remove(p) {
    if (!window.confirm(`Hapus policy "${p.name}"?`)) return
    try { await deleteIamPolicy(p.id); await load() }
    catch (e) { alert(e.response?.data?.detail || 'Gagal menghapus') }
  }

  return (
    <div className="adm-page">
      <AdminNav breadcrumbs={[{ label: 'Keamanan & Log Sistem' }, { label: 'Policy IAM' }]} />
      <main className="adm-main">
        <div className="adm-toolbar">
          <div className="adm-header">
            <h1 className="adm-page-title">Manajemen Policy Akses (IAM)</h1>
            <p className="adm-page-sub">Definisikan kebijakan akses (dokumen JSON).</p>
          </div>
          <button className="adm-btn-primary" onClick={() => setEdit({})}>+ Buat Policy Baru</button>
        </div>

        <div className="adm-sim-banner">🔒 Policy <b>di-enforce</b> untuk akses lewat <b>access key</b> — storage via <code>/s3</code> &amp; hosting via <code>/hosting-api</code> (Allow/Deny, explicit Deny menang). Catatan: akses via web UI (pemilik akun) tidak diatur policy.</div>

        <div className="adm-table-card">
          <table className="adm-table">
            <thead><tr><th>Nama Policy</th><th>Deskripsi</th><th>Tipe</th><th>Dibuat Oleh</th><th>Aksi</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="adm-loading-cell">Memuat...</td></tr>
              ) : pols.length === 0 ? (
                <tr><td colSpan={5} className="adm-empty-cell">Belum ada policy.</td></tr>
              ) : pols.map((p) => (
                <tr key={p.id}>
                  <td className="adm-instance-name">{p.name}</td>
                  <td className="adm-owner-cell">{p.description || '-'}</td>
                  <td><span className={`adm-badge ${p.policy_type === 'system' ? 'adm-badge--minio' : 'adm-badge--ec2'}`}>{p.policy_type === 'system' ? 'System' : 'Custom'}</span></td>
                  <td className="adm-owner-cell">{p.policy_type === 'system' ? 'Sistem (bawaan)' : (p.created_by || 'Admin')}</td>
                  <td>
                    <div className="adm-row-actions">
                      <button className="adm-link-btn" onClick={() => setView(p)}>Lihat JSON</button>
                      {p.policy_type === 'system' ? (
                        <span className="adm-row-actions-note" title="Policy sistem tidak bisa diubah/dihapus">Terkunci</span>
                      ) : (
                        <>
                          <button className="adm-link-btn" onClick={() => setEdit(p)}>Edit</button>
                          <button className="adm-link-btn adm-link-btn--danger" onClick={() => remove(p)}>Hapus</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && <div className="adm-pagi"><span>Menampilkan {pols.length} policy</span></div>}
        </div>
      </main>

      {edit && <PolicyModal initial={edit.id ? edit : null} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
      {view && <JsonViewModal policy={view} onClose={() => setView(null)} />}
    </div>
  )
}
