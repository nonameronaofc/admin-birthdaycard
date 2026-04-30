# Admin-Customer Sync Spec - Birthday Video Custom

Dokumen ini adalah source of truth untuk mencocokkan perubahan web admin dengan web customer. Tujuannya agar alur, data contract, naming, validasi, dan hasil akhir di kedua web tetap sinkron.

Project admin:

```text
C:\Users\Haidar Ali\Documents\admin-panel
```

Stack admin:

- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- Supabase Auth
- Supabase Postgres
- Supabase Storage

---

## 1. Gambaran Produk

Produk ini adalah sistem pemesanan video ulang tahun custom.

Ada dua sisi:

1. **Web Admin**
   Dipakai internal untuk login, melihat order, mengelola kode pesanan, live session, tema, dan character asset.

2. **Web Customer**
   Dipakai customer untuk memasukkan kode pesanan, memilih tema, mengisi data acara, memilih karakter, lalu submit order.

Admin panel menyediakan API customer:

```text
POST /api/customer/validate-code
POST /api/customer/submit-order
```

Web customer harus mengikuti kontrak dan logika dari dua API ini.

---

## 2. Package Code

Package code yang valid:

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

Aturan:

- `HM`, `RG`, `ST` tidak punya live session.
- `RL`, `SL` wajib punya live session.
- Kode pesanan package live hanya valid jika live session masih `active`.

Regex order code:

```text
^(HM|RG|ST|RL|SL)[A-Z0-9+!%&]{7}[A-Z0-9]$
```

---

## 3. Gender

Nilai gender di database dan API:

```text
boy
girl
```

Label UI:

```text
boy  -> Boy
girl -> Girl
```

Web customer harus mengirim `character_gender` dalam lowercase:

```json
{
  "character_gender": "girl"
}
```

Jangan kirim `BOY`, `GIRL`, `male`, `female`, atau label lain ke API.

---

## 4. Character Asset Final

Character asset adalah foto final karakter berdasarkan kombinasi:

```text
gender + hair_style_code + eyeglasses_code
```

Hair style bukan lagi data master dinamis. Eyeglasses juga bukan lagi data master dinamis.

Keduanya sekarang kode statis.

Hair style code valid:

```text
HA, HB, HC, HD, HE, HF, HG, HH, HI, HJ, HK, HL, HM, HN, HO, HP, HQ, HR, HS, HT, HU, HV, HW, HX, HY, HZ
```

Eyeglasses code valid:

```text
EA, EB, EC, ED, EE, EF, EG, EH, EI, EJ, EK, EL, EM, EN, EO, EP, EQ, ER, ES, ET, EU, EV, EW, EX, EY, EZ
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

Default character customer:

```text
Girl default -> GIRL-HA-EA
Boy default  -> BOY-HA-EA
```

Jika customer memilih `gender = girl`, default pilihan hair dan eyeglasses sebaiknya:

```text
hair_style_code = HA
eyeglasses_code = EA
asset_code = GIRL-HA-EA
```

Jika customer memilih `gender = boy`, default pilihan:

```text
hair_style_code = HA
eyeglasses_code = EA
asset_code = BOY-HA-EA
```

---

## 5. Character Asset Schema

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

Constraint penting:

```sql
UNIQUE (gender, hair_style_code, eyeglasses_code)
```

Index penting:

```sql
idx_character_assets_asset_code
idx_character_assets_gender
idx_character_assets_is_active
idx_character_assets_created_at
idx_character_assets_combo
```

Catatan migration:

Schema lama memakai:

```text
hair_style_id
eyeglasses_id
```

Schema baru tidak memakai dua kolom itu. Jalankan ulang:

```text
supabase/schema.sql
```

di Supabase SQL Editor agar database sinkron dengan admin terbaru.

---

## 6. Master Data Admin Final

Master Data admin sekarang hanya untuk:

```text
Character Assets
```

Tidak ada lagi di UI Master Data:

```text
Hair Styles
Eyeglasses
Admin Validation
```

Bagian Master Data terdiri dari:

1. Character Asset Editor.
2. Tabel Asset Character.

### Character Asset Editor

Input:

```text
Gender: Boy/Girl
Hair Style: HA-HZ
Eyeglasses: EA-EZ
Asset Code: auto-generated
Image Upload: file image
Image URL: hasil upload / manual URL
Status Aktif: checkbox
Submit Asset
```

Alur:

1. Admin pilih gender.
2. Admin pilih hair style code.
3. Admin pilih eyeglasses code.
4. Sistem auto-generate asset code.
5. Admin upload foto asset final.
6. Admin submit.
7. Asset masuk ke tabel.

Contoh submit:

```text
Gender = boy
Hair = HA
Eyeglasses = EB
Asset Code = BOY-HA-EB
Image = foto karakter BOY-HA-EB
```

### Conflict Saat Asset Code Sama

Jika admin submit asset code yang sudah ada, sistem menampilkan dialog:

```text
Asset Code Sudah Ada
```

Opsi:

```text
Upload Ulang
Kembali
```

Makna:

- `Upload Ulang`: update/ganti data asset existing, terutama image.
- `Kembali`: batal, tidak mengubah data lama.

### Tabel Asset Character

Kolom tabel:

```text
Thumbnail
Asset Code
Gender
Hair
Glasses
Uploaded Date
Status
Aksi
```

Filter:

```text
Search asset code
Filter gender: Semua/Boy/Girl
Filter status: Semua/Aktif/Nonaktif
Sort uploaded date: Terbaru/Terlama
```

Aksi:

```text
Edit Foto
Aktifkan
Nonaktifkan
Preview
```

Use case:

Jika admin ingin menonaktifkan `BOY-HA-EA`:

1. Buka Master Data.
2. Filter gender `Boy`.
3. Cari `BOY-HA-EA`.
4. Klik `Nonaktifkan`.
5. Customer tidak bisa submit kombinasi itu lagi sampai diaktifkan.

---

## 7. Character Asset Upload

Route upload admin:

```text
POST /api/admin/character-assets/image
```

Body:

```text
FormData
asset_code = BOY-HA-EA
file = image file
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

Storage path:

```text
characters/{ASSET_CODE}/{timestamp}-{uuid}.{extension}
```

Response sukses:

```json
{
  "data": {
    "image_url": "https://...",
    "storage_path": "characters/BOY-HA-EA/..."
  }
}
```

Catatan:

`storage_path` belum disimpan di tabel character asset saat ini. Tabel menyimpan `image_url`.

---

## 8. API Admin Master Data

Route:

```text
/api/admin/master-data
```

Resource yang valid sekarang hanya:

```text
character_assets
```

### GET

Request:

```text
GET /api/admin/master-data?resource=character_assets
```

Response:

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

### POST

Membuat asset baru.

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

- `gender` harus `boy` atau `girl`.
- `hair_style_code` harus `HA-HZ`.
- `eyeglasses_code` harus `EA-EZ`.
- `asset_code` harus cocok dengan format expected.
- `image_url` wajib.
- Jika `asset_code` sudah ada, API return `409`.

Conflict response:

```json
{
  "error": "Asset code sudah ada.",
  "conflict": {
    "id": "uuid",
    "asset_code": "BOY-HA-EA"
  }
}
```

### PATCH Update Asset

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

- Edit foto.
- Upload ulang asset existing.
- Ubah image URL.
- Ubah active state jika dikirim sebagai update biasa.

### PATCH Status

Nonaktifkan:

```json
{
  "resource": "character_assets",
  "id": "uuid",
  "action": "deactivate"
}
```

Aktifkan:

```json
{
  "resource": "character_assets",
  "id": "uuid",
  "action": "reactivate"
}
```

---

## 9. Customer API: validate-code

Route:

```text
POST /api/customer/validate-code
```

Fungsi:

- Validasi format order code.
- Cek kode ada di database.
- Cek status kode.
- Cek live session untuk package live.
- Anti brute force.
- Mengembalikan package info untuk customer flow.

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

Response live package:

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

- Maksimal gagal: 5 kali.
- Block duration: 30 menit.
- Jika butuh admin validation:

