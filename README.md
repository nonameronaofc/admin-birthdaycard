# Birthday Web Suite

Repo ini berisi tiga aplikasi web:

- `customer-web`: web customer untuk validasi kode dan submit order.
- `admin-panel`: web admin untuk pengelolaan order, kode, tema, pendapatan, dan data master.
- `owner-web`: web owner untuk dashboard owner, pendapatan, audit log, user, dan settings.

## Environment

Setiap app punya file `.env.example`. Salin ke `.env.local` di folder app masing-masing, lalu isi dengan nilai Supabase dan konfigurasi akses yang benar.

File `.env.local` tidak disertakan di repo karena berisi data rahasia.

## Install dan run

Masuk ke salah satu folder app:

```bash
npm install
npm run dev
```

Untuk production build:

```bash
npm run build
npm start
```
