-- =====================================================================
-- Birthday Video Owner Panel - Supabase Migration
-- Jalankan di Supabase SQL Editor pada project yang sama dengan admin/customer.
-- =====================================================================

CREATE TABLE IF NOT EXISTS internal_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NULL UNIQUE,
  email text UNIQUE NOT NULL,
  name text NULL,
  role text NOT NULL DEFAULT 'admin'
    CHECK (role IN ('owner', 'admin')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disabled', 'pending')),
  last_login_at timestamptz NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_internal_users_email ON internal_users(email);
CREATE INDEX IF NOT EXISTS idx_internal_users_role ON internal_users(role);
CREATE INDEX IF NOT EXISTS idx_internal_users_status ON internal_users(status);
CREATE INDEX IF NOT EXISTS idx_internal_users_auth_user_id ON internal_users(auth_user_id);

CREATE TABLE IF NOT EXISTS owner_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NULL,
  actor_email text NULL,
  action_type text NOT NULL,
  target_user_id uuid NULL,
  target_email text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_owner_audit_logs_created_at
  ON owner_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_owner_audit_logs_actor_email
  ON owner_audit_logs(actor_email);
CREATE INDEX IF NOT EXISTS idx_owner_audit_logs_target_email
  ON owner_audit_logs(target_email);
CREATE INDEX IF NOT EXISTS idx_owner_audit_logs_action_type
  ON owner_audit_logs(action_type);

CREATE TABLE IF NOT EXISTS owner_settings (
  key text PRIMARY KEY,
  value_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

INSERT INTO owner_settings (key, value_json)
VALUES
  ('owner_panel', '{"site_name":"Birthday Video","admin_invite_mode":"manual","login_lock_mode":"normal"}'::jsonb),
  ('revenue_target', '{"amount":0}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Ganti email di bawah dengan email owner utama kamu setelah user dibuat di Supabase Auth.
-- INSERT INTO internal_users (email, name, role, status)
-- VALUES ('owner@example.com', 'Owner Utama', 'owner', 'active')
-- ON CONFLICT (email) DO UPDATE
-- SET role = 'owner', status = 'active', updated_at = now();

ALTER TABLE internal_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_settings ENABLE ROW LEVEL SECURITY;

-- Tidak dibuat policy anon/authenticated karena semua akses panel owner lewat API server
-- dengan service role key. Ini mencegah client publik membaca tabel internal langsung.

