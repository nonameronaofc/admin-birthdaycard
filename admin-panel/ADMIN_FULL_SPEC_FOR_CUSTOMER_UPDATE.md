# Admin Full Spec For Customer Update

Dokumen ini adalah spesifikasi lengkap web admin yang dipakai sebagai acuan untuk mengupdate web customer. Isi dokumen ini merangkum struktur sistem, rule bisnis, data contract, schema, endpoint, alur utama, dan perubahan terbaru yang harus sinkron antara admin dan customer.

Workspace:

```text
C:\Users\Haidar Ali\Documents\admin-panel
```

Stack:

- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- Supabase Auth
- Supabase Postgres
- Supabase Storage

Dokumen ini fokus pada:

1. Apa yang ada di web admin sekarang.
2. Rule bisnis yang dipakai backend admin/customer.
3. Kontrak data yang harus diikuti web customer.
4. Perubahan terbaru yang harus sinkron.

---

## 1. Tujuan Sistem

Sistem ini dipakai untuk bisnis pemesanan video ulang tahun custom.

Ada 2 aplikasi:

1. **Web Admin**
   Dipakai internal untuk mengelola order, kode pesanan, live session, tema, dan character asset.

2. **Web Customer**
   Dipakai customer untuk validasi kode, memilih tema, mengisi data order, memilih character, dan submit order.

Web customer bergantung pada backend contract yang ada di project admin ini, terutama:

```text
POST /api/customer/validate-code
POST /api/customer/submit-order
```

---

## 2. Struktur Modul Admin

Halaman admin utama:

```text
/login
/dashboard
/orders
/codes
/live-sessions
/themes
/master-data
```

Komponen UI utama:

```text
components/AdminShell.tsx
components/Sidebar.tsx
components/PageHeader.tsx
components/ConfirmDialog.tsx
components/Toast.tsx
```

Sidebar admin:

```text
Dashboard
Pesanan
Kode Pesanan
Live Sessions
Tema
Master Data
Logout
```

---

## 3. Auth Dan Akses Admin

Login admin memakai Supabase Auth.

Akses admin divalidasi dari:

1. email yang ada di `ADMIN_EMAILS`, atau
2. metadata role admin.

File terkait:

```text
middleware.ts
lib/auth.ts
lib/admin-access.ts
lib/supabase-browser.ts
lib/supabase-admin.ts
```

