import { useEffect, useState } from 'react'
import { parseUTC } from '../utils/datetime'
import AdminNav from '../components/AdminNav'
import { getAdminAccessKeys, adminRevokeKey } from '../services/admin'
import AdminPagination from '../components/AdminPagination'
import './AdminDashboardPage.css'
import './AdminPages.css'

const PAGE_SIZE = 15

function fmtWhen(s) {
  if (!s) return 'Belum pernah'
  const d = parseUTC(s); const now = new Date()
  if (d.toDateString() === now.toDateString()) return `${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} · Hari ini`
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AdminAccessKeysGlobalPage() {
  const [keys, setKeys] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [detail, setDetail] = useState(null)
  const [busy, setBusy] = useState(false)

  function load() {
    return getAdminAccessKeys({ q, page, page_size: PAGE_SIZE })
      .then((r) => { setKeys(r.data.items); setTotal(r.data.total) })
      .catch(() => { setKeys([]); setTotal(0) })
  }
  useEffect(() => { setPage(1) }, [q])
  useEffect(() => {
    const t = setTimeout(() => { setLoading(true); load().finally(() => setLoading(false)) }, 200)
    return () => clearTimeout(t)
  }, [q, page])

  async function revoke(k) {
    if (!window.confirm(`Cabut access key ${k.access_key_id} milik ${k.owner_name}?`)) return
    setBusy(true)
    try { await adminRevokeKey(k.id); await load() }
    catch (e) { alert(e.response?.data?.detail || 'Gagal mencabut') }
    finally { setBusy(false) }
  }

  const filtered = keys

  return (
    <div className="adm-page">
      <AdminNav breadcrumbs={[{ label: 'Keamanan & Log Sistem' }, { label: 'Pantau Access Keys' }]} />
      <main className="adm-main">
        <div className="adm-toolbar">
          <div className="adm-header">
            <h1 className="adm-page-title">Manajemen Access Keys Global</h1>
            <p className="adm-page-sub">Pantau & cabut kredensial akses seluruh klien.</p>
          </div>
          <div className="adm-input-search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M21 21L16.5 16.5M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"/></svg>
            <input placeholder="Cari key atau pemilik..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        <div className="adm-table-card">
          <table className="adm-table">
            <thead><tr><th>Access Key ID</th><th>Pemilik</th><th>Status</th><th>Izin / Kategori</th><th>Terakhir Digunakan</th><th>Aksi</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="adm-loading-cell">Memuat...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="adm-empty-cell">Tidak ada access key.</td></tr>
              ) : filtered.map((k) => (
                <tr key={k.id}>
                  <td className="adm-keyid">{k.access_key_id}</td>
                  <td className="adm-instance-name">{k.owner_name}</td>
                  <td>
                    <span className={`adm-status-pill adm-status-pill--${k.status === 'active' ? 'ok' : k.status === 'revoked' ? 'danger' : 'off'}`}>
                      {k.status === 'active' ? 'Aktif' : k.status === 'revoked' ? 'Dicabut' : 'Disabled'}
                    </span>
                  </td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 6, background: '#F1EFE8', color: '#444441' }}>
                        {k.policy_name || (k.permission === 'read_only' ? 'Read-Only' : 'Full Access')}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 6, textTransform: 'capitalize', background: k.category === 'hosting' ? '#E6F1FB' : '#EAF3DE', color: k.category === 'hosting' ? '#185FA5' : '#3B6D11' }}>
                        {k.category}
                      </span>
                    </span>
                  </td>
                  <td className="adm-util-cell">{fmtWhen(k.last_used_at)}</td>
                  <td>
                    {k.status === 'active'
                      ? <button className="adm-link-btn" style={{ color: '#dc2626' }} onClick={() => revoke(k)} disabled={busy}>Revoke</button>
                      : <button className="adm-link-btn" onClick={() => setDetail(k)}>Detail</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && <AdminPagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} label="access key" />}
        </div>
      </main>

      {detail && (
        <div className="adm-modal-overlay" onClick={() => setDetail(null)}>
          <div className="adm-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <h2 className="adm-modal-title">Detail Access Key</h2>
            <div className="adm-info-row"><span>Access Key ID</span><span className="adm-keyid">{detail.access_key_id}</span></div>
            <div className="adm-info-row"><span>Pemilik</span><span>{detail.owner_name}</span></div>
            <div className="adm-info-row"><span>Status</span><span>{detail.status}</span></div>
            <div className="adm-info-row"><span>Izin</span><span>{detail.permission === 'read_only' ? 'Read-Only' : 'Full'}</span></div>
            <div className="adm-info-row"><span>Kategori</span><span>{detail.category}</span></div>
            <div className="adm-info-row"><span>Terakhir Digunakan</span><span>{fmtWhen(detail.last_used_at)}</span></div>
            <div className="adm-modal-actions"><button className="adm-btn-ghost" onClick={() => setDetail(null)}>Tutup</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
