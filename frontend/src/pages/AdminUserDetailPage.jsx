import { useEffect, useState } from 'react'
import { parseUTC } from '../utils/datetime'
import { useParams, useNavigate } from 'react-router-dom'
import AdminNav from '../components/AdminNav'
import { getAdminUser, setUserStatus } from '../services/admin'
import { actionLabel } from '../utils/actionLabels'
import './AdminDashboardPage.css'
import './AdminPages.css'

function fmtBytes(b) {
  if (!b) return '0 B'
  const gb = b / 1024 ** 3
  if (gb >= 1) return `${parseFloat(gb.toFixed(1))} GB`
  const mb = b / 1024 ** 2
  if (mb >= 1) return `${parseFloat(mb.toFixed(0))} MB`
  return `${Math.round(b / 1024)} KB`
}
function fmtDateTime(s) {
  if (!s) return '-'
  const d = parseUTC(s)
  return `${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
}

export default function AdminUserDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [u, setU] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  function load() {
    return getAdminUser(id).then((r) => setU(r.data)).catch((e) => {
      if (e.response?.status === 404) navigate('/admin/pengguna', { replace: true })
    })
  }
  useEffect(() => { load().finally(() => setLoading(false)) }, [id])

  async function toggleStatus() {
    const next = u.status === 'active' ? 'suspended' : 'active'
    if (!window.confirm(next === 'suspended' ? `Tangguhkan akun ${u.email}?` : `Aktifkan kembali akun ${u.email}?`)) return
    setBusy(true)
    try { await setUserStatus(id, next); await load() }
    catch (err) { alert(err.response?.data?.detail || 'Gagal mengubah status') }
    finally { setBusy(false) }
  }

  if (loading) return <div className="adm-page"><AdminNav /><div className="adm-loading">Memuat...</div></div>
  if (!u) return null

  const storagePct = u.storage_limit_bytes ? Math.round(u.storage_used_bytes / u.storage_limit_bytes * 100) : 0
  const bwPct = u.bandwidth_limit_bytes ? Math.round(u.bandwidth_used_bytes / u.bandwidth_limit_bytes * 100) : 0

  return (
    <div className="adm-page">
      <AdminNav breadcrumbs={[{ label: 'Manajemen Pengguna', path: '/admin/pengguna' }, { label: 'Detail Klien' }]} />
      <main className="adm-main">
        {/* Header */}
        <div className="adm-detail-head">
          <div className="adm-detail-id">
            <div className="adm-avatar-lg">{u.name.charAt(0).toUpperCase()}</div>
            <div>
              <h1 className="adm-detail-name">
                {u.name}
                <span className={`adm-status-pill adm-status-pill--${u.status === 'active' ? 'ok' : u.status === 'suspended' ? 'warn' : 'off'}`}>
                  {u.status === 'active' ? 'Aktif' : u.status === 'suspended' ? 'Ditangguhkan' : u.status}
                </span>
              </h1>
              <p className="adm-detail-meta">{u.email} · {u.role === 'admin' ? 'Admin' : 'User'}</p>
            </div>
          </div>
          <div className="adm-detail-actions">
            {u.role !== 'admin' && (
              <button className={`adm-btn-ghost ${u.status === 'active' ? 'adm-btn-suspend' : ''}`} onClick={toggleStatus} disabled={busy}>
                {u.status === 'active' ? 'Tangguhkan Akun' : 'Aktifkan Akun'}
              </button>
            )}
          </div>
        </div>

        {/* Mini stats */}
        <div className="adm-mini-grid">
          <div className="adm-mini"><div className="adm-mini-label">Total Bucket</div><div className="adm-mini-value">{u.bucket_count} <small>/ {u.bucket_limit}</small></div></div>
          <div className="adm-mini"><div className="adm-mini-label">Static Site</div><div className="adm-mini-value">{u.site_count} <small>/ {u.site_limit}</small></div></div>
          <div className="adm-mini"><div className="adm-mini-label">Access Keys</div><div className="adm-mini-value">{u.access_key_count} <small>/ {u.access_key_limit}</small></div></div>
        </div>

        {/* Info + alokasi */}
        <div className="adm-two-col">
          <div className="adm-table-card">
            <div className="adm-table-header"><h2 className="adm-table-title">Informasi Akun</h2></div>
            <div className="adm-info-row"><span>Paket Storage</span><span>{u.storage_plan_name || '—'}</span></div>
            <div className="adm-info-row"><span>Paket Hosting</span><span>{u.hosting_plan_name || '—'}</span></div>
            <div className="adm-info-row"><span>Tanggal Daftar</span><span>{fmtDateTime(u.created_at)}</span></div>
            <div className="adm-info-row"><span>ID Klien</span><span>CL-{String(u.id).padStart(6, '0')}</span></div>
          </div>
          <div className="adm-table-card">
            <div className="adm-table-header"><h2 className="adm-table-title">Alokasi Sumber Daya</h2></div>
            <div className="adm-bar-row-label"><span>Object Storage</span><span>{fmtBytes(u.storage_used_bytes)} / {fmtBytes(u.storage_limit_bytes)}</span></div>
            <div className="adm-bar"><div className="adm-bar-fill" style={{ width: `${Math.min(storagePct, 100)}%`, background: 'var(--color-accent)' }} /></div>
            <div className="adm-bar-row-label" style={{ marginTop: 14 }}><span>Bandwidth Hosting</span><span>{fmtBytes(u.bandwidth_used_bytes)} / {fmtBytes(u.bandwidth_limit_bytes)}</span></div>
            <div className="adm-bar"><div className="adm-bar-fill" style={{ width: `${Math.min(bwPct, 100)}%`, background: '#0066CC' }} /></div>
          </div>
        </div>

        {/* Resources */}
        <div className="adm-table-card">
          <div className="adm-table-header"><h2 className="adm-table-title">Sumber Daya Virtual Dimiliki</h2></div>
          <table className="adm-table">
            <thead><tr><th>Tipe Layanan</th><th>Nama Sumber Daya</th><th>Status</th></tr></thead>
            <tbody>
              {u.resources.length === 0 ? (
                <tr><td colSpan={3} className="adm-empty-cell">Belum ada sumber daya.</td></tr>
              ) : u.resources.map((r) => (
                <tr key={`${r.type}-${r.id}`}>
                  <td className="adm-owner-cell">{r.type}</td>
                  <td className="adm-keyid">{r.name}</td>
                  <td><span className="adm-status-pill adm-status-pill--ok">Aktif</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Activity */}
        <div className="adm-table-card">
          <div className="adm-table-header"><h2 className="adm-table-title">Log Aktivitas Klien</h2></div>
          <table className="adm-table">
            <thead><tr><th>Waktu</th><th>Aktivitas</th><th>Detail</th><th>IP</th></tr></thead>
            <tbody>
              {u.activities.length === 0 ? (
                <tr><td colSpan={4} className="adm-empty-cell">Belum ada aktivitas.</td></tr>
              ) : u.activities.map((a) => (
                <tr key={a.id}>
                  <td className="adm-util-cell">{fmtDateTime(a.created_at)}</td>
                  <td className="adm-keyid">{actionLabel(a.action)}</td>
                  <td className="adm-owner-cell">{a.description}</td>
                  <td className="adm-util-cell">{a.ip_address || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