Environment minimal:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_EMAILS=admin@example.com
```

Aturan:

- Route admin harus login.
- API admin harus lolos `requireAdmin()`.
- Service role hanya untuk server-side.
- Browser hanya pakai anon key.

---

## 4. Package Code

Package code valid:

```text
HM = Hemat
RG = Reguler
ST = Sultan
RL = Reguler Live
SL = Sultan Live
```

Group:

```text
Normal = HM, RG, ST
Live   = RL, SL
```

Regex order code:

```text
^(HM|RG|ST|RL|SL)[A-Z0-9+!%&]{7}[A-Z0-9]$
```

Aturan:

- `RL` dan `SL` wajib punya live session.
- `HM`, `RG`, `ST` tidak boleh punya live session.

File konstanta:

```text
lib/constants.ts
```

---

## 5. Dashboard

Route:

```text
/dashboard
app/dashboard/page.tsx
app/api/admin/dashboard/route.ts
```

Yang ditampilkan saat ini:

- Order hari ini
- Order bulan ini
- Order normal
- Order live
- Pending
- Processing
- Completed
- Cancelled
- Unused codes
- Used codes
- Expired codes
- Live session aktif

Catatan:

- Belum ada pendapatan / revenue.
- Belum ada field nominal order di schema.

Kalau web customer nanti punya harga package atau payment logic, itu belum tercermin di dashboard admin saat ini.

---

## 6. Orders

Route:

```text
/orders
app/orders/page.tsx
```

API:

```text
app/api/admin/orders/list/route.ts
app/api/admin/orders/detail/route.ts
app/api/admin/orders/cancel/route.ts
app/api/admin/orders/export/route.ts
```

Fitur:

- List order
- Filter status
- Filter package
- Filter download status
- Search order
- Pagination
- Cancel order
- Export harian CSV/JSON

State order:

```text
pending
processing
completed
cancelled
```

State download:

```text
not_downloaded
downloaded
```

Rule:

- Cancel order mengubah status menjadi `cancelled`.
- Kode pesanan tetap `used`, tidak reusable.
- Export harian menandai order sebagai `downloaded`.

Tabel utama:

```text
orders
export_logs
```

---

## 7. Codes

Route:

```text
/codes
app/codes/page.tsx
```

API:

```text
app/api/admin/codes/list/route.ts
app/api/admin/codes/import/route.ts
app/api/admin/codes/expire/route.ts
app/api/admin/codes/export/route.ts
```

Fitur:

- Import kode dari CSV/JSON
- Assign package code saat import
- Assign live session untuk package live
- Filter status
- Filter package
- Search kode
- Expire satu kode atau banyak kode
- Export list kode ke CSV/JSON

Status kode:

```text
unused
used
expired
```

Rule:

- Admin panel **tidak generate kode sendiri**.
- Kode dibuat di app lain lalu diimport ke admin.
- `RL/SL` harus dipasangkan dengan live session aktif saat import.
- `Expire` bersifat irreversible.

Tabel:

```text
order_codes
live_sessions
```

---

## 8. Live Sessions

Route:

```text
/live-sessions
app/live-sessions/page.tsx
```

API:

```text
app/api/admin/live-sessions/list/route.ts
app/api/admin/live-sessions/create/route.ts
app/api/admin/live-sessions/close/route.ts
app/api/admin/live-sessions/cancel/route.ts
```

Fitur:

- Buat sesi live
- Filter status
- Lihat statistik kode per sesi
- Close sesi
- Cancel sesi
- Export order per sesi

Status sesi:

```text
active
closed
cancelled
```

Rule:

- Kode `RL/SL` hanya bisa dipakai kalau session `active`.
- Kalau session `closed` atau `cancelled`, kode yang belum dipakai tidak valid lagi.
- Order yang sudah masuk tetap aman.

Tabel:

```text
live_sessions
order_codes
orders
```

---

## 9. Themes

Route:

```text
/themes
app/themes/page.tsx
```

API:

```text
app/api/admin/themes/list/route.ts
app/api/admin/themes/create/route.ts
app/api/admin/themes/update/route.ts
app/api/admin/themes/deactivate/route.ts
app/api/admin/themes/images/route.ts
```

Helper:

```text
lib/theme-images.ts
```

Fitur:

- Create theme
- Edit theme
- Activate/deactivate theme
- Filter gender
- Filter parents content
- Filter status
- Search
- Upload theme image dari file lokal
- Theme gallery 1-3 image

Field penting theme:

```text
theme_code
name
gender
parents_content
requires_parents_nickname
requires_parents_sweetname
image_url
is_active
```

Package availability theme:

```text
theme_package_codes
```

Foto theme:

- minimal 1
- maksimal 3
- foto pertama jadi `image_url` utama
- semua foto tersimpan di `theme_images`

Bucket:

```text
theme-previews
```

Rule yang harus sinkron ke customer:

- Theme hanya boleh tampil jika `is_active = true`
- Theme harus cocok dengan `character_gender`
- Theme harus cocok dengan `parents_content`
- Theme harus tersedia untuk package yang valid dari order code

---

## 10. Master Data Final

Route:

```text
/master-data
app/master-data/page.tsx
app/api/admin/master-data/route.ts
```

Perubahan terbaru:

Master Data sekarang hanya fokus ke:

```text
Character Assets
```

Yang sudah tidak dipakai di UI Master Data:

```text
Hair Styles
Eyeglasses
Admin Validation
```

Artinya:

- Tidak ada CRUD hair styles
- Tidak ada CRUD eyeglasses
- Tidak ada input manual admin validation dari UI ini

---

## 11. Character Assets Final

Character asset adalah gambar final karakter berdasarkan kombinasi:

```text
gender + hair_style_code + eyeglasses_code
```

Hair code bersifat statis:

```text
HA sampai HZ
```

Eyeglasses code bersifat statis:

```text
EA sampai EZ
```

Asset code otomatis:

```text
{GENDER_UPPER}-{HAIR_CODE}-{EYEGLASSES_CODE}
```

Contoh:

```text
GIRL-HA-EA
GIRL-HA-EB
BOY-HA-EA
BOY-HC-EZ
```

Default customer:

```text
Girl default = GIRL-HA-EA
Boy default  = BOY-HA-EA
```

---

## 12. Character Asset Admin Flow

Alur admin:

1. Buka Master Data.
2. Pilih gender `Boy/Girl`.
3. Pilih hair code `HA-HZ`.
4. Pilih eyeglasses code `EA-EZ`.
5. Sistem membuat asset code otomatis.
6. Admin klik `Upload Image`.
7. File diupload ke Supabase Storage.
8. `image_url` otomatis dihasilkan dari upload, admin **tidak input manual**.
9. Admin klik `Submit Asset`.
10. Asset masuk ke tabel list.

Penting:

- `Image URL` bukan input manual lagi.
- URL tetap disimpan ke database, tapi sumbernya dari upload.
- Asset dipanggil/logically dihubungkan berdasarkan `asset_code`.

Conflict asset code:

Kalau admin submit asset code yang sudah ada:

- Muncul dialog:
  - `Upload Ulang`
  - `Kembali`

Arti:

- `Upload Ulang` = overwrite/update asset existing.
- `Kembali` = batal submit, jangan ubah data lama.

Tabel asset:

- thumbnail
- asset code
- gender
- hair code
- eyeglasses code
- uploaded date
- status aktif/nonaktif
- edit foto
- aktif/nonaktif
- filter gender
- filter status
- search asset code
- sort uploaded date

---

## 13. Character Asset Schema

Schema final `character_assets`:

```sql
CREATE TABLE IF NOT EXISTS character_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_code text UNIQUE NOT NULL,
  gender text NOT NULL CHECK (gender IN ('boy', 'girl')),
  hair_style_code text NOT NULL CHECK (hair_style_code ~ '^H[A-Z]$'),
  eyeglasses_code text NOT NULL CHECK (eyeglasses_code ~ '^E[A-Z]$'),
  image_url text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

