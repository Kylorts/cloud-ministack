import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminNav from '../components/AdminNav'
import { getAdminMonitoring } from '../services/admin'
import './AdminDashboardPage.css'
import './AdminPages.css'

function fmtBytes(b) {
  if (!b) return '0 B'
  const tb = b / 1024 ** 4; if (tb >= 1) return `${parseFloat(tb.toFixed(2))} TB`
  const gb = b / 1024 ** 3; if (gb >= 1) return `${parseFloat(gb.toFixed(1))} GB`
  return `${Math.round(b / 1024 ** 2)} MB`
}

function DiskIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2" stroke="#062F28" strokeWidth="1.6"/><circle cx="12" cy="12" r="3" stroke="#062F28" strokeWidth="1.6"/></svg> }
function FlowIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 7h11l-3-3M20 17H9l3 3" stroke="#062F28" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg> }
function BoxIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="#062F28" strokeWidth="1.6"/></svg> }

export default function AdminMonitoringPage() {
  const [m, setM] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    getAdminMonitoring().then((r) => setM(r.data)).catch(() => setM(null)).finally(() => setLoading(false))
  }, [])

  function exportCsv() {
    if (!m) return
    const rows = [
      ['Metrik', 'Nilai'],
      ['Total Storage Terpakai', fmtBytes(m.storage_used_bytes)],
      ['Kapasitas Platform', fmtBytes(m.storage_cap_bytes)],
      ['Total Bandwidth', fmtBytes(m.bandwidth_used_bytes)],
      ['Total Bucket', m.bucket_count],
      ['Total Situs', m.site_count],
      ['Nodes Active', `${m.nodes_active}/${m.nodes_total}`],
      ['Kapasitas Server', `${m.capacity_percent}%`],
      ['Avg Load', `${m.avg_load_percent}%`],
      [],
      ['Top Storage Users', 'Pemakaian'],
      ...m.top_storage_users.map((u) => [u.name, fmtBytes(u.used_bytes)]),
    ]
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = 'monitoring-sumber-daya.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="adm-page">
      <AdminNav breadcrumbs={[{ label: 'Pantau Sumber Daya' }, { label: 'Monitoring' }]} />
      <main className="adm-main">
        <div className="adm-toolbar">
          <div className="adm-header">
            <h1 className="adm-page-title">Pantauan Sumber Daya Global</h1>
            <p className="adm-page-sub">Ringkasan kesehatan, pemakaian, dan metrik kunci seluruh platform.</p>
          </div>
          <button className="adm-btn-ghost" onClick={exportCsv}>↓ Export CSV</button>
        </div>

        {loading ? <div className="adm-loading">Memuat...</div> : !m ? (
          <div className="adm-loading">Gagal memuat data.</div>
        ) : (
          <>
            <div className="adm-stats-grid">
              <div className="adm-stat-card">
                <div className="adm-stat-head"><div><p className="adm-stat-label">Total Storage Terpakai</p><p className="adm-stat-sublabel">Object storage seluruh klien</p></div><span className="adm-stat-icon"><DiskIcon /></span></div>
                <div className="adm-cap-value">{fmtBytes(m.storage_used_bytes)}</div>
                <div className="adm-cap-bar"><div className="adm-cap-fill" style={{ width: `${Math.min(m.capacity_percent, 100)}%` }} /></div>
                <div className="adm-stat-footer-text" style={{ borderTop: 'none', paddingTop: 0, textAlign: 'left' }}>dari {fmtBytes(m.storage_cap_bytes)} kapasitas</div>
              </div>
              <div className="adm-stat-card">
                <div className="adm-stat-head"><div><p className="adm-stat-label">Total Bandwidth</p><p className="adm-stat-sublabel">Trafik hosting kumulatif</p></div><span className="adm-stat-icon"><FlowIcon /></span></div>
                <div className="adm-stat-center"><span className="adm-stat-big" style={{ fontSize: 36 }}>{fmtBytes(m.bandwidth_used_bytes)}</span><span className="adm-stat-unit">terpakai</span></div>
              </div>
              <div className="adm-stat-card">
                <div className="adm-stat-head"><div><p className="adm-stat-label">Total Infrastruktur</p><p className="adm-stat-sublabel">Unit aktif</p></div><span className="adm-stat-icon"><BoxIcon /></span></div>
                <div className="adm-infra-row">
                  <div className="adm-infra-cell" onClick={() => navigate('/admin/monitoring/storage')}>
                    <span className="adm-infra-num">{m.bucket_count}</span><span className="adm-infra-lbl">Bucket →</span>
                  </div>
                  <div className="adm-infra-cell" onClick={() => navigate('/admin/monitoring/hosting')}>
                    <span className="adm-infra-num">{m.site_count}</span><span className="adm-infra-lbl">Situs →</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="adm-two-col">
              <div className="adm-table-card">
                <div className="adm-table-header"><h2 className="adm-table-title">Top 3 Storage Users</h2></div>
                <table className="adm-table">
                  <thead><tr><th>Klien</th><th>Pemakaian</th></tr></thead>
                  <tbody>
                    {m.top_storage_users.length === 0 ? (
                      <tr><td colSpan={2} className="adm-empty-cell">Belum ada data.</td></tr>
                    ) : m.top_storage_users.map((u, i) => (
                      <tr key={i}>
                        <td><div className="adm-name-cell"><span className="adm-avatar-sm">{u.name.charAt(0).toUpperCase()}</span><span className="adm-instance-name">{u.name}</span></div></td>
                        <td className="adm-owner-cell">{fmtBytes(u.used_bytes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="adm-table-card">
                <div className="adm-table-header">
                  <h2 className="adm-table-title">Status Node Internal</h2>
                  <span className={`adm-status-pill adm-status-pill--${m.healthy ? 'ok' : 'danger'}`}>{m.healthy ? '● Healthy' : 'Degraded'}</span>
                </div>
                <div className="adm-bar-row-label"><span>Kapasitas Server Keseluruhan</span><span>{m.capacity_percent}%</span></div>
                <div className="adm-bar"><div className="adm-bar-fill" style={{ width: `${Math.min(m.capacity_percent, 100)}%`, background: 'var(--color-accent)' }} /></div>
                <div className="adm-mini-grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 18 }}>
                  <div><div className="adm-mini-label">Nodes Active <span style={{ color: '#9ca3af' }}>(simulasi)</span></div><div className="adm-mini-value">{m.nodes_active} / {m.nodes_total}</div></div>
                  <div><div className="adm-mini-label">Avg Load <span style={{ color: '#9ca3af' }}>(simulasi)</span></div><div className="adm-mini-value">{m.avg_load_percent}%</div></div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
