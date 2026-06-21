# JadeStack — INI AWAN

Simulasi layanan komputasi awan bergaya **Infrastructure-as-a-Service (IaaS)** untuk mata
kuliah Komputasi Awan. Menyediakan penyimpanan objek (S3-compatible via MiniStack), hosting
situs statis, langganan paket, kredensial Access Key/Secret Key dengan kebijakan **IAM**,
pencatatan aktivitas, dan panel **admin**.

Seluruh sistem berjalan di **Docker** — tidak perlu memasang Python, Node, atau MySQL secara
manual di komputer.

---

## Prasyarat

| Kebutuhan | Keterangan |
|-----------|------------|
| **Docker Desktop** | Wajib & harus dalam keadaan **berjalan**. Di Windows aktifkan backend **WSL2**. |
| **Git** | Untuk meng-clone repositori. |
| Koneksi internet | Hanya saat build pertama (mengunduh image & dependensi). |

> Tidak butuh file `.env` — seluruh konfigurasi sudah ada di `docker-compose.yml`.

---

## Cara menjalankan

```bash
# 1. Clone repositori
git clone https://github.com/Kylorts/cloud-ministack.git

# 2. Masuk ke folder proyek
cd cloud-ministack

# 3. Build & jalankan semua layanan (build pertama butuh beberapa menit)
docker compose up -d --build
```

Saat backend pertama kali start, migrasi basis data dan data awal dijalankan **otomatis**
(`alembic upgrade head` → `seed.py`). Tunggu ~30–60 detik hingga semua kontainer sehat, lalu
buka antarmuka di browser:

```
http://localhost:81
```

Selesai. 🎉

---

## Menjalankan tanpa Docker (mode pengembangan)

Mode ini menjalankan **backend & frontend langsung di komputer** (mendukung hot-reload), cocok
untuk pengembangan. Layanan infrastruktur (MySQL, MiniStack, Mailpit) tetap paling praktis
dijalankan lewat Docker karena **MiniStack tidak punya instalasi native**.

**Prasyarat tambahan:** Python 3.12+, Node.js 20+, dan pnpm (`npm install -g pnpm`).

### 1. Jalankan layanan infrastruktur saja (via Docker)

```bash
docker compose up -d db ministack mailpit
```

Ini menyalakan MySQL (`localhost:3307`), MiniStack (`localhost:4566`), dan Mailpit
(`localhost:8025`, SMTP `1025`). *Jika ingin benar-benar tanpa Docker:* pasang MySQL 8 native
dan buat database bernama `iniawan` (gunakan `DB_PORT=3306`); MiniStack & Mailpit tetap
disarankan via Docker.

### 2. Backend (terminal 1)

```bash
cd backend
python -m venv .venv

# Aktifkan virtual environment:
#   Windows (PowerShell):  .venv\Scripts\Activate.ps1
#   macOS / Linux:         source .venv/bin/activate

pip install -r requirements.txt
```

Buat file **`backend/.env`** berisi (menunjuk ke infrastruktur lokal):

```env
DB_HOST=localhost
DB_PORT=3307
DB_USER=root
DB_PASSWORD=
DB_NAME=iniawan
CORS_ORIGINS=http://localhost:5173
MINISTACK_ENDPOINT=http://localhost:4566
SMTP_HOST=localhost
SMTP_PORT=1025
APP_BASE_URL=http://localhost:5173
```

Lalu migrasi skema, isi data awal, dan jalankan server:

```bash
alembic upgrade head
python seed.py
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend (terminal 2)

```bash
cd frontend
pnpm install

# Windows (PowerShell):
$env:VITE_API_URL="http://localhost:8000"; pnpm dev

# macOS / Linux:
VITE_API_URL=http://localhost:8000 pnpm dev
```

Buka URL yang ditampilkan Vite — biasanya **http://localhost:5173**.

> Pada mode ini frontend berada di port **5173** (bukan 81). Karena itu `APP_BASE_URL` dan
> `CORS_ORIGINS` di `.env` diarahkan ke `http://localhost:5173`.

---

## Layanan & port

