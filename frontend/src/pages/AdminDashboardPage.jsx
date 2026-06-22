import { useState, useEffect } from 'react'
import { parseUTC } from '../utils/datetime'
import AdminNav from '../components/AdminNav'
import { getAdminStats, getAdminResources, getAdminAccessKeys } from '../services/admin'
import './AdminDashboardPage.css'

function fmtUptime(s) {
  if (!s || s < 0) return '0m'
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d) return `${d}h ${h}j`
  if (h) return `${h}j ${m}m`
  return `${m}m`
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const tb = bytes / (1024 ** 4)
  if (tb >= 1) return `${parseFloat(tb.toFixed(2))} TB`
  const gb = bytes / (1024 ** 3)
  if (gb >= 1) return `${parseFloat(gb.toFixed(1))} GB`
  const mb = bytes / (1024 ** 2)
  if (mb >= 1) return `${parseFloat(mb.toFixed(0))} MB`
  return `${Math.round(bytes / 1024)} KB`
}
function formatDate(s) {
  if (!s) return '-'
  return parseUTC(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function ServerIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="20" height="7" rx="2" stroke="#062F28" strokeWidth="1.6"/><rect x="2" y="14" width="20" height="7" rx="2" stroke="#062F28" strokeWidth="1.6"/><circle cx="6" cy="6.5" r="1" fill="#062F28"/><circle cx="6" cy="17.5" r="1" fill="#062F28"/></svg>
}
function UsersIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="#062F28" strokeWidth="1.6" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke="#062F28" strokeWidth="1.6"/></svg>
}
function DiskIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2" stroke="#062F28" strokeWidth="1.6"/><circle cx="12" cy="12" r="3" stroke="#062F28" strokeWidth="1.6"/></svg>
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null)
  const [resources, setResources] = useState([])
  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getAdminStats().catch(() => ({ data: null })),
      getAdminResources().catch(() => ({ data: [] })),
      getAdminAccessKeys({ page: 1, page_size: 5 }).catch(() => ({ data: { items: [] } })),
    ]).then(([s, r, k]) => {
      setStats(s.data); setResources(r.data || []); setKeys(k.data?.items || [])
    }).finally(() => setLoading(false))
  }, [])

  const storagePercent = stats?.storage_cap_bytes
    ? Math.round((stats.storage_used_bytes / stats.storage_cap_bytes) * 100) : 0

  // Pie utilisasi storage
  const obj = stats?.object_storage_bytes ?? 0
  const host = stats?.hosting_build_bytes ?? 0
  const system = Math.max(Math.round((obj + host) * 0.1), 1024 * 1024)
  const pieTotal = obj + host + system || 1
  const objPct = Math.round((obj / pieTotal) * 100)
  const hostPct = Math.round((host / pieTotal) * 100)
  const sysPct = Math.max(0, 100 - objPct - hostPct)
  const pieStyle = {
    background: `conic-gradient(#062F28 0 ${objPct}%, #9FE870 ${objPct}% ${objPct + hostPct}%, #d1d5db ${objPct + hostPct}% 100%)`,
  }

  return (
    <div className="adm-page">
      <AdminNav breadcrumbs={[{ label: 'Ringkasan Platform' }, { label: 'Dasbor Utama' }]} />

      <main className="adm-main">
        <div className="adm-header">
          <h1 className="adm-header-title">Dasbor Administrator Utama</h1>
          <p className="adm-header-sub">Pantau kesehatan platform dan aktivitas klien JadeStack.</p>
        </div>

        {/* Top stats */}
        <div className="adm-stats-grid">
          {/* Kesehatan platform (nyata: service inti up/down) */}
          <div className="adm-stat-card">
            <div className="adm-stat-head">
              <div>
                <p className="adm-stat-label">Kesehatan Platform</p>
                <p className="adm-stat-sublabel">Status service inti</p>
              </div>
              <span className="adm-stat-icon"><ServerIcon /></span>
            </div>
            <div className="adm-stat-center">
              <span className="adm-stat-big">{stats ? `${stats.services_healthy}/${stats.services_total}` : '–'}</span>
              <span className="adm-stat-unit">service aktif</span>
            </div>
            <div className="adm-stat-footer-text">
              ● {stats?.system_healthy ? 'Operasional' : 'Terdegradasi'}
              {stats && <> · uptime {fmtUptime(stats.uptime_seconds)}</>}
            </div>
          </div>

          {/* Klien & langganan */}
          <div className="adm-stat-card">
            <div className="adm-stat-head">
              <div>
                <p className="adm-stat-label">Klien &amp; Langganan Aktif</p>
                <p className="adm-stat-sublabel">Pengguna dalam sistem</p>
              </div>
              <span className="adm-stat-icon"><UsersIcon /></span>
            </div>
            <div className="adm-stat-center">
              <span className="adm-stat-big">{stats?.active_clients ?? 0}</span>
              <span className="adm-stat-unit">Klien Aktif</span>
            </div>
            <div className="adm-stat-footer-text">
              {stats?.active_subscriptions ?? 0} langganan aktif · {stats?.new_clients_this_month ?? 0} baru bulan ini
            </div>
          </div>

          {/* Kapasitas storage */}
          <div className="adm-stat-card">
            <div className="adm-stat-head">
              <div>
                <p className="adm-stat-label">Kapasitas Storage Platform</p>
                <p className="adm-stat-sublabel">Total pemakaian seluruh klien</p>
              </div>
              <span className="adm-stat-icon"><DiskIcon /></span>
            </div>
            <div className="adm-cap-value">
              {formatBytes(stats?.storage_used_bytes ?? 0)} <span className="adm-cap-total">/ {formatBytes(stats?.storage_cap_bytes ?? 0)}</span>
            </div>
            <div className="adm-cap-bar"><div className="adm-cap-fill" style={{ width: `${Math.min(storagePercent, 100)}%` }} /></div>
            <div className="adm-stat-footer-text" style={{ borderTop: 'none', paddingTop: 0, textAlign: 'right' }}>{storagePercent}% terpakai</div>
          </div>
        </div>

        {/* Middle: pie + resources */}
        <div className="adm-mid-grid">
          <div className="adm-table-card">
            <div className="adm-table-header"><h2 className="adm-table-title">Utilisasi Storage Platform</h2></div>
            <div className="adm-pie-wrap">
              <div className="adm-pie" style={pieStyle}><div className="adm-pie-hole" /></div>
              <ul className="adm-pie-legend">
                <li><span className="adm-dot" style={{ background: '#062F28' }} /> Object Storage <b>{objPct}%</b></li>
                <li><span className="adm-dot" style={{ background: '#9FE870' }} /> Hosting Build <b>{hostPct}%</b></li>
                <li><span className="adm-dot" style={{ background: '#d1d5db' }} /> Sistem &amp; Log <b>{sysPct}%</b></li>
              </ul>
            </div>
          </div>

          <div className="adm-table-card">
            <div className="adm-table-header"><h2 className="adm-table-title">Ringkasan Unit Layanan Klien</h2></div>
            <table className="adm-table">
              <thead><tr><th>Nama Resource</th><th>Pemilik</th><th>Tipe</th><th>Utilisasi</th></tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="adm-loading-cell">Memuat...</td></tr>
                ) : resources.length === 0 ? (
                  <tr><td colSpan={4} className="adm-empty-cell">Belum ada resource klien.</td></tr>
                ) : resources.slice(0, 8).map((r) => (
                  <tr key={`${r.type}-${r.id}`}>
                    <td><span className="adm-instance-name">{r.name}</span></td>
                    <td className="adm-owner-cell">{r.owner_name}</td>
                    <td><span className={`adm-badge ${r.type === 'Static' ? 'adm-badge--minio' : 'adm-badge--ec2'}`}>{r.type}</span></td>
                    <td>
                      {r.type === 'Static' ? <span className="adm-util-cell">–</span> : (
                        <div className="adm-util-wrap">
                          <div className="adm-util-bar"><div className="adm-util-fill" style={{ width: `${r.utilization_percent}%` }} /></div>
                          <span className="adm-util-num">{r.utilization_percent}%</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Access keys platform */}
        <div className="adm-table-card">
          <div className="adm-table-header"><h2 className="adm-table-title">Manajemen Access Keys Platform</h2></div>
          <table className="adm-table">
            <thead><tr><th>Access Key ID</th><th>Pemilik</th><th>Kategori</th><th>Status</th><th>Dibuat Pada</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="adm-loading-cell">Memuat...</td></tr>
              ) : keys.length === 0 ? (
                <tr><td colSpan={5} className="adm-empty-cell">Belum ada access key.</td></tr>
              ) : keys.slice(0, 10).map((k) => (
                <tr key={k.id}>
                  <td className="adm-keyid">{k.access_key_id}</td>
                  <td className="adm-owner-cell">{k.owner_name}</td>
                  <td><span className="adm-badge adm-badge--minio">{k.category}</span></td>
                  <td>
                    <span className={`adm-status-pill adm-status-pill--${k.status === 'active' ? 'ok' : 'off'}`}>
                      {k.status === 'active' ? 'Aktif' : k.status === 'revoked' ? 'Dicabut' : k.status}
                    </span>
                  </td>
                  <td className="adm-util-cell">{formatDate(k.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      <footer className="adm-footer">
        <span className="adm-footer-copy">© 2026 JADESTACK.</span>
        <div className="adm-footer-links">
          <a href="#">Lingkungan: MiniStack (S3 emulator)</a>
          <a href="#">Status: {stats?.system_healthy ? 'Operasional' : stats ? 'Terdegradasi' : '—'}</a>
        </div>
      </footer>
    </div>
  )
}
