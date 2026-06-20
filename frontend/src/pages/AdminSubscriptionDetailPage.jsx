import { useEffect, useState } from 'react'
import { parseUTC } from '../utils/datetime'
import { useParams, useNavigate } from 'react-router-dom'
import AdminNav from '../components/AdminNav'
import { getAdminSubscription, getAdminPlans, adminChangePlan, adminFastForward, adminSuspendSub, adminUnsuspendSub, adminExpireGrace } from '../services/admin'
import './AdminDashboardPage.css'
import './AdminPages.css'

function fmtBytes(b) {
  if (!b) return '0 B'
  const gb = b / 1024 ** 3; if (gb >= 1) return `${parseFloat(gb.toFixed(1))} GB`
  return `${Math.round(b / 1024 ** 2)} MB`
}
function fmtDate(s) {
  if (!s) return '-'
  return parseUTC(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtDateTime(s) {
  if (!s) return '-'
  const d = parseUTC(s)
  return `${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
}
const ACTION_LABEL = {
  PACKAGE_SUBSCRIBED: 'Berlangganan', PACKAGE_UPGRADED: 'Upgrade',
  SUBSCRIPTION_CANCELLED: 'Batal', ADMIN_PLAN_CHANGE: 'Ubah oleh Admin',
}

export default function AdminSubscriptionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [s, setS] = useState(null)
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForce, setShowForce] = useState(false)
  const [targetPlan, setTargetPlan] = useState('')
  const [busy, setBusy] = useState(false)

  function load() {
    return getAdminSubscription(id).then((r) => setS(r.data)).catch((e) => {
      if (e.response?.status === 404) navigate('/admin/langganan', { replace: true })
    })
  }
  useEffect(() => {
    Promise.all([load(), getAdminPlans().then((r) => setPlans(r.data)).catch(() => {})]).finally(() => setLoading(false))
  }, [id])

  async function fastForward() {
    setBusy(true)
    try { const r = await adminFastForward(id); alert(r.data?.message || 'OK'); await load() }
    catch (e) { alert(e.response?.data?.detail || 'Gagal') }
    finally { setBusy(false) }
  }

  async function runAction(fn, confirmMsg) {
    if (confirmMsg && !window.confirm(confirmMsg)) return
    setBusy(true)
    try { const r = await fn(id); alert(r.data?.message || 'OK'); await load() }
    catch (e) { alert(e.response?.data?.detail || 'Gagal') }
    finally { setBusy(false) }
  }

  async function doForce() {
    if (!targetPlan) return
    setBusy(true)
    try { await adminChangePlan(id, Number(targetPlan)); setShowForce(false); setTargetPlan(''); await load() }
    catch (e) { alert(e.response?.data?.detail || 'Gagal mengubah paket') }
    finally { setBusy(false) }
  }

  if (loading) return <div className="adm-page"><AdminNav /><div className="adm-loading">Memuat...</div></div>
  if (!s) return null

  const storagePct = s.storage_limit_bytes ? Math.round(s.storage_used_bytes / s.storage_limit_bytes * 100) : 0
  const bwPct = s.bandwidth_limit_bytes ? Math.round(s.bandwidth_used_bytes / s.bandwidth_limit_bytes * 100) : 0
  const samePlans = plans.filter((p) => p.category === s.category)

  return (
    <div className="adm-page">
      <AdminNav breadcrumbs={[{ label: 'Langganan', path: '/admin/langganan' }, { label: 'Detail' }]} />
      <main className="adm-main">
        <div className="adm-detail-head">
          <div className="adm-detail-id">
            <div className="adm-avatar-lg">{s.client_name.charAt(0).toUpperCase()}</div>
            <div>
              <h1 className="adm-detail-name">{s.client_name}</h1>
              <p className="adm-detail-meta">{s.plan_name} · {s.category} · {s.client_email}</p>
            </div>
          </div>
          <div className="adm-detail-actions">
            <button className="adm-btn-ghost" onClick={fastForward} disabled={busy} title="DEMO: majukan periode untuk menerapkan downgrade terjadwal">⏩ Majukan Periode</button>
            {s.status === 'over_quota' && (
              <button className="adm-btn-ghost" onClick={() => runAction(adminExpireGrace)} disabled={busy} title="DEMO: habiskan grace period sekarang lalu jalankan auto-suspend">⏳ Habiskan Grace</button>
            )}
            {s.status === 'suspended' ? (
              <button className="adm-btn-ghost" onClick={() => runAction(adminUnsuspendSub)} disabled={busy}>▶ Unsuspend</button>
            ) : (
              <button className="adm-btn-ghost adm-btn-suspend" onClick={() => runAction(adminSuspendSub, `Suspend langganan ${s.client_name}?`)} disabled={busy}>⏸ Suspend</button>
            )}
            <button className="adm-btn-ghost adm-btn-suspend" onClick={() => setShowForce(true)}>⚠ Force Change Plan</button>
          </div>
        </div>

        <div className="adm-two-col">
          <div className="adm-table-card">
            <div className="adm-table-header"><h2 className="adm-table-title">Informasi Siklus</h2></div>
            <div className="adm-info-row"><span>Status</span><span>{s.status}</span></div>
            <div className="adm-info-row"><span>Periode</span><span>{fmtDate(s.current_period_start)} – {fmtDate(s.current_period_end)}</span></div>
            {s.status === 'over_quota' && s.grace_until && (
              <div className="adm-info-row"><span>Grace berakhir</span><span>{fmtDateTime(s.grace_until)}</span></div>
            )}
            {s.status === 'suspended' && s.suspended_at && (
              <div className="adm-info-row"><span>Disuspend sejak</span><span>{fmtDateTime(s.suspended_at)}</span></div>
            )}
            <div className="adm-info-row"><span>Biaya Paket</span><span>Rp {new Intl.NumberFormat('id-ID').format(s.price)} / bln</span></div>
          </div>
          <div className="adm-table-card">
            <div className="adm-table-header"><h2 className="adm-table-title">Snapshot Penggunaan</h2></div>
            <div className="adm-bar-row-label"><span>Object Storage</span><span>{fmtBytes(s.storage_used_bytes)} / {fmtBytes(s.storage_limit_bytes)}</span></div>
            <div className="adm-bar"><div className="adm-bar-fill" style={{ width: `${Math.min(storagePct, 100)}%`, background: 'var(--color-accent)' }} /></div>
            <div className="adm-bar-row-label" style={{ marginTop: 14 }}><span>Bandwidth</span><span>{fmtBytes(s.bandwidth_used_bytes)} / {fmtBytes(s.bandwidth_limit_bytes)}</span></div>
            <div className="adm-bar"><div className="adm-bar-fill" style={{ width: `${Math.min(bwPct, 100)}%`, background: '#0066CC' }} /></div>
          </div>
        </div>

        <div className="adm-table-card">
          <div className="adm-table-header"><h2 className="adm-table-title">Riwayat Perubahan Paket</h2></div>
          <table className="adm-table">
            <thead><tr><th>Tanggal</th><th>Aksi</th><th>Detail</th><th>Oleh</th></tr></thead>
            <tbody>
              {s.history.length === 0 ? (
                <tr><td colSpan={4} className="adm-empty-cell">Belum ada riwayat.</td></tr>
              ) : s.history.map((h, i) => (
                <tr key={i}>
                  <td className="adm-util-cell">{fmtDateTime(h.created_at)}</td>
                  <td><span className="adm-badge adm-badge--ec2">{ACTION_LABEL[h.action] || h.action}</span></td>
                  <td className="adm-owner-cell">{h.detail}</td>
                  <td className="adm-util-cell">{h.by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {showForce && (
        <div className="adm-modal-overlay" onClick={() => setShowForce(false)}>
          <div className="adm-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="adm-modal-title">Force Change Plan</h2>
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: -10, marginBottom: 16 }}>
              Ubah paket langganan <b>{s.client_name}</b> langsung (override admin). Hanya paket kategori <b>{s.category}</b>.
            </p>
            <div className="adm-field adm-field--full">
              <label>Paket Tujuan</label>
              <select value={targetPlan} onChange={(e) => setTargetPlan(e.target.value)}>
                <option value="">— pilih paket —</option>
                {samePlans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — Rp {new Intl.NumberFormat('id-ID').format(p.price)}</option>
                ))}
              </select>
            </div>
            <div className="adm-modal-actions">
              <button className="adm-btn-ghost" onClick={() => setShowForce(false)} disabled={busy}>Batal</button>
              <button className="adm-btn-primary" onClick={doForce} disabled={busy || !targetPlan}>{busy ? 'Memproses...' : 'Terapkan'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
