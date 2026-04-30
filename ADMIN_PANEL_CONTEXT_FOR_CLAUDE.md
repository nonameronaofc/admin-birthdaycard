# Admin Panel Birthday Video - Full Context For Claude

Dokumen ini dibuat sebagai bahan prompt/context lengkap untuk Claude agar memahami web admin yang sedang dibangun, alur bisnisnya, struktur teknisnya, kondisi implementasi saat ini, dan arah end product yang diinginkan.

Project path lokal:

```text
C:\Users\Haidar Ali\Documents\admin-panel
```

Stack utama:

- Next.js 14 App Router
- TypeScript
- React 18
- Tailwind CSS
- Supabase Auth
- Supabase Postgres
- Supabase Storage

Tujuan produk:

Admin panel ini dipakai untuk mengelola bisnis pemesanan video ulang tahun custom. Customer akan mengisi form di web customer terpisah, memakai kode pesanan, memilih tema, memilih karakter, lalu order masuk ke admin panel. Admin memakai panel ini untuk melihat order, mengelola kode pesanan, live session, tema video, dan character asset.

---

## 1. Ringkasan End Product

End product yang diinginkan adalah admin panel internal untuk:

1. Login admin secara aman memakai Supabase Auth.
2. Melihat dashboard ringkas untuk order dan kode pesanan.
3. Mengelola order customer.
4. Mengelola kode pesanan berdasarkan paket.
5. Mengelola live session untuk paket live.
6. Mengelola tema video beserta foto preview.
7. Mengelola character assets final yang dipakai customer.
8. Menyediakan API customer untuk validasi kode dan submit order.

Admin panel bukan customer-facing website. Web customer akan memakai endpoint API di project ini, atau minimal mengikuti struktur data yang sama.

---

## 2. Paket Produk

Ada 5 package code:

```text
HM = Hemat
RG = Reguler
ST = Sultan
RL = Reguler Live
SL = Sultan Live
```

Package normal:

```text
HM, RG, ST
```

Package live:

```text
RL, SL
```

Paket live wajib terhubung dengan `live_session_id`. Paket normal tidak boleh punya `live_session_id`.

Order code memakai regex:

```text
^(HM|RG|ST|RL|SL)[A-Z0-9+!%&]{7}[A-Z0-9]$
```

Artinya kode diawali prefix package, lalu karakter unik sesuai aturan.

---

## 3. Auth Dan Akses Admin

Login admin memakai Supabase Auth.

File penting:

```text
middleware.ts
lib/auth.ts
lib/admin-access.ts
lib/supabase-browser.ts
lib/supabase-admin.ts
```

Cara menentukan admin:

1. Email user ada di environment variable `ADMIN_EMAILS`, atau
2. User punya metadata role admin.

