# Integrasi Web Owner Dengan Web Admin

Dokumen ini menjelaskan perubahan yang perlu dilakukan di web admin agar owner panel benar-benar mengendalikan akses admin.

## Kondisi Saat Ini

Web admin saat ini mengizinkan akses admin lewat:

- `ADMIN_EMAILS`
- metadata Supabase Auth dengan role `admin`

File utama:

```text
C:\Users\Haidar Ali\Documents\admin-panel\lib\admin-access.ts
```

## Target

Web admin harus mengizinkan login hanya jika user:

- ada di Supabase Auth
- tercatat di tabel `internal_users`
- `role = admin` atau `role = owner`
- `status = active`

## Tabel Dari Owner Panel

File SQL:

```text
supabase/owner_schema.sql
```

Tabel penting:

- `internal_users`
- `owner_audit_logs`
- `owner_settings`

## Perubahan Yang Disarankan

1. Tambah helper server-side di web admin untuk membaca `internal_users`.
2. Middleware admin memakai helper async, bukan hanya `isAdminUser(user)` sync.
3. API admin memakai guard yang sama.
4. Hapus panel `/pendapatan` dari sidebar admin.
5. Arahkan pendapatan hanya ke web owner.

## Aturan Akses Akhir

| Role | Web Admin | Web Owner |
| --- | --- | --- |
| `owner` | boleh | boleh |
| `admin` | boleh | tidak boleh |
| `disabled` | tidak boleh | tidak boleh |
| tidak tercatat | tidak boleh | tidak boleh |