Constraint tambahan:

```sql
UNIQUE (gender, hair_style_code, eyeglasses_code)
```

Migration note:

Schema lama masih memakai:

```text
hair_style_id
eyeglasses_id
```

Schema baru tidak lagi memakai dua kolom itu.

File migration:

```text
supabase/schema.sql
```

Kalau Supabase belum menjalankan schema terbaru, admin bisa error saat read/write asset baru.

---

## 14. Character Asset Upload

Upload route:

```text
POST /api/admin/character-assets/image
```

Input:

```text
FormData:
- asset_code
- file
```

Output sukses:

```json
{
  "data": {
    "image_url": "https://...",
    "storage_path": "characters/BOY-HA-EA/..."
  }
}
```

Supported MIME:

```text
image/jpeg
image/png
image/webp
image/gif
```

Bucket:

```text
character-assets
```

Catatan:

- Storage path dibuat dari asset code.
- Admin tidak perlu copy/paste URL.
- Hasil upload langsung menghasilkan `image_url`.

---

## 15. API Admin Master Data

Route:

```text
/api/admin/master-data
```

Resource valid:

```text
character_assets
```

### GET

Request:

```text
GET /api/admin/master-data?resource=character_assets
```

Response sukses:

```json
{
  "data": [
    {
      "id": "uuid",
      "asset_code": "BOY-HA-EA",
      "gender": "boy",
      "hair_style_code": "HA",
      "eyeglasses_code": "EA",
      "image_url": "https://...",
      "is_active": true,
      "created_at": "2026-04-28T...",
      "updated_at": "2026-04-28T..."
    }
  ]
}
```

### POST create

Request:

