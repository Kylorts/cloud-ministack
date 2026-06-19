import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminNav from '../components/AdminNav'
import { getAdminUsers } from '../services/admin'
import './AdminDashboardPage.css'
import './AdminPages.css'

function fmtDate(s) {
  if (!s) return '-'
  return new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    getAdminUsers().then((r) => setUsers(r.data)).catch(() => setUsers([])).finally(() => setLoading(false))
  }, [])

  const filtered = users.filter((u) =>
    !q || u.name.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase()))

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
                  <td className="adm-owner-cell">{u.plan_name || '—'}</td>
                  <td className="adm-util-cell">{fmtDate(u.created_at)}</td>
                  <td><button className="adm-link-btn" onClick={() => navigate(`/admin/pengguna/${u.id}`)}>Detail</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && (
            <div className="adm-pagi"><span>Menampilkan {filtered.length} dari {users.length} klien</span></div>
          )}
        </div>
      </main>
    </div>
  )
}