Environment minimal:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_EMAILS=admin@example.com
```

Catatan implementasi:

- `middleware.ts` melindungi route admin.
- API admin memanggil `requireAdmin()`.
- Supabase service role hanya dipakai server-side.
- Client browser hanya memakai anon key.
- Ada guard agar Supabase config yang belum siap tidak berubah menjadi server error mentah.

---

## 4. Struktur UI Admin

Layout admin:

```text
components/AdminShell.tsx
components/Sidebar.tsx
components/PageHeader.tsx
components/ConfirmDialog.tsx
components/Toast.tsx
```

Navigasi sidebar saat ini:

```text
Dashboard
Pesanan
Kode Pesanan
Live Sessions
Tema
Master Data
Logout
```

Desain UI:

- Admin surface sederhana, terang, dan operasional.
- Sidebar kiri untuk navigasi.
- Halaman utama di kanan.
- Form memakai card.
- Tabel memakai scroll horizontal untuk data besar.
- Aksi penting memakai confirmation dialog.
- Feedback memakai toast.

---

## 5. Dashboard

Route:

```text
/dashboard
app/dashboard/page.tsx
app/api/admin/dashboard/route.ts
```

Dashboard saat ini menampilkan statistik:

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

API dashboard menghitung count dari tabel:

```text
orders
order_codes
live_sessions
```

Belum ada live revenue/pendapatan. Jika ingin fitur pendapatan, schema perlu sumber nominal, misalnya:

- `order_total`
- `amount_paid`
- atau mapping harga package secara statis.

Rekomendasi bisnis:

Gunakan kolom nominal asli di `orders`, misalnya `order_total` atau `amount_paid`, supaya pendapatan bukan estimasi.

---

## 6. Manajemen Pesanan

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

Fungsi:

- Melihat daftar order.
- Filter order.
- Pagination.
- Melihat detail order.
- Cancel order.
- Export order harian CSV/JSON.

Tabel utama:

```text
orders
export_logs
```

Status order:

```text
pending
processing
completed
cancelled
```

Download status:

```text
not_downloaded
downloaded
```

Order menyimpan snapshot data saat customer submit, agar perubahan tema/master data di masa depan tidak merusak order lama.

Snapshot yang disimpan antara lain:

- package code dan label
- live session name
- theme code dan name
- data pemesan
- data anak
- character gender
- hair style code/name
- eyeglasses code/name
- character asset code
- parent content requirements
- special notes

---

## 7. Manajemen Kode Pesanan

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

Fungsi:

- Import kode dari CSV/JSON.
- Validasi format kode.
- Validasi package prefix.
- Cek duplikat dalam file.
- Cek duplikat database.
- Filter dan cari kode.
- Expire kode.
- Export kode.

Tabel:

```text
order_codes
```

Kolom penting:

```text
code
package_code
status
live_session_id
used_at
created_at
updated_at
```

Status kode:

```text
unused
used
expired
```

Aturan:

- `HM`, `RG`, `ST` tidak boleh punya live session.
- `RL`, `SL` wajib punya live session.

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

Fungsi:

- Membuat live session.
- Melihat session aktif/closed/cancelled.
- Close session.
- Cancel session.
- Melihat statistik kode per session.

Tabel:

```text
live_sessions
order_codes
orders
```

Status live session:

```text
active
closed
cancelled
```

Aturan:

- Kode paket `RL` dan `SL` harus terkait session.
- Submit order live hanya boleh jika session masih `active`.
- Jika session sudah closed/cancelled, kode live tidak bisa dipakai customer.

---

## 9. Manajemen Tema

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

Fungsi:

- Membuat tema.
- Edit tema.
- Aktif/nonaktifkan tema.
- Filter tema berdasarkan gender, parents content, status, dan search.
- Upload foto tema langsung dari file lokal ke Supabase Storage.
- Tema bisa punya 1 sampai 3 foto.
- Foto pertama menjadi foto utama.

Tabel:

```text
themes
theme_package_codes
theme_images
```

Bucket storage:

```text
theme-previews
```

Field tema:

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

Parents content:

```text
none
single_mom
single_father
mom_and_dad
```

Aturan foto:

- Minimal 1 foto.
- Maksimal 3 foto.
- File supported: jpg, png, webp, gif.
- Upload akan masuk ke Supabase Storage.
- URL publik disimpan ke database.
- Draft upload yang dibatalkan dibersihkan best-effort.

---

## 10. Master Data - Kondisi Implementasi Saat Ini

Route:

```text
/master-data
app/master-data/page.tsx
app/api/admin/master-data/route.ts
```

Saat ini implementasi di repo masih berisi beberapa tab:

```text
Hair Styles
Eyeglasses
Character Assets
Admin Validation
```

Tabel terkait:

```text
hair_styles
eyeglasses
character_assets
admin_validation_codes
```

Implementasi terbaru sempat menambahkan:

- Editor visual untuk Character Assets.
- Upload image character asset ke Supabase Storage bucket `character-assets`.
- Helper bucket di `lib/character-assets.ts`.
- API upload di `app/api/admin/character-assets/image/route.ts`.
- Validasi backend agar kombinasi character asset tidak dobel.

Namun ini belum sepenuhnya sesuai dengan arah final yang disepakati, karena schema lama masih memakai relasi:

```text
character_assets.hair_style_id -> hair_styles.id
character_assets.eyeglasses_id -> eyeglasses.id
```

Sedangkan arah final baru tidak membutuhkan tabel hair/eyeglasses sebagai master dinamis.

---

## 11. Master Data - Arah Final Yang Disepakati

Master Data final hanya perlu fokus pada:

```text
Character Assets
```

Tidak perlu lagi:

```text
Hair Styles
Eyeglasses
Admin Validation
```

Yang harus dihilangkan dari UI:

- Tab `Hair Styles`
- Tab `Eyeglasses`
- Tab `Admin Validation`
- Form tambah/edit hair style
- Form tambah/edit eyeglasses
- Form/list admin validation

Master Data final terdiri dari dua bagian:

1. Character Asset Editor.
2. Tabel list asset character.

### Character Asset Editor Final

Input editor:

```text
Gender: BOY/GIRL
Hair Style: HA-HZ
Eyeglasses: EA-EZ
Asset Code: auto-generated
Image Upload: file upload
Preview: image besar
Submit
```

Dropdown hair style bersifat statis:

```text
HA, HB, HC, ..., HZ
```

Dropdown eyeglasses bersifat statis:

```text
EA, EB, EC, ..., EZ
```

Asset code otomatis:

```text
BOY-HA-EA
BOY-HA-EB
GIRL-HA-EA
GIRL-HC-EZ
```

Yang menjadi patokan submit adalah `asset_code`.

Contoh alur:

1. Admin pilih `Gender = BOY`.
2. Admin pilih `Hair = HA`.
3. Admin pilih `Eyeglasses = EB`.
4. Sistem membentuk `asset_code = BOY-HA-EB`.
5. Admin upload foto character final untuk kombinasi itu.
6. Admin klik submit.
7. Data masuk ke tabel list asset.

### Conflict Asset Code

Jika admin submit asset code yang sudah ada, misalnya `BOY-HA-EB`, sistem tidak boleh langsung overwrite.

Harus tampil confirmation box dengan dua opsi:

```text
Upload Ulang
Kembali
```

Makna opsi:

- `Upload Ulang`: replace/ganti image dan data asset lama dengan upload terbaru.
- `Kembali`: batal submit, kembali ke form, data lama tidak berubah.

### Tabel List Asset Final

Tabel list asset adalah tempat admin melakukan maintenance asset yang sudah di-submit.

Fitur tabel:

- Menampilkan semua asset character.
- Menampilkan thumbnail image.
- Menampilkan `asset_code`.
- Menampilkan `gender`.
- Menampilkan `hair_style_code`.
- Menampilkan `eyeglasses_code`.
- Menampilkan status aktif/nonaktif.
- Menampilkan date uploaded.
- Bisa filter `BOY/GIRL`.
- Bisa search asset code.
- Bisa sort by date uploaded.
- Bisa aktif/nonaktifkan asset.
- Bisa edit/ganti foto asset.

Contoh use case:

Admin ingin menonaktifkan `BOY-HA-EA`:

1. Buka Master Data.
2. Filter `BOY`.
3. Search atau cari `BOY-HA-EA`.
4. Sort by date uploaded jika perlu.
5. Klik aksi untuk ubah status aktif/nonaktif.

### Schema Final Yang Diinginkan Untuk Character Assets

Schema lama:

```text
asset_code
gender
hair_style_id
eyeglasses_id
image_url
is_active
created_at
updated_at
```

Schema final yang lebih cocok:

```sql
CREATE TABLE IF NOT EXISTS character_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_code text UNIQUE NOT NULL,
  gender text NOT NULL CHECK (gender IN ('boy', 'girl')),
  hair_style_code text NOT NULL,
  eyeglasses_code text NOT NULL,
  image_url text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (gender, hair_style_code, eyeglasses_code)
);
```

Index final yang disarankan:

```sql
CREATE INDEX IF NOT EXISTS idx_character_assets_asset_code ON character_assets(asset_code);
CREATE INDEX IF NOT EXISTS idx_character_assets_gender ON character_assets(gender);
CREATE INDEX IF NOT EXISTS idx_character_assets_is_active ON character_assets(is_active);
CREATE INDEX IF NOT EXISTS idx_character_assets_created_at ON character_assets(created_at);
CREATE INDEX IF NOT EXISTS idx_character_assets_combo
  ON character_assets(gender, hair_style_code, eyeglasses_code);