```json
{
  "resource": "character_assets",
  "values": {
    "asset_code": "BOY-HA-EA",
    "gender": "boy",
    "hair_style_code": "HA",
    "eyeglasses_code": "EA",
    "image_url": "https://...",
    "is_active": true
  }
}
```

Validasi:

- gender harus `boy/girl`
- hair harus `HA-HZ`
- eyeglasses harus `EA-EZ`
- asset code harus match kombinasi
- image_url wajib

Kalau asset code sudah ada:

```json
{
  "error": "Asset code sudah ada.",
  "conflict": {
    "id": "uuid",
    "asset_code": "BOY-HA-EA"
  }
}
```

HTTP status:

```text
409
```

### PATCH update

Request:

```json
{
  "resource": "character_assets",
  "id": "uuid",
  "values": {
    "asset_code": "BOY-HA-EA",
    "gender": "boy",
    "hair_style_code": "HA",
    "eyeglasses_code": "EA",
    "image_url": "https://...",
    "is_active": true
  }
}
```

Dipakai untuk:

- upload ulang
- ganti foto
- edit asset existing

### PATCH toggle status

Deactivate:

```json
{
  "resource": "character_assets",
  "id": "uuid",
  "action": "deactivate"
}
```

Reactivate:

```json
{
  "resource": "character_assets",
  "id": "uuid",
  "action": "reactivate"
}
```

---

## 16. Customer Validate-Code API

Route:

```text
POST /api/customer/validate-code
```

File:

```text
app/api/customer/validate-code/route.ts
```

Fungsi:

- validasi format order code
- cek kode ada/tidak
- cek status code
- cek live session bila package live
- anti brute force
- jika valid, kembalikan package info

Request:

```json
{
  "code": "HMABC1234",
  "device_key": "optional-device-fingerprint",
  "admin_validation_code": "optional"
}
```

Response sukses:

```json
{
  "valid": true,
  "package_code": "HM",
  "package_label": "Hemat",
  "live_session_id": null,
  "live_session_name": null
}
```

Response sukses package live:

```json
{
  "valid": true,
  "package_code": "RL",
  "package_label": "Reguler Live",
  "live_session_id": "uuid",
  "live_session_name": "Live Session 1"
}
```

Error umum:

```json
{ "error": "Kode pesanan kosong." }
{ "error": "Format kode tidak valid." }
{ "error": "Kode pesanan tidak ditemukan." }
{ "error": "Kode ini sudah digunakan." }
{ "error": "Kode ini sudah tidak berlaku. Silakan hubungi admin untuk mendapatkan kode baru." }
{ "error": "Live session sudah ditutup. Kode tidak bisa digunakan lagi." }
```

Anti brute force:

- Maksimal gagal: 5 kali
- Block: 30 menit
- Identitas based on IP + optional device key

Response kalau butuh admin validation:

```json
{
  "need_admin_validation": true,
  "error": "Anda telah mencapai batas percobaan. Hubungi admin untuk Kode Validasi Admin."
}
```

Catatan:

Meskipun UI Master Data tidak lagi menampilkan Admin Validation, backend validate-code masih mengandalkan tabel `admin_validation_codes`.

---

## 17. Customer Submit-Order API

Route:

```text
POST /api/customer/submit-order
```

File:

```text
app/api/customer/submit-order/route.ts
```

Fungsi:

- validasi semua input
- validasi order code
- validasi theme
- validasi requirement parent field
- validasi character asset aktif
- submit order atomic

Request contoh:

```json
{
  "order_code": "HMABC1234",
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
  "mom_sweetname": "Mama",
  "dad_sweetname": "Papa",
  "special_notes": "Catatan khusus",
  "pronunciation_note": "Aira dibaca AI-RA"
}
```

Validasi field utama:

- `order_code` -> regex package code
- `theme_code` -> wajib
- `nama_pemesan` -> wajib
- `whatsapp_full` -> digit 8-15
- `nickname_anak` -> wajib
- `nama_lengkap_anak` -> wajib
- `usia_anak` -> wajib
- `character_gender` -> `boy/girl`
- `tanggal_acara` -> `YYYY-MM-DD`
- `deadline_dibutuhkan` -> `YYYY-MM-DD`
- `birthday_number` -> `1-10`
- `hair_style_code` -> `HA-HZ`
- `eyeglasses_code` -> `EA-EZ`
- `parents_content` -> valid enum

