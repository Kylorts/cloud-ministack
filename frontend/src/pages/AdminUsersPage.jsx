import { useEffect, useState } from 'react'
import { parseUTC } from '../utils/datetime'
import { useNavigate } from 'react-router-dom'
import AdminNav from '../components/AdminNav'
import { getAdminUsers } from '../services/admin'
import AdminPagination from '../components/AdminPagination'
import './AdminDashboardPage.css'
import './AdminPages.css'

const PAGE_SIZE = 15

function fmtDate(s) {
  if (!s) return '-'
  return parseUTC(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Status langganan yang perlu disorot (status 'active' tak diberi pill agar tak ramai).
const SUB_STATUS = {
  over_quota: ['Over Quota', 'warn'],
  past_due: ['Nunggak', 'warn'],
  suspended: ['Disuspend', 'danger'],
  pending_payment: ['Pending', 'off'],
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const navigate = useNavigate()

  useEffect(() => { setPage(1) }, [q])
  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true)
      getAdminUsers({ q, page, page_size: PAGE_SIZE })
        .then((r) => { setUsers(r.data.items); setTotal(r.data.total) })
        .catch(() => { setUsers([]); setTotal(0) }).finally(() => setLoading(false))
    }, 200)
    return () => clearTimeout(t)
  }, [q, page])

  const filtered = users

  return (
    <div className="adm-page">
      <AdminNav breadcrumbs={[{ label: 'Manajemen Pengguna' }, { label: 'Daftar Klien' }]} />
      <main className="adm-main">
        <div className="adm-header">
          <h1 className="adm-page-title">Manajemen Pengguna</h1>
          <p className="adm-page-sub">Kelola akses, peran, dan status akun klien.</p>
        </div>

        <div className="adm-toolbar">
          <div className="adm-input-search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M21 21L16.5 16.5M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"/></svg>
            <input placeholder="Cari nama atau email..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        <div className="adm-table-card">
          <table className="adm-table">
            <thead><tr><th>Nama & Email</th><th>Peran</th><th>Status Akun</th><th>Paket Saat Ini</th><th>Dibuat Pada</th><th>Aksi</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="adm-loading-cell">Memuat...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="adm-empty-cell">Tidak ada klien.</td></tr>
              ) : filtered.map((u) => (
                <tr key={u.id}>
                  <td>
                    <span className="adm-instance-name">{u.name}</span>
                    <span className="adm-instance-id">{u.email}</span>
                  </td>
                  <td><span className={`adm-role-pill adm-role-pill--${u.role}`}>{u.role === 'admin' ? 'Admin' : 'User'}</span></td>
                  <td>
                    <span className={`adm-status-pill adm-status-pill--${u.status === 'active' ? 'ok' : u.status === 'suspended' ? 'warn' : 'off'}`}>
                      {u.status === 'active' ? '● Aktif' : u.status === 'suspended' ? '● Ditangguhkan' : u.status}
                    </span>
                  </td>
                  <td className="adm-owner-cell">
                    {u.packages?.length ? u.packages.map((p) => {
                      const st = SUB_STATUS[p.status]
                      return (
                        <div key={p.category} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span>{p.plan_name}</span>
                          {st && <span className={`adm-status-pill adm-status-pill--${st[1]}`}>{st[0]}</span>}
                        </div>
                      )
                    }) : '—'}
                  </td>
                  <td className="adm-util-cell">{fmtDate(u.created_at)}</td>
                  <td><button className="adm-link-btn" onClick={() => navigate(`/admin/pengguna/${u.id}`)}>Detail</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && <AdminPagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} label="klien" />}
        </div>
      </main>
    </div>
  )
}