```

Catatan migration:

Jika database sudah punya tabel lama, perlu migration hati-hati karena kolom `hair_style_id` dan `eyeglasses_id` lama bertipe uuid dan NOT NULL. Untuk alur final, dua kolom ini harus diganti menjadi kode text langsung, atau buat tabel baru sementara lalu migrate.

---

## 12. Customer API

Endpoint customer:

```text
POST /api/customer/validate-code
POST /api/customer/submit-order
```

File:

```text
app/api/customer/validate-code/route.ts
app/api/customer/submit-order/route.ts
```

### validate-code

Tugas:

- Validasi format order code.
- Cek kode ada/tidak.
- Cek status kode.
- Cek live session jika package live.
- Anti brute force.
- Jika terlalu banyak gagal, minta admin validation code.

Input contoh:

```json
{
  "code": "HMABC1234",
  "device_key": "optional-device-id",
  "admin_validation_code": "optional"
}
```

Output sukses:

```json
{
  "valid": true,
  "package_code": "HM",
  "package_label": "Hemat",
  "live_session_id": null,
  "live_session_name": null
}
```

### submit-order

Tugas:

- Validasi order code.
- Validasi tema.
- Validasi parent content requirement.
- Validasi character asset.
- Submit order secara atomic.
- Mark order code menjadi used.

Input penting:

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
  "special_notes": "Catatan khusus",
  "pronunciation_note": "Aira dibaca AI-RA"
}
```