Validasi theme:

- theme harus ada
- theme harus `is_active = true`
- `theme.gender === character_gender`
- `theme.parents_content === parents_content`
- package customer harus tersedia di `theme_package_codes`

Validasi parent fields:

Kalau theme butuh nickname:

- `single_mom` -> wajib `mom_nickname`
- `single_father` -> wajib `dad_nickname`
- `mom_and_dad` -> wajib `mom_nickname` dan `dad_nickname`

Kalau theme butuh sweetname:

- `single_mom` -> wajib `mom_sweetname`
- `single_father` -> wajib `dad_sweetname`
- `mom_and_dad` -> wajib `mom_sweetname` dan `dad_sweetname`

Validasi character asset:

API mencari:

```text
gender = character_gender
hair_style_code = hair_style_code
eyeglasses_code = eyeglasses_code
is_active = true
```

Kalau tidak ada:

```json
{
  "error": "Kombinasi character asset (gender + hair + glasses) tidak tersedia."
}
```

Response sukses:

```json
{
  "ok": true,
  "public_order_id": "HM-20260428-..."
}
```

---

## 18. Order Snapshot

Saat submit order berhasil, backend menyimpan snapshot data ke tabel `orders`.

Field snapshot penting:

```text
package_code
package_label
live_session_name
theme_code
theme_name
character_gender
hair_style_code
hair_style_name
eyeglasses_code
eyeglasses_name
character_asset_code
parents_content
requires_parents_nickname
requires_parents_sweetname
mom_nickname
dad_nickname
mom_sweetname
dad_sweetname
special_notes
pronunciation_note
```

Karena hair/eyeglasses sekarang statis, `hair_style_name` dan `eyeglasses_name` saat ini sama dengan kodenya:

```text
hair_style_name = HA
eyeglasses_name = EA
```

---

## 19. Atomic Submit Order

Stored function:

```text
submit_order_atomic(p_order_data jsonb)
```

Tujuan:

- mencegah double submit
- mencegah satu kode dipakai lebih dari sekali
- update order + code status dalam satu transaksi

Langkah:

1. Lock order code dengan `FOR UPDATE`
2. Pastikan code ada
3. Pastikan status `unused`
4. Jika live package, cek session active
5. Insert order
6. Update code jadi `used`
7. Return `public_order_id`

---

## 20. Database Tables

Tabel penting:

```text
live_sessions
order_codes
themes
theme_package_codes
theme_images
character_assets
orders
code_attempts
admin_validation_codes
export_logs
```

Catatan:

- `hair_styles` dan `eyeglasses` tidak lagi dipakai dalam alur final customer-admin.
- `character_assets` sekarang menyimpan kode langsung.

File schema:

```text
supabase/schema.sql
```

---

## 21. Supabase Storage

Bucket yang dipakai:

```text
theme-previews
character-assets
```

`theme-previews`:

- untuk galeri tema
- 1-3 image per theme

`character-assets`:

- untuk final image asset karakter
- satu image per kombinasi asset code

---

## 22. Data Contract Yang Harus Sinkron Dengan Customer

Web customer harus mengikuti kontrak ini:

1. Package codes:
   `HM`, `RG`, `ST`, `RL`, `SL`

2. Gender API:
   `boy`, `girl`

3. Hair style code:
   `HA-HZ`

4. Eyeglasses code:
   `EA-EZ`

5. Asset code format:
   `GENDER_UPPER-HAIR-EYEGLASSES`

6. Default assets:
   - girl -> `GIRL-HA-EA`
   - boy -> `BOY-HA-EA`

7. Customer tidak boleh pakai `hair_style_id`

8. Customer tidak boleh pakai `eyeglasses_id`

9. Customer submit harus kirim:
   - `hair_style_code`
   - `eyeglasses_code`