```json
{
  "need_admin_validation": true,
  "error": "Anda telah mencapai batas percobaan. Hubungi admin untuk Kode Validasi Admin."
}
```

Catatan:

Walaupun tab Admin Validation sudah dihilangkan dari UI Master Data, backend validate-code masih punya logic `admin_validation_codes`. Ini perlu keputusan lanjutan: tetap dipakai backend, dipindah ke halaman lain, atau dihapus dari flow customer.

---

## 10. Customer API: submit-order

Route:

```text
POST /api/customer/submit-order
```

Fungsi:

- Validasi semua input customer.
- Validasi order code.
- Validasi theme aktif.
- Validasi theme cocok dengan gender dan package.
- Validasi parents content.
- Validasi character asset aktif berdasarkan kode statis.
- Submit order secara atomic.
- Mark order code menjadi `used`.

Request minimal lengkap:

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

Field wajib:

```text
order_code
theme_code
nama_pemesan
whatsapp_full
nickname_anak
nama_lengkap_anak
usia_anak
character_gender
tanggal_acara
deadline_dibutuhkan
birthday_number
hair_style_code
eyeglasses_code
parents_content
```

Field optional:

```text
email
skin_tone
hair_color
outfit_color
mom_nickname
dad_nickname
mom_sweetname
dad_sweetname
special_notes
pronunciation_note
```

Validasi field:

```text
order_code       -> harus match ORDER_CODE_REGEX
character_gender -> boy/girl
birthday_number  -> integer 1-10
hair_style_code  -> /^H[A-Z]$/
eyeglasses_code  -> /^E[A-Z]$/
parents_content  -> none/single_mom/single_father/mom_and_dad
tanggal_acara    -> YYYY-MM-DD
deadline          -> YYYY-MM-DD
whatsapp_full     -> digit 8-15
email             -> valid email atau null
```

Validasi theme:

- Theme harus ada.
- Theme harus `is_active = true`.
- `theme.gender` harus sama dengan `character_gender`.
- `theme.parents_content` harus sama dengan `parents_content`.
- Theme harus tersedia untuk package code dari order code.

Validasi parents:

Jika theme `requires_parents_nickname = true`:

- `single_mom` wajib `mom_nickname`.
- `single_father` wajib `dad_nickname`.
- `mom_and_dad` wajib `mom_nickname` dan `dad_nickname`.

Jika theme `requires_parents_sweetname = true`:

- `single_mom` wajib `mom_sweetname`.
- `single_father` wajib `dad_sweetname`.
- `mom_and_dad` wajib `mom_sweetname` dan `dad_sweetname`.

Validasi character asset:

API mencari asset dengan:

```text
character_assets.gender = character_gender
character_assets.hair_style_code = hair_style_code
character_assets.eyeglasses_code = eyeglasses_code
character_assets.is_active = true
```

Jika tidak ada:

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

## 11. Order Snapshot

Saat customer submit, sistem menyimpan snapshot ke tabel `orders`.

Snapshot character yang disimpan:

```text
hair_style_code
hair_style_name
eyeglasses_code
eyeglasses_name
character_asset_code
```

Karena hair/eyeglasses sekarang kode statis, nilai name disamakan dengan code:

```text
hair_style_name = hair_style_code
eyeglasses_name = eyeglasses_code
```

Contoh:

```text
hair_style_code = HA
hair_style_name = HA
eyeglasses_code = EB
eyeglasses_name = EB
character_asset_code = BOY-HA-EB
```

Alasan snapshot:

Jika asset atau theme berubah di masa depan, order lama tetap punya data historis.

---

## 12. Atomic Submit

Stored function:

```text
submit_order_atomic(p_order_data jsonb)
```

Fungsi:

1. Lock `order_codes` berdasarkan `order_code`.
2. Pastikan kode ada.
3. Pastikan kode masih `unused`.
4. Jika package live, pastikan live session masih `active`.
5. Insert order.
6. Mark code menjadi `used`.
7. Return `order_id` dan `public_order_id`.

Tujuan:

