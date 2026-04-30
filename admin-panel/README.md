# Admin Panel — Birthday Video Custom

Admin panel untuk mengelola pemesanan video ulang tahun custom, dibangun sesuai **DOKUMENTASI_ADMIN_FINAL_v3_REVISED.md** (versi 3.0).

**Stack:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase (Auth + Postgres).

---

## Fitur yang Sudah Ada

- ✅ **Dashboard** — statistik order, kode, dan live session (bagian 22)
- ✅ **Manajemen Pesanan** — list dengan filter, cancel order, export harian CSV/JSON (bagian 15)
- ✅ **Manajemen Kode Pesanan** — import dari CSV/JSON, bulk expire, export (bagian 12)
- ✅ **Live Sessions** — buat, close, cancel, export per sesi (bagian 3)
- ✅ **Manajemen Tema** — CRUD lengkap dengan filter package/gender/parents content (bagian 11)
- ✅ **Master Data** — CRUD Hair Styles, Eyeglasses, Character Assets, dan Admin Validation Codes
- ✅ **Login Admin** — pakai Supabase Auth
- ✅ **API Customer** — `validate-code` & `submit-order` dengan transaksi atomic (bagian 5, 6, 14)
- ✅ **Anti brute force** — code attempts tracking dengan blokir 30 menit (bagian 19)
- ✅ **Anti double submit** — UNIQUE constraint + stored function `submit_order_atomic` (bagian 6)
- ✅ **Sanitasi input** — DOMPurify + validator.js (bagian 18)
- ✅ **Snapshot data** — order menyimpan salinan tema, hair, eyeglasses, dll (bagian 17)
- ✅ **Confirmation dialogs** — untuk semua aksi penting (bagian 24)
- ✅ **Empty state & error state** — sesuai bagian 23

---

## Setup — Langkah demi Langkah

### 1. Install dependencies

```bash
npm install
```

### 2. Buat project Supabase

