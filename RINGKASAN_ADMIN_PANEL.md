# Ringkasan Admin Panel

Dokumen ini merangkum isi folder `admin-panel`, fitur yang sudah ada, dan mekanisme kerja web admin.

## 1. Teknologi Utama

- `Next.js 14` dengan `App Router`
- `TypeScript`
- `Tailwind CSS`
- `Supabase`
  - Auth untuk login admin
  - Postgres untuk data utama
  - Storage untuk file gambar tema

## 2. Isi Folder

### `app/`

Berisi halaman frontend dan API route.

- `app/login/page.tsx`
  - Halaman login admin.
- `app/dashboard/page.tsx`
  - Ringkasan statistik utama.
- `app/orders/page.tsx`
  - Manajemen pesanan.
- `app/codes/page.tsx`
  - Import/export kode pesanan.
- `app/live-sessions/page.tsx`
  - Kelola sesi live untuk paket RL/SL.
- `app/themes/page.tsx`
  - Kelola tema.
  - Sudah mendukung label `Boy/Girl`.
  - Sudah mendukung upload foto tema dari file lokal ke Supabase Storage.
  - Aturan foto tema: minimal `1`, maksimal `3`.
- `app/master-data/page.tsx`
  - Kelola hair styles, eyeglasses, character assets, dan admin validation codes.
- `app/api/admin/*`
  - API khusus admin.
- `app/api/customer/*`
  - API untuk form customer.

### `components/`

Komponen UI reusable.

- `AdminShell.tsx`
  - Layout utama admin panel.
  - Sudah responsive untuk mobile.
- `Sidebar.tsx`
  - Navigasi samping.
- `PageHeader.tsx`
  - Header per halaman.
- `ConfirmDialog.tsx`
  - Dialog konfirmasi aksi penting.
- `Toast.tsx`
  - Notifikasi singkat.

### `lib/`

Helper dan utilitas aplikasi.

- `auth.ts`
  - Guard login admin untuk API route.
- `admin-access.ts`
  - Menentukan apakah user benar-benar admin.
  - Menggunakan `ADMIN_EMAILS` atau metadata role admin.
- `constants.ts`
  - Konstanta paket, status, gender, dan label UI.
- `sanitize.ts`
  - Sanitasi input user.
- `order-id.ts`
  - Generator `public_order_id`.
- `supabase-admin.ts`
  - Client Supabase server-side dengan service role key.
- `supabase-browser.ts`
  - Client Supabase browser-side.
- `theme-images.ts`
  - Helper sinkronisasi galeri foto tema ke database dan Storage.

### `supabase/`

- `schema.sql`
  - Schema database utama.
  - Sekarang juga mencakup tabel `theme_images` untuk galeri tema.

## 3. Mekanisme Login dan Akses Admin

1. User login lewat Supabase Auth.
2. Session dibaca lewat cookie pada middleware dan API route.
3. Akses admin divalidasi oleh:
   - email yang ada di `ADMIN_EMAILS`, atau
   - metadata role `admin`
4. Jika bukan admin:
   - halaman admin akan ditolak
   - API admin akan return `403`

File utama:

- `middleware.ts`
- `lib/auth.ts`
- `lib/admin-access.ts`

## 4. Mekanisme Halaman Tema

### Data Tema

Tema utama disimpan di tabel:

- `themes`
- `theme_package_codes`
- `theme_images`

### Foto Tema

Foto tema sekarang memakai alur berikut:

1. Admin isi `Theme Code`.
2. Admin klik `Browse Foto`.
3. File lokal dipilih manual dari penyimpanan komputer.
4. File diupload ke bucket Supabase Storage `theme-previews`.
5. URL publik hasil upload disimpan.
6. Saat tema disimpan:
   - foto pertama menjadi `image_url` utama di tabel `themes`
   - semua foto disimpan ke tabel `theme_images`

Aturan:

- minimal `1` foto
- maksimal `3` foto
- urutan foto dijaga dari urutan di form
- foto yang dibuang dari draft akan dibersihkan dari Storage

File utama:

- `app/themes/page.tsx`
- `app/api/admin/themes/images/route.ts`
- `app/api/admin/themes/create/route.ts`
- `app/api/admin/themes/update/route.ts`
- `app/api/admin/themes/list/route.ts`
- `lib/theme-images.ts`

## 5. Mekanisme Kode Pesanan

Halaman `Kode Pesanan` dipakai untuk:

- import CSV/JSON
- filter dan pencarian kode
- export kode
- expire kode

Mekanisme import:

1. Admin pilih paket.
2. Admin pilih file CSV/JSON.
3. Frontend parse file.
4. API validasi prefix paket, regex kode, duplikat file, dan duplikat database.
5. Data valid masuk ke tabel `order_codes`.

Catatan:

- paket `RL` dan `SL` wajib terkait `live_session`
- jika tabel belum ada di Supabase, import pasti gagal

File utama:

- `app/codes/page.tsx`
- `app/api/admin/codes/import/route.ts`
- `app/api/admin/codes/list/route.ts`

## 6. Mekanisme Customer API

### `POST /api/customer/validate-code`

Tugas:

- validasi kode awal
- cek status kode
- cek live session
- tangani brute force protection
- dukung admin validation code saat customer sudah diblokir

### `POST /api/customer/submit-order`

Tugas:

- validasi semua input customer
- validasi tema, hair, glasses, asset
- submit order secara atomic
- ubah kode dari `unused` menjadi `used`

File utama:

- `app/api/customer/validate-code/route.ts`
- `app/api/customer/submit-order/route.ts`
- fungsi SQL `submit_order_atomic` di `supabase/schema.sql`

## 7. Mekanisme Master Data

Halaman `Master Data` mengelola:

- Hair Styles
- Eyeglasses
- Character Assets
- Admin Validation Codes

Semua CRUD dasar lewat:

- `app/master-data/page.tsx`
- `app/api/admin/master-data/route.ts`

Label gender pada halaman ini sudah disesuaikan menjadi:

- `Boy`
- `Girl`

## 8. Dukungan Mobile

Admin panel sudah punya dukungan mobile dasar:

- sidebar berubah menjadi menu mobile
- header lebih fleksibel
- dialog dan toast responsive
- halaman tema dan master data tetap bisa dibuka di layar kecil

Catatan:

- tabel data besar masih memakai scroll horizontal
- mobile sudah layak dipakai, tapi tetap idealnya dites manual per halaman

## 9. Environment Variables

File `.env.local` minimal perlu:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_EMAILS=admin@example.com
```

## 10. Hal Penting Setelah Update Terbaru

Karena sekarang ada fitur galeri foto tema, database harus punya tabel `theme_images`.

Langkah aman:

1. Buka Supabase SQL Editor.
2. Jalankan ulang isi `supabase/schema.sql`.

Kenapa aman:

- file schema memakai `CREATE TABLE IF NOT EXISTS`
- jadi tabel lama tidak dibikin ulang
- tabel baru `theme_images` akan ikut dibuat jika belum ada

## 11. Kondisi Saat Ini

Yang sudah selesai:

- akses admin lebih aman
- anti brute force lebih rapi
- layout mobile admin lebih baik
- label gender `Boy/Girl` sudah dirapikan di UI admin
- upload foto tema dari file lokal ke Supabase Storage sudah dibuat
- galeri tema 1-3 foto sudah dibuat
- dokumentasi ringkasan proyek ini sudah tersedia

Yang masih perlu diperhatikan saat testing:

- jalankan ulang `schema.sql` supaya `theme_images` tersedia
- pastikan bucket `theme-previews` bisa dibuat/diakses oleh service role
- tes upload foto tema langsung dari browser setelah migration selesai