| Layanan | URL / Port | Fungsi |
|---------|-----------|--------|
| **Frontend** (UI) | http://localhost:81 | Antarmuka aplikasi (React) |
| **Backend** (API) | http://localhost:8000 — dokumentasi di `/docs` | REST API (FastAPI) |
| **MySQL** | `localhost:3307` | Basis data |
| **MiniStack** | `localhost:4566` | Penyimpanan objek (emulator S3) |
| **Mailpit** | http://localhost:8025 | Inbox email (untuk reset kata sandi) |

---

## Akun default

Dibuat otomatis oleh `seed.py` saat startup:

| Peran | Email | Kata sandi |
|-------|-------|-----------|
| Admin | `admin@iniawan.id` | `admin123` |
| Klien | `dika@iniawan.id` | `user123` |

Anda juga bisa mendaftar akun klien baru lewat halaman **Daftar** (otomatis mendapat tier *Free*).

---

## Data demo (opsional)

Skrip berikut menambah akun-akun contoh untuk peragaan. Jalankan **setelah** sistem hidup:

```bash
# Tiga klien dengan kondisi kuota berbeda (password: demo123)
docker compose exec backend python seed_demo.py --reset

# Tiga skenario siklus langganan: nunggak, disuspend-grace, disuspend-admin (password: demo123)
docker compose exec backend python seed_scenarios.py --reset

# Satu klien "polos" tanpa langganan (untuk menguji onboarding / state kosong)
docker compose exec backend python seed_fresh.py
```

---

## Mencoba fitur lupa kata sandi

1. Di halaman **Masuk**, klik **"Lupa kata sandi?"** dan masukkan email akun (mis. `dika@iniawan.id`).
2. Buka inbox **Mailpit** di http://localhost:8025 — email berisi tautan reset akan muncul di sana.
3. Klik tautan pada email → buat kata sandi baru (minimal 8 karakter).

> Email ditangkap Mailpit secara lokal (tidak benar-benar terkirim ke internet).

---

## Perintah yang berguna

```bash
# Melihat log backend secara real-time
docker compose logs -f backend

# Status semua kontainer
docker compose ps

# Menghentikan (data tetap tersimpan)
docker compose stop

# Menjalankan kembali
docker compose start

# Build ulang setelah ada perubahan kode
docker compose up -d --build

# Mematikan & menghapus kontainer (data MASIH tersimpan di volume)
docker compose down

# Reset TOTAL — hapus kontainer + seluruh data (DB & objek MiniStack)
docker compose down -v
```

---

## Struktur proyek

```
cloud-ministack/
├── backend/            FastAPI + SQLAlchemy + Alembic (API, logika bisnis, proxy S3/hosting)
│   ├── app/            Kode aplikasi (routers, models, core, schemas)
│   ├── alembic/        Migrasi skema basis data
│   ├── seed.py         Data awal (admin, dika, katalog paket) — jalan otomatis saat startup
│   └── seed_*.py       Skrip data demo (opsional)
├── frontend/           React 19 + Vite (antarmuka pengguna)
├── scripts/            Skrip bantu (mis. generator dokumentasi)
├── docker-compose.yml  Orkestrasi seluruh layanan
└── README.md
```


---

## Tumpukan teknologi

- **Backend:** FastAPI, SQLAlchemy 2.0, Alembic, PyMySQL, boto3 (klien S3), JWT, bcrypt
- **Frontend:** React 19, Vite, React Router 7, Axios (build dengan pnpm)
- **Infrastruktur:** Docker Compose, MySQL 8, MiniStack (emulator S3), Mailpit (SMTP), Nginx

---

## Pemecahan masalah

| Gejala | Solusi |
|--------|--------|
| `http://localhost:81` belum bisa dibuka | Tunggu beberapa saat; cek `docker compose ps` & `docker compose logs -f backend`. |
| Port bentrok (81 / 8000 / 3307 / 4566 / 8025 sudah dipakai) | Hentikan aplikasi yang memakai port itu, atau ubah pemetaan port di `docker-compose.yml`. |
| Backend error koneksi DB saat start pertama | Wajar bila MySQL belum siap — backend menunggu *healthcheck*; coba `docker compose restart backend`. |
| Ingin mulai dari nol (data bersih) | `docker compose down -v` lalu `docker compose up -d --build`. |
| Docker error "daemon not running" | Pastikan Docker Desktop sudah dijalankan. |