Output sukses:

```json
{
  "ok": true,
  "public_order_id": "HM-20260427-101530-A7K2P"
}
```

Catatan untuk arah final character asset:

`submit-order` harus mencari `character_assets` berdasarkan:

```text
gender + hair_style_code + eyeglasses_code + is_active = true
```

Bukan lagi berdasarkan foreign key ke tabel `hair_styles` dan `eyeglasses`.

Customer default character:

```text
GIRL-HA-EA
BOY-HA-EA
```

Saat customer membuka form, pilihan default character gender sebaiknya mengarah ke asset code tersebut.

---

## 13. Database Schema Saat Ini

File schema:

```text
supabase/schema.sql
```

Tabel saat ini:

```text
live_sessions
order_codes
themes
theme_package_codes
theme_images
hair_styles
eyeglasses
character_assets
orders
code_attempts
admin_validation_codes
export_logs
```

Stored function:

```text
submit_order_atomic(p_order_data jsonb)
```

Fungsi stored procedure:

- Lock order code dengan `FOR UPDATE`.
- Pastikan order code masih `unused`.
- Cek live session jika paket live.
- Insert order.
- Update order code menjadi `used`.
- Return `order_id` dan `public_order_id`.

Catatan penting:

Schema saat ini belum final untuk arah baru Character Assets. Perlu update/migration agar `character_assets` menyimpan `hair_style_code` dan `eyeglasses_code` langsung.

---

## 14. Supabase Storage

Bucket yang dipakai/direncanakan:

```text
theme-previews
character-assets
```

Bucket lama yang disebut README namun tidak lagi ideal untuk arah final:

```text
hair-styles
eyeglasses
```

Alasan:

Dalam arah final, hair/eyeglasses bukan lagi image asset terpisah, melainkan kode statis `HA-HZ` dan `EA-EZ`.

File helper:

```text
lib/theme-images.ts
lib/character-assets.ts
```

Upload route:

```text
app/api/admin/themes/images/route.ts
app/api/admin/character-assets/image/route.ts
```

Supported file:

```text
image/jpeg
image/png
image/webp
image/gif
```

File size limit bucket:

```text
10MB
```

---

## 15. Anti Brute Force

Tabel:

```text
code_attempts
admin_validation_codes
```

Endpoint terkait:

```text
app/api/customer/validate-code/route.ts
```

Konsep:

- Customer yang salah memasukkan kode berkali-kali akan tercatat.
- Setelah limit tertentu, akan diblokir sementara.
- Bisa diminta admin validation code untuk membuka blokir.

Catatan arah final:

User sudah meminta tab Admin Validation di Master Data dihilangkan dari UI. Jika fitur anti brute force tetap dipakai, admin validation code bisa:

1. Dihilangkan sepenuhnya dari flow, atau
2. Tetap ada secara backend tetapi tidak dikelola dari Master Data, atau
3. Dipindah ke halaman khusus security/settings jika masih dibutuhkan.

Keputusan final perlu diselaraskan sebelum menghapus tabel/API terkait.

---

## 16. Hal Yang Sudah Selesai

Implementasi utama yang sudah ada:

- Next.js admin panel.
- Login admin Supabase.
- Protected routes via middleware.
- Dashboard count statistics.
- Orders list/cancel/export.
- Codes import/list/export/expire.
- Live session create/list/close/cancel.
- Themes CRUD.
- Theme image upload ke Supabase Storage.
- Theme gallery 1-3 image.
- Customer validate-code API.
- Customer submit-order API.
- Atomic submit stored procedure.
- Sanitasi input.
- Toast dan confirmation dialog.
- Mobile sidebar dasar.
- Character asset image upload route sudah ada.
- Guard config Supabase agar error lebih jelas.

---

## 17. Hal Yang Belum Selesai / Perlu Dikerjakan

