// Kontrol paginasi server-side untuk tabel admin (dipakai bersama).
export default function AdminPagination({ page, pageSize, total, onPage, label = 'baris' }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)
  return (
    <div className="adm-pagi">
      <span>Menampilkan {start}–{end} dari {total} {label}</span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="adm-btn-ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>Sebelumnya</button>
        <button className="adm-btn-ghost" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Selanjutnya</button>
      </div>
    </div>
  )
}
