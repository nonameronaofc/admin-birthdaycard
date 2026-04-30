# Birthday Video Owner Panel

Owner panel untuk mengatur akses admin, audit log, settings internal, dan panel pendapatan.

Project ini dibuat sebagai web terpisah dari:

- `web admin`
- `web customer`

Semua tetap memakai **1 Supabase project** yang sama.

## Fitur MVP

- Login owner via Supabase Auth.
- Dashboard ringkas owner.
- Manajemen user internal: `owner` dan `admin`.
- Aktif/nonaktifkan akses admin.
- Audit log perubahan akses.
- Panel pendapatan yang dipindahkan dari web admin ke web owner.
- Settings dasar owner panel.

## Environment Variables

Isi `.env.local` atau Vercel Environment Variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
OWNER_EMAILS=owner@example.com
OWNER_REVENUE_PASSWORD=ganti-dengan-password-anda
```

`OWNER_EMAILS` adalah akses darurat/sederhana agar owner bisa login dulu. Untuk sistem final, admin panel juga sebaiknya membaca tabel `internal_users`.

## Setup Supabase

1. Buka Supabase project yang sama dengan admin/customer.
2. Buka SQL Editor.
3. Jalankan file:

```text
supabase/owner_schema.sql
```

4. Buat user owner di Supabase Authentication.
5. Tambahkan email owner ke `OWNER_EMAILS`.
6. Opsional: jalankan seed `internal_users` yang ada di komentar SQL.

## Local Run

```bash
npm install
npm run dev
```

Buka:

```text
http://localhost:3000
```

## Deploy Gratis ke Vercel

1. Push folder ini ke GitHub.
2. Import repo ke Vercel.
3. Framework: Next.js.
4. Isi environment variables.
5. Deploy.

Vercel akan memberi URL gratis seperti:

```text
nama-project.vercel.app
```

## Catatan Penting

Panel ini sudah bisa mengatur tabel `internal_users`, tetapi web admin yang lama masih mengecek `ADMIN_EMAILS` dan metadata role admin. Agar owner benar-benar mengendalikan siapa yang bisa masuk web admin, admin panel perlu diubah supaya `lib/admin-access.ts` juga membaca `internal_users` dengan `role = admin` dan `status = active`.

Pendapatan di owner panel membaca tabel `orders` yang sudah ada dan memakai harga paket dari `lib/constants.ts`.