1. Buka [supabase.com](https://supabase.com) → New Project
2. Tunggu sampai database siap

### 3. Setup database schema

1. Buka **SQL Editor** di Supabase Dashboard
2. Buka file `supabase/schema.sql` dari project ini
3. Copy seluruh isinya → paste di SQL Editor → klik **Run**

Schema ini akan membuat:

- 11 tabel (orders, order_codes, live_sessions, themes, hair_styles, eyeglasses, character_assets, code_attempts, admin_validation_codes, export_logs, theme_package_codes)
- Semua index sesuai bagian 20 dokumentasi
- Stored function `submit_order_atomic` untuk transaksi submit
- Seed data 4 tema contoh agar UI tidak kosong

### 4. Setup environment variable

Copy `.env.example` jadi `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local` dan isi dari **Supabase Dashboard → Settings → API**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
ADMIN_EMAILS=admin@example.com
ADMIN_REVENUE_PASSWORD=ganti-dengan-password-anda
```

> ⚠️ **PENTING:** `SUPABASE_SERVICE_ROLE_KEY` punya akses penuh ke database. JANGAN commit `.env.local` ke git, JANGAN expose ke browser.

`ADMIN_REVENUE_PASSWORD` dipakai untuk membuka halaman pendapatan (route: `/pendapatan`).

### 5. Buat user admin di Supabase

1. Supabase Dashboard → **Authentication → Users → Add user**
2. Pilih **"Create new user"** (bukan invite)
3. Isi email & password
4. Klik **Create user**
5. Pastikan email user admin itu ada di `ADMIN_EMAILS` pada `.env.local`

User ini yang akan dipakai login ke admin panel.

### 6. Run development server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) — akan diredirect ke `/login`.
Login pakai user yang barusan dibuat → masuk ke dashboard.

---

## Struktur Project

```
admin-panel/
├── app/
│   ├── api/
│   │   ├── admin/                  # Endpoint admin (perlu login)
│   │   │   ├── dashboard/
│   │   │   ├── orders/             # list, detail, cancel, export
│   │   │   ├── codes/              # list, import, expire, export
│   │   │   ├── live-sessions/      # list, create, close, cancel
│   │   │   └── themes/             # list, create, update, deactivate
│   │   └── customer/               # Endpoint untuk customer form
│   │       ├── validate-code/      # Validasi kode awal
│   │       └── submit-order/       # Submit order final (atomic)
│   ├── dashboard/
│   ├── orders/
│   ├── codes/
│   ├── live-sessions/
│   ├── themes/
│   ├── login/
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── AdminShell.tsx              # Layout dengan sidebar
│   ├── Sidebar.tsx
│   ├── PageHeader.tsx
│   ├── ConfirmDialog.tsx
│   └── Toast.tsx
├── lib/
│   ├── constants.ts                # Regex kode, package codes, dll
│   ├── sanitize.ts                 # DOMPurify + validator helpers
│   ├── order-id.ts                 # Generator public_order_id
│   ├── auth.ts                     # Helper auth untuk API routes
│   ├── supabase-admin.ts           # Server client (service role key)
│   └── supabase-browser.ts         # Browser client (anon key)
├── supabase/
│   └── schema.sql                  # SQL migration lengkap
├── middleware.ts                    # Proteksi route admin
├── .env.example
├── package.json
└── README.md
```

---

## API Customer (untuk Customer Form)

Customer form (yang akan dibuat terpisah) harus pakai 2 endpoint ini:

### `POST /api/customer/validate-code`

Validasi kode di awal flow form.

**Body:**
```json
{
  "code": "HM7A!9KQ2P",
  "device_key": "optional-device-fingerprint",
  "admin_validation_code": "optional-jika-terblokir"
}
```

**Response (sukses):**
```json
{
  "valid": true,
  "package_code": "HM",
  "package_label": "Hemat",
  "live_session_id": null,
  "live_session_name": null
}
```

**Response (gagal):** `4xx` dengan field `error`. Setelah 5 percobaan gagal, akan minta `need_admin_validation` dan blokir 30 menit.

### `POST /api/customer/submit-order`

Submit order final. Ini transaksi atomic — jika berhasil, kode otomatis berubah jadi `used`.

**Body lengkap:**
```json
{
  "order_code": "HM7A!9KQ2P",
  "live_session_id": null,
  "theme_code": "PRG001",
  "nama_pemesan": "Budi",
  "whatsapp_full": "628123456789",
  "email": "budi@example.com",
  "nickname_anak": "Aira",
  "nama_lengkap_anak": "Aira Putri",
  "usia_anak": "6 tahun",
  "character_gender": "girl",
  "tanggal_acara": "2026-05-20",
  "deadline_dibutuhkan": "2026-05-15",
  "birthday_number": 6,
  "hair_style_code": "HA",
  "eyeglasses_code": "EA",
  "skin_tone": "fair",
  "hair_color": "brown",
  "outfit_color": "pink",
  "parents_content": "mom_and_dad",
  "mom_nickname": "Bunda",
  "dad_nickname": "Ayah",
  "special_notes": "Catatan khusus...",
  "pronunciation_note": "Aira dibaca AI-RA"
}
```

**Response (sukses):**
```json
{
  "ok": true,
  "public_order_id": "HM-20260427-101530-A7K2P"
}
```

---

## Catatan untuk Production

Sebelum deploy:

1. **Aktifkan RLS (Row Level Security)** di tabel-tabel sensitif kalau mau tambahan defense in depth
2. **Storage buckets** — buat di Supabase Storage: `theme-previews`, `hair-styles`, `eyeglasses`, `character-assets` (bagian 16)
3. **Backup database** — atur backup harian otomatis dari Supabase plan (bagian 25)
4. **HTTPS** — wajib pakai HTTPS untuk production
5. **Seed asset awal** — isi Hair Styles, Eyeglasses, dan Character Assets dari menu Master Data sebelum customer form dipakai.

---

## Deploy ke Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Atau push ke GitHub → connect repo di [vercel.com](https://vercel.com).

**Jangan lupa:** set environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAILS`, `ADMIN_REVENUE_PASSWORD`) di Vercel project settings.

---

## Yang Belum Ada di Admin Panel Ini

- Customer-facing form untuk pemesanan (di luar scope admin panel)
- Upload langsung ke Supabase Storage dari admin panel. Saat ini image masih dimasukkan sebagai URL.

Tabel & schema untuk kebutuhan customer form sudah disiapkan di `schema.sql`.

---

## Lisensi

Internal use.