10. Customer theme filter harus cocok dengan:
   - package
   - gender
   - parents content
   - active state

11. Customer character asset harus cocok dengan:
   - gender
   - hair code
   - eyeglasses code
   - active state

12. Customer harus siap menerima `need_admin_validation` dari `validate-code`

---

## 23. Error Cases Yang Harus Ditangani Customer

Customer web harus siap menangani:

- kode kosong
- format kode invalid
- kode tidak ditemukan
- kode sudah used
- kode expired
- live session closed/cancelled
- tema tidak ditemukan / nonaktif
- gender tema tidak cocok
- parents content tidak cocok
- tema tidak tersedia untuk package
- field parent nickname/sweetname wajib
- hair style bukan `HA-HZ`
- eyeglasses bukan `EA-EZ`
- asset kombinasi tidak tersedia
- gagal submit order atomic

Jika customer UI punya error mapping sendiri, isinya tetap harus sinkron dengan logic backend ini.

---

## 24. Hal Yang Belum Ada

Belum ada:

- live revenue / pendapatan
- payment status
- amount paid / order total

Artinya:

- customer bisa punya logic harga sendiri, tapi admin saat ini belum menyimpan nominalnya
- dashboard admin belum bisa menghitung pendapatan real

Kalau customer nanti pakai payment layer, schema admin perlu diperluas.

---

## 25. Yang Wajib Dilakukan Setelah Perubahan Terbaru

Karena `character_assets` sudah berubah schema:

1. Jalankan ulang [schema.sql](</C:/Users/Haidar Ali/Documents/admin-panel/supabase/schema.sql>) di Supabase SQL Editor.
2. Pastikan kolom berikut ada di tabel `character_assets`:
   - `hair_style_code`
   - `eyeglasses_code`
3. Pastikan kolom lama `hair_style_id` dan `eyeglasses_id` tidak lagi jadi acuan logic.
4. Pastikan bucket `character-assets` tersedia.
5. Refresh admin panel.

Tanpa migration ini, admin terbaru dan customer terbaru tidak akan sinkron penuh.

---

## 26. File Rujukan Utama

File yang menjadi referensi utama:

```text
app/master-data/page.tsx
app/api/admin/master-data/route.ts
app/api/admin/character-assets/image/route.ts
app/api/customer/validate-code/route.ts
app/api/customer/submit-order/route.ts
app/themes/page.tsx
app/orders/page.tsx
app/codes/page.tsx
app/live-sessions/page.tsx
lib/constants.ts
lib/theme-images.ts
lib/character-assets.ts
supabase/schema.sql
```

---

## 27. Checklist Crosscheck Dengan Web Customer

Gunakan checklist ini saat mengupdate web customer:

1. Customer pakai package codes yang sama.
2. Customer pakai gender `boy/girl`, bukan format lain.
3. Customer hair selector hanya `HA-HZ`.
4. Customer eyeglasses selector hanya `EA-EZ`.
5. Customer default girl `GIRL-HA-EA`.
6. Customer default boy `BOY-HA-EA`.
7. Customer tidak lagi memakai data `hair_styles`.
8. Customer tidak lagi memakai data `eyeglasses`.
9. Customer mencari asset dari `character_assets`.
10. Customer hanya menerima asset `is_active = true`.
11. Customer kirim `hair_style_code`, bukan id.
12. Customer kirim `eyeglasses_code`, bukan id.
13. Customer submit tetap valid kalau theme dan asset aktif.
14. Customer tampilkan error jika asset tidak tersedia.
15. Customer validate code dulu sebelum submit.
16. Customer live flow mengikuti `live_session_id` dari validate-code.
17. Customer parent field logic sesuai requirement theme.
18. Customer siap kalau backend masih mengembalikan `need_admin_validation`.
19. Kalau customer punya preview asset, preview harus berdasarkan `asset_code` atau kombinasi gender+hair+eyeglasses yang map ke `image_url`.
20. Jika customer punya harga/pembayaran, sinkronisasi berikutnya perlu schema baru di admin.

