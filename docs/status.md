# Status Implementasi vs Use Case — JadeStack

Acuan: **Use case 1.pdf** (User / Admin / Midtrans) + `docs/policies.md`.
Legenda: ✅ selesai · 🟡 sebagian / ditunda (sudah direncanakan) · 🔴 belum · ⚪ sengaja di-skip.

Terakhir diperbarui: 2026-06.

---

## Aktor: USER / Klien

| # | Use Case | Status | Catatan implementasi |
|---|----------|--------|----------------------|
| 1 | Registrasi akun | ✅ | `POST /auth/register` + halaman `/register` (nama, email, sandi; auto-login). Tanpa username & tanpa verifikasi email. |
| 2 | Login | ✅ | `POST /auth/login` (JWT). Feedback error inline. |
| 3 | Melihat daftar paket layanan | ✅ | Halaman `/paket`, tab Storage & Hosting. **Compute dihapus** (keputusan: tidak jadi). |
| 4 | Berlangganan paket | ✅ | Subscribe per-kategori, 1 aktif/kategori, **upgrade in-place**, cancel via modal+PIN. |
| 5 | Melihat dashboard | ✅ | `/dashboard` — kuota, paket, bucket, bandwidth, navigasi cepat, 3 keadaan akun. |
| 6 | Melakukan pembayaran | ⚪ | **Sengaja ditunda paling akhir / mungkin tidak ada.** Midtrans belum diintegrasi; subscribe langsung aktif. |
| 7 | Mengelola bucket storage | ✅ | Buat/lihat/hapus bucket (**hapus hanya jika kosong** + PIN), hapus semua file. |
| 8 | Upload file (quota & ukuran) | ✅ | Validasi `max_file_size` & sisa kuota; blok saat OVER_QUOTA / bucket dorman. |
| 9 | Download file | ✅ | Streaming via backend + sinkronisasi orphan MiniStack. |
| 10 | Mengelola static hosting | ✅ | Buat situs, deploy ZIP, rollback, hapus (+PIN); gateway sajikan di `/sites/{slug}`. |
| 11 | Melihat endpoint / akses layanan | ✅ | URL hosting di detail situs; endpoint storage + perintah `mc` di panel Access Key. |
| 12 | Mengajukan credential / access key | 🟡 | Generate manual per-layanan, secret tampil sekali (hash+last4), cabut+PIN. **Enforcement nyata (Opsi A: auth kunci, Read-Only, isolasi) DITUNDA** — MiniStack menerima kunci apa pun. |
| 13 | Melihat usage / penggunaan resource | ✅ | Halaman `/kuota` (storage, bucket, bandwidth, situs). |
| 14 | Melihat log aktivitas sendiri | ✅ | Halaman `/aktivitas` (tabel, filter, export CSV). |

**Kesimpulan USER:** seluruh use case inti **selesai**, kecuali pembayaran (⚪ sengaja akhir) dan enforcement access key (🟡 ditunda). Bagian user **siap; lanjut ke admin**.

### Tambahan keamanan user (di luar tabel use case, sudah dibuat)
- ✅ Ganti Password (MFA Tahap 1)
- ✅ PIN Transaksi (MFA Tahap 2) — wajib untuk cabut key, hapus situs, hapus bucket, batalkan langganan, ubah sandi
- 🟡 TOTP Authenticator (MFA Tahap 3) — **di-keep**, rencana lengkap ada di `policies.md`
- 🔴 Lupa kata sandi (link di login masih placeholder) — *Lupa PIN sudah ada (reset via password)*

---

## Aktor: ADMIN  (belum dibangun — fokus berikutnya)

| Use Case | Status | Catatan |
|----------|--------|---------|
| Login admin | ✅ | Pakai login yang sama; role `admin` (akun seed). |
| Dashboard admin | 🟡 | Halaman ada, baru `GET /admin/stats` (statistik dasar). |
| Mengelola pengguna (lihat/aktif/nonaktif/hapus) | 🔴 | Belum ada endpoint/halaman. |
| Mengelola paket layanan (CRUD plan) | 🔴 | Plan saat ini hanya dari seed; belum bisa kelola dari UI. |
| Mengatur quota paket | 🔴 | Bagian dari CRUD plan. |
| Melihat daftar layanan aktif | 🔴 | Belum ada. |
| Mengelola subscription klien (lihat/ubah status) | 🔴 | Belum ada (termasuk override downgrade/suspend). |
| Memantau penggunaan resource platform | 🔴 | Agregat global belum ada. |
| Melihat log aktivitas sistem | 🔴 | Log per-user ada; tampilan admin global belum. |
| Mengelola IAM policy (role/permission) | 🔴 | Role dasar (user/admin) ada; policy granular belum. |
| Menangani credential (lihat/cabut/rotasi key) | 🔴 | Belum ada panel admin. |
| Suspend layanan klien | 🔴 | Status `suspended` ada di model; aksi admin belum. |
| Memantau & verifikasi pembayaran (Midtrans) | ⚪ | Mengikuti pembayaran — ditunda paling akhir. |

---

## Aktor: MIDTRANS  ⚪ (ditunda paling akhir / opsional)
- Memproses pembayaran, webhook notification, status transaksi — **belum diintegrasi** sesuai keputusan "pembayaran paling belakang".

---

## Backlog fitur yang DITUNDA (ringkasan)
1. **Pembayaran / Midtrans** (⚪ paling akhir).
2. **Access Key enforcement (Opsi A)** — auth kunci nyata + Read-Only + isolasi per user.
3. **TOTP** (MFA Tahap 3) — rencana siap.
4. **Downgrade terjadwal** (akhir periode) — sekarang cancel-first.
5. **Grace period 7 hari → suspend** (Subscription Tahap 3).
6. **Lupa kata sandi** (alur reset).
7. **Compute service** — ⚪ dibatalkan (keputusan awal).
8. **Seluruh sisi ADMIN** (tabel di atas) — fokus pengembangan berikutnya.