- Mencegah double submit.
- Mencegah satu kode dipakai dua kali.
- Menjamin order dan status kode berubah dalam satu transaksi.

---

## 13. Theme Contract

Tabel:

```text
themes
theme_package_codes
theme_images
```

Theme field penting:

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

Theme image:

- Minimal 1 foto.
- Maksimal 3 foto.
- Foto pertama menjadi image utama.
- Bucket: `theme-previews`.

Customer harus menampilkan theme yang:

```text
is_active = true
gender sesuai character_gender
parents_content sesuai pilihan customer
package tersedia untuk package code customer
```

Jika customer web mengambil theme langsung dari Supabase atau API lain, filter ini harus sama.

---

## 14. Live Session Contract

Live session status:

```text
active
closed
cancelled
```

Package live:

```text
RL
SL
```

Customer flow:

1. Customer input order code.
2. `validate-code` mengembalikan `live_session_id` dan `live_session_name`.
3. Customer form menyimpan/menyertakan live session jika diperlukan.
4. Submit tetap divalidasi lagi oleh stored function.

Jika live session sudah tidak active:

- validate-code gagal, atau
- submit-order gagal di atomic function.

---

## 15. Data Yang Harus Sinkron Antara Admin Dan Customer

Customer web harus sinkron dengan admin untuk:

```text
PACKAGE_CODES = HM, RG, ST, RL, SL
PACKAGE_LABELS
ORDER_CODE_REGEX
GENDERS = boy, girl
PARENTS_CONTENTS
HAIR_CODES = HA-HZ
EYEGLASSES_CODES = EA-EZ
ASSET_CODE_FORMAT = GENDER_UPPER-HAIR-EYEGLASSES
DEFAULT_GIRL_ASSET = GIRL-HA-EA
DEFAULT_BOY_ASSET = BOY-HA-EA
THEME_FILTER_LOGIC
CHARACTER_ASSET_FILTER_LOGIC
PARENTS_REQUIRED_LOGIC
```

---

## 16. End-To-End Customer Flow

Alur customer:

1. Customer memasukkan order code.
2. Web customer memanggil `POST /api/customer/validate-code`.
3. Jika valid, web customer mengetahui package dan live session.
4. Customer memilih gender character.
5. Default character:
   - girl -> `GIRL-HA-EA`
   - boy -> `BOY-HA-EA`
6. Customer memilih theme yang sesuai package, gender, dan parents content.
7. Customer memilih hair code `HA-HZ`.
8. Customer memilih eyeglasses code `EA-EZ`.
9. Customer melihat preview character asset sesuai kombinasi jika tersedia.
10. Customer mengisi data pemesan, anak, tanggal, dan notes.
11. Customer submit ke `POST /api/customer/submit-order`.
12. API validasi semua data.
13. API mencari character asset aktif.
14. API submit order atomic.
15. Customer mendapat `public_order_id`.

---

## 17. End-To-End Admin Flow Character Assets

Alur admin membuat asset:

1. Admin login.
2. Buka Master Data.
3. Pilih gender.
4. Pilih hair code.
5. Pilih eyeglasses code.
6. Sistem membuat asset code.
7. Admin upload image.
8. Admin klik Submit Asset.
9. Jika asset belum ada, asset dibuat.
10. Jika asset sudah ada, muncul dialog `Upload Ulang / Kembali`.
11. Asset tampil di tabel.
12. Admin bisa filter, search, sort, edit foto, aktif/nonaktifkan.

---

## 18. Error Yang Harus Ditangani Customer Web

Customer web harus siap menangani error:

```text
Kode pesanan kosong.
Format kode tidak valid.
Kode pesanan tidak ditemukan.
Kode ini sudah digunakan.
Kode ini sudah tidak berlaku.
Live session sudah ditutup.
Tema wajib dipilih.
Tema tidak ditemukan atau sudah nonaktif.
Gender tema tidak cocok dengan gender karakter.
Parents content tema tidak cocok.
Tema tidak tersedia untuk paket ini.
Mom nickname wajib diisi untuk tema ini.
Dad nickname wajib diisi untuk tema ini.
Mom & Dad nickname wajib diisi untuk tema ini.
Mom sweetname wajib diisi untuk tema ini.
Dad sweetname wajib diisi untuk tema ini.
Mom & Dad sweetname wajib diisi untuk tema ini.
Hair style wajib HA-HZ.
Eyeglasses wajib EA-EZ.
Kombinasi character asset tidak tersedia.
Gagal submit order.
```

