# Birthday Custom — Customer Web

Customer panel untuk pemesanan video ulang tahun custom. Sinkron 100% dengan
admin panel via Supabase (database + storage).

Stack:

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Supabase (database, storage, RPC)
- Deploy: Vercel

## 1. Prasyarat

Sebelum deploy customer web, **admin panel** harus sudah:

1. Database Supabase sudah dijalankan dengan schema admin terbaru (`supabase/schema.sql`).
2. Tabel berikut sudah ada dan ter-populate:
   - `order_codes` (status, package_code, live_session_id)
   - `live_sessions`
   - `themes`, `theme_package_codes`, `theme_images`
   - `character_assets` (asset_code, gender, hair_style_code, eyeglasses_code, image_url, is_active)
   - `orders`
3. Stored function `submit_order_atomic(p_order_data jsonb)` sudah ada.
4. Bucket storage `theme-previews` dan `character-assets` sudah dibuat dan
   policy public-read aktif.
5. Admin sudah upload minimal beberapa character asset dan tema dengan gambar.

## 2. Local Setup

```bash
cd customer-app
cp .env.example .env.local
# isi .env.local dengan kredensial Supabase yang sama dengan admin
npm install
npm run dev
```

Buka http://localhost:3000.

## 3. Environment Variables

Lihat `.env.example`. Yang perlu kamu isi:

| Variable | Lokasi | Keterangan |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend + backend | URL project Supabase, sama dengan admin |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend + backend | Anon key untuk read public (themes, character_assets) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Backend only** | Service role untuk validate-code & submit-order. **Jangan beri prefix `NEXT_PUBLIC_`** |
| `NEXT_PUBLIC_ADMIN_WHATSAPP` | Frontend | Nomor WA admin tujuan setelah submit (format `628xxx` tanpa `+`) |

## 4. Supabase Row Level Security (RLS)

Supaya frontend bisa read tema & asset dengan anon key, set RLS policy:

```sql
-- Themes: public read untuk yang aktif
ALTER TABLE themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "themes_public_read"
  ON themes FOR SELECT
  USING (is_active = true);

ALTER TABLE theme_package_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "theme_pkg_public_read"
  ON theme_package_codes FOR SELECT
  USING (true);

ALTER TABLE theme_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "theme_images_public_read"
  ON theme_images FOR SELECT
  USING (true);

-- Character assets: public read untuk yang aktif
ALTER TABLE character_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "char_assets_public_read"
  ON character_assets FOR SELECT
  USING (is_active = true);
```

Tabel `orders`, `order_codes`, `live_sessions` **TIDAK** boleh punya policy
untuk anon karena diakses backend dengan service role key.

## 5. Deploy ke Vercel

### Opsi A: lewat dashboard

1. Push folder `customer-app` ke repo GitHub.
2. Buka https://vercel.com/new dan import repo tersebut.
3. Framework: Next.js (auto-detect).
4. Root directory: `customer-app/` (jika monorepo).
5. Tambahkan environment variables sesuai poin 3.
6. Deploy.

### Opsi B: lewat CLI

```bash
npm install -g vercel
cd customer-app
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add NEXT_PUBLIC_ADMIN_WHATSAPP
vercel --prod
```

## 6. Struktur Folder

```
customer-app/
├── app/
│   ├── api/customer/
│   │   ├── validate-code/route.ts   # POST /api/customer/validate-code
│   │   └── submit-order/route.ts    # POST /api/customer/submit-order
│   ├── layout.tsx
│   ├── page.tsx                      # Halaman utama (semua step)
│   └── globals.css
├── components/
│   ├── CharacterPreview.tsx          # Preview asset dengan animasi naik-turun
│   ├── ThemeSlideshow.tsx            # Slideshow 3 gambar, hold-to-play
│   └── ValidatedInput.tsx            # Input dengan error real-time + contoh
├── lib/
│   ├── constants.ts                  # Single source of truth (HM, RG, HA-HZ, dll)
│   ├── validation.ts                 # Semua validasi field + pesan error
│   ├── supabase.ts                   # Client browser & server
│   └── themes.ts                     # Fetch tema + asset dari Supabase
├── .env.example
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vercel.json
```

## 7. Sinkronisasi Data dengan Admin

| Konsep | File konstanta | Acuan |
| --- | --- | --- |
| Package codes | `lib/constants.ts → PACKAGE_CODES` | Sync spec §2 |
| Order code regex | `lib/constants.ts → ORDER_CODE_REGEX` | Sync spec §2 |
| Hair codes (HA-HZ) | `lib/constants.ts → HAIR_CODES` | Sync spec §4 |
| Eyeglasses codes (EA-EZ) | `lib/constants.ts → EYE_CODES` | Sync spec §4 |
| Asset code format | `lib/constants.ts → buildAssetCode()` | Sync spec §4 |
| Default boy/girl | `lib/constants.ts → DEFAULT_BOY_ASSET / DEFAULT_GIRL_ASSET` | Sync spec §4 |
| Theme filter logic | `lib/themes.ts → fetchEligibleThemes()` | Sync spec §13 |
| Submit payload | `app/api/customer/submit-order/route.ts` | Sync spec §10 |

Jika admin mengubah constants atau format, **wajib** update file-file di atas.

## 8. Testing Manual Flow

1. Admin buat order code baru di package HM/RG/ST.
2. Customer buka URL Vercel.
3. Input kode → validate-code success → ke step 2.
4. Isi semua data sampai step 7.
5. Submit → pasti ada `public_order_id` di success page.
6. Cek di admin: order baru muncul, kode statusnya `used`.

Untuk live package (RL/SL), pastikan admin sudah membuat live_session yang
`active` sebelum membuat code.

## 9. Catatan Brute Force

Backend `validate-code` saat ini belum implement penuh anti brute force (3x +
admin code). UI sudah siap — tinggal aktifkan logic di `route.ts` dengan
referensi ke `admin_validation_codes` table di admin schema.
