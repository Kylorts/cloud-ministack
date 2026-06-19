import { useEffect, useState } from 'react'
import AdminNav from '../components/AdminNav'
import { getAdminPlans, createAdminPlan, updateAdminPlan, deleteAdminPlan } from '../services/admin'
import './AdminDashboardPage.css'
import './AdminPages.css'

const GB = 1024 ** 3
const MB = 1024 ** 2

function emptyForm() {
  return { name: '', category: 'storage', price: 0, storage_gb: 1, max_file_mb: 50, bandwidth_mb: 100, bucket_limit: 1, static_site_limit: 0, access_key_limit: 1, is_active: true }
}
function planToForm(p) {
  return {
    name: p.name, category: p.category, price: p.price,
    storage_gb: +(p.storage_limit_bytes / GB).toFixed(2),
    max_file_mb: Math.round(p.max_file_size_bytes / MB),
    bandwidth_mb: Math.round(p.bandwidth_limit_bytes / MB),
    bucket_limit: p.bucket_limit, static_site_limit: p.static_site_limit,
    access_key_limit: p.access_key_limit, is_active: p.is_active,
  }
}
function formToPayload(f) {
  return {
    name: f.name, category: f.category, price: Number(f.price),
    storage_limit_bytes: Math.round(Number(f.storage_gb) * GB),
    max_file_size_bytes: Math.round(Number(f.max_file_mb) * MB),
    bandwidth_limit_bytes: Math.round(Number(f.bandwidth_mb) * MB),
    bucket_limit: Number(f.bucket_limit), static_site_limit: Number(f.static_site_limit),
    access_key_limit: Number(f.access_key_limit), is_active: !!f.is_active,
  }
}
function fmtBytes(b) {
  const gb = b / GB; if (gb >= 1) return `${parseFloat(gb.toFixed(1))} GB`
  return `${Math.round(b / MB)} MB`
}
function rp(n) { return 'Rp ' + new Intl.NumberFormat('id-ID').format(n) }

function PlanModal({ initial, onClose, onSaved }) {
  const [f, setF] = useState(initial.form)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))

  async function save(e) {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      const payload = formToPayload(f)
      if (initial.id) await updateAdminPlan(initial.id, payload)
      else await createAdminPlan(payload)
      onSaved()
    } catch (e2) {
      const d = e2.response?.data?.detail
      setErr(Array.isArray(d) ? d[0]?.msg : (d || 'Gagal menyimpan paket'))
    } finally { setBusy(false) }
  }

  return (
    <div className="adm-modal-overlay" onClick={onClose}>
      <form className="adm-modal" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h2 className="adm-modal-title">{initial.id ? 'Edit Paket' : 'Buat Paket Baru'}</h2>
        <div className="adm-form-grid">
          <div className="adm-field adm-field--full"><label>Nama Paket</label>
            <input value={f.name} onChange={(e) => set('name', e.target.value)} required placeholder="mis. Storage Pro" /></div>
          <div className="adm-field"><label>Kategori</label>
            <select value={f.category} onChange={(e) => set('category', e.target.value)}>
              <option value="storage">Storage</option><option value="hosting">Hosting</option>
            </select></div>
          <div className="adm-field"><label>Harga / bulan (Rp)</label>
            <input type="number" min="0" value={f.price} onChange={(e) => set('price', e.target.value)} /></div>
          <div className="adm-field"><label>Limit Storage (GB)</label>
            <input type="number" min="0" step="0.1" value={f.storage_gb} onChange={(e) => set('storage_gb', e.target.value)} /></div>
          <div className="adm-field"><label>Maks File (MB)</label>
            <input type="number" min="0" value={f.max_file_mb} onChange={(e) => set('max_file_mb', e.target.value)} /></div>
          <div className="adm-field"><label>Bandwidth (MB/bln)</label>
            <input type="number" min="0" value={f.bandwidth_mb} onChange={(e) => set('bandwidth_mb', e.target.value)} /></div>
          <div className="adm-field"><label>Limit Bucket</label>
            <input type="number" min="0" value={f.bucket_limit} onChange={(e) => set('bucket_limit', e.target.value)} /></div>
          <div className="adm-field"><label>Limit Situs</label>
            <input type="number" min="0" value={f.static_site_limit} onChange={(e) => set('static_site_limit', e.target.value)} /></div>
          <div className="adm-field"><label>Limit Access Key</label>
            <input type="number" min="0" value={f.access_key_limit} onChange={(e) => set('access_key_limit', e.target.value)} /></div>
          <div className="adm-field adm-field--full">
            <label className="adm-check"><input type="checkbox" checked={f.is_active} onChange={(e) => set('is_active', e.target.checked)} /> Tampilkan ke klien (aktif)</label>
          </div>
        </div>
        {err && <div style={{ color: '#dc2626', fontSize: 13, marginTop: 12 }}>{err}</div>}
        <div className="adm-modal-actions">
          <button type="button" className="adm-btn-ghost" onClick={onClose} disabled={busy}>Batal</button>
          <button type="submit" className="adm-btn-primary" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan Paket'}</button>
        </div>
      </form>
    </div>
  )
}

export default function AdminPlansPage() {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // {id, form}

  function load() { return getAdminPlans().then((r) => setPlans(r.data)).catch(() => setPlans([])) }
  useEffect(() => { load().finally(() => setLoading(false)) }, [])

  async function remove(p) {
    if (!window.confirm(`Hapus paket "${p.name}"?`)) return
    try { await deleteAdminPlan(p.id); await load() }
    catch (e) { alert(e.response?.data?.detail || 'Gagal menghapus') }
  }

  return (
    <div className="adm-page">
      <AdminNav breadcrumbs={[{ label: 'Layanan & Tagihan' }, { label: 'Paket Layanan' }]} />
      <main className="adm-main">
        <div className="adm-toolbar">
          <div className="adm-header">
            <h1 className="adm-page-title">Manajemen Paket Layanan</h1>
            <p className="adm-page-sub">Kelola harga & kapasitas untuk setiap paket langganan.</p>
          </div>
          <button className="adm-btn-primary" onClick={() => setModal({ id: null, form: emptyForm() })}>+ Buat Paket Baru</button>
        </div>

        {loading ? <div className="adm-loading">Memuat...</div> : (
          <div className="adm-plan-grid">
            {plans.map((p) => (
              <div key={p.id} className={`adm-plan-card ${p.is_active ? '' : 'adm-plan-card--off'}`}>
                <span className="adm-plan-cat">{p.category}{p.is_active ? '' : ' · tersembunyi'}</span>
                <span className="adm-plan-name">{p.name}</span>
                <span className="adm-plan-price">{rp(p.price)} <small>/bln</small></span>
                <ul className="adm-plan-specs">
                  <li>{fmtBytes(p.storage_limit_bytes)} Storage</li>
                  <li>{p.bucket_limit} Bucket · {p.static_site_limit} Situs</li>
                  <li>Maks {Math.round(p.max_file_size_bytes / MB)} MB/file · {p.access_key_limit} key</li>
                  <li style={{ color: '#9ca3af' }}>{p.subscriber_count} pelanggan aktif</li>
                </ul>
                <div className="adm-plan-actions">
                  <button className="adm-btn-ghost" onClick={() => setModal({ id: p.id, form: planToForm(p) })}>Edit</button>
                  <button className="adm-btn-danger" onClick={() => remove(p)}>Hapus</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {modal && <PlanModal initial={modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} />}
    </div>
  )
}