Customer UI sebaiknya menampilkan error dengan bahasa yang mudah, tapi logic harus tetap mengikuti API.

---

## 19. Catatan Admin Validation

UI Master Data tidak lagi menampilkan Admin Validation.

Namun backend `validate-code` masih memakai tabel:

```text
admin_validation_codes
```

untuk membuka blokir anti brute force.

Keputusan yang masih perlu disinkronkan:

1. Tetap pakai admin validation backend tapi kelola dari tempat lain.
2. Hapus admin validation dari flow customer.
3. Buat halaman Settings/Security khusus untuk admin validation.

Sebelum web customer final, keputusan ini perlu dipastikan karena customer bisa menerima response:

```json
{
  "need_admin_validation": true,
  "error": "Anda telah mencapai batas percobaan. Hubungi admin untuk Kode Validasi Admin."
}
```

---

## 20. Fitur Yang Belum Ada

Belum ada live revenue/pendapatan.

Alasan:

Tabel `orders` belum punya field nominal seperti:

```text
order_total
amount_paid
payment_status
```

Jika ingin sinkron revenue antara admin dan customer, perlu ditambahkan contract pembayaran.

Opsi:

1. Estimasi revenue dari package code.
2. Simpan nominal asli ke `orders`.
3. Integrasi payment gateway dan status pembayaran.

Rekomendasi:

Gunakan nominal asli di `orders`, bukan estimasi.

---

## 21. Checklist Crosscheck Dengan MD Web Customer

Pastikan MD web customer cocok dengan poin berikut:

1. Package code sama: `HM`, `RG`, `ST`, `RL`, `SL`.
2. Gender dikirim lowercase: `boy` atau `girl`.
3. Hair code hanya `HA-HZ`.
4. Eyeglasses code hanya `EA-EZ`.
5. Asset code customer mengikuti format `GIRL-HA-EA` atau `BOY-HA-EA`.
6. Default girl adalah `GIRL-HA-EA`.
7. Default boy adalah `BOY-HA-EA`.
8. Customer tidak bergantung pada tabel `hair_styles`.
9. Customer tidak bergantung pada tabel `eyeglasses`.
10. Customer mencari/menampilkan asset dari `character_assets`.
11. Customer hanya memakai asset `is_active = true`.
12. Theme customer difilter berdasarkan gender, parents content, package, dan active.
13. Submit customer mengirim `hair_style_code` dan `eyeglasses_code`.
14. Submit customer tidak mengirim `hair_style_id` atau `eyeglasses_id`.
15. Submit customer menangani error jika asset kombinasi tidak tersedia.
16. Validate-code dipanggil sebelum submit.
17. Live package memakai `live_session_id` dari validate-code.
18. Parents nickname/sweetname mengikuti requirement theme.
19. Order code regex sama.
20. Jika admin validation tetap dipakai, customer punya UI untuk input admin validation code saat diblokir.

---

## 22. File Admin Yang Menjadi Rujukan

File utama:

```text
app/master-data/page.tsx
app/api/admin/master-data/route.ts
app/api/admin/character-assets/image/route.ts
app/api/customer/validate-code/route.ts
app/api/customer/submit-order/route.ts
lib/constants.ts
supabase/schema.sql
```

File tema:

```text
app/themes/page.tsx
app/api/admin/themes/list/route.ts
app/api/admin/themes/create/route.ts
app/api/admin/themes/update/route.ts
app/api/admin/themes/images/route.ts
lib/theme-images.ts
```

File order/kode/live:

```text
app/orders/page.tsx
app/codes/page.tsx
app/live-sessions/page.tsx
app/api/admin/orders/*
app/api/admin/codes/*
app/api/admin/live-sessions/*
```