Pekerjaan besar yang masih perlu:

1. Ubah Master Data menjadi hanya Character Assets.
2. Hilangkan tab Hair Styles, Eyeglasses, Admin Validation dari UI.
3. Ubah selector Character Assets menjadi statis `HA-HZ` dan `EA-EZ`.
4. Ubah schema `character_assets` agar menyimpan code langsung, bukan foreign key.
5. Ubah API admin master-data sesuai schema baru.
6. Tambah conflict dialog `Upload Ulang / Kembali` saat asset code sudah ada.
7. Tambah filter table `BOY/GIRL`.
8. Tambah search asset code.
9. Tambah sort by date uploaded.
10. Tambah aksi edit/ganti foto di tabel asset.
11. Tambah aksi aktif/nonaktif di tabel asset.
12. Update customer submit-order agar validasi asset berdasarkan code langsung.
13. Pertimbangkan menghapus atau memindahkan fitur admin validation.
14. Pertimbangkan fitur pendapatan/live revenue jika ada data nominal.

---

## 18. Desired Claude Task Prompt

Berikut prompt ringkas yang bisa diberikan ke Claude setelah dokumen ini:

```text
Kamu sedang bekerja di project Next.js admin panel Birthday Video Custom.
Baca ADMIN_PANEL_CONTEXT_FOR_CLAUDE.md ini sebagai sumber kebenaran.

Tugas utama:
Refactor Master Data agar hanya mengelola Character Assets.

Requirement:
- Hapus/hide tab Hair Styles, Eyeglasses, Admin Validation dari Master Data.
- Character Asset Editor memakai selector statis:
  - Gender: BOY/GIRL
  - Hair Style: HA-HZ
  - Eyeglasses: EA-EZ
- Asset code auto-generate: BOY-HA-EA atau GIRL-HC-EZ.
- Admin upload 1 image untuk asset code itu.
- Submit menyimpan data ke character_assets.
- Jika asset_code sudah ada, tampilkan dialog:
  - Upload Ulang: replace image/data asset existing.
  - Kembali: batal tanpa mengubah data existing.
- Tabel asset menampilkan:
  - thumbnail
  - asset_code
  - gender
  - hair_style_code
  - eyeglasses_code
  - status aktif/nonaktif
  - created_at/date uploaded
  - action edit/ganti foto
  - action aktif/nonaktif
- Tabel asset punya filter BOY/GIRL, search asset code, dan sort by date uploaded.
- Update API admin dan schema SQL agar character_assets tidak lagi bergantung pada hair_styles dan eyeglasses.
- Update submit-order customer agar validasi asset berdasarkan gender + hair_style_code + eyeglasses_code.
- Jangan ubah fitur order, code, live sessions, themes kecuali dibutuhkan untuk menjaga build.
- Setelah selesai, jalankan npm run build.
```

---

## 19. File Penting Untuk Claude

Claude sebaiknya membaca file berikut:

```text
app/master-data/page.tsx
app/api/admin/master-data/route.ts
app/api/admin/character-assets/image/route.ts
app/api/customer/submit-order/route.ts
supabase/schema.sql
lib/constants.ts
lib/character-assets.ts
components/ConfirmDialog.tsx
components/Toast.tsx
```

Jika mengubah upload:

```text
app/api/admin/themes/images/route.ts
lib/theme-images.ts
```

Jika mengubah auth:

```text
middleware.ts
lib/auth.ts
lib/admin-access.ts
lib/supabase-browser.ts
lib/supabase-admin.ts
```

---

## 20. Verification Checklist

Setelah perubahan besar, jalankan:

```bash
npm run build
```

Manual check:

1. Login admin berhasil.
2. Dashboard terbuka.
3. Master Data hanya tampil Character Assets.
4. Selector `Gender`, `Hair`, `Eyeglasses` bekerja.
5. Asset code auto berubah saat selector berubah.
6. Upload image berhasil.
7. Submit asset baru muncul di tabel.
8. Submit asset code sama memunculkan dialog conflict.
9. Upload Ulang mengganti foto asset lama.
10. Kembali membatalkan submit.
11. Filter BOY/GIRL bekerja.
12. Search asset code bekerja.
13. Sort date uploaded bekerja.
14. Aktif/nonaktif asset bekerja.
15. Customer submit-order masih berhasil untuk asset aktif.
16. Customer submit-order gagal untuk asset nonaktif atau tidak ada.

