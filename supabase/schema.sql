-- =====================================================================
-- Birthday Video Admin Panel — Database Schema
-- Sesuai DOKUMENTASI_ADMIN_FINAL_v3_REVISED.md
-- =====================================================================
-- Baseline untuk database BARU / fresh install.
-- Untuk database yang SUDAH berjalan, jangan rerun file ini sembarangan.
-- Pakai file migration terpisah per perubahan, misalnya:
--   - supabase/nickname_usage_migration.sql
-- =====================================================================

-- ============================================================
-- 1. LIVE SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS live_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'closed', 'cancelled')),
  started_at timestamptz DEFAULT now(),
  closed_at timestamptz NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON live_sessions(status);
CREATE INDEX IF NOT EXISTS idx_live_sessions_started_at ON live_sessions(started_at);

-- ============================================================
-- 2. ORDER CODES
-- ============================================================
CREATE TABLE IF NOT EXISTS order_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  package_code text NOT NULL
    CHECK (package_code IN ('HM', 'RG', 'ST', 'RL', 'SL')),
  status text NOT NULL DEFAULT 'unused'
    CHECK (status IN ('unused', 'used', 'expired')),
  live_session_id uuid NULL REFERENCES live_sessions(id) ON DELETE RESTRICT,
  used_at timestamptz NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CHECK (
    (package_code IN ('RL', 'SL') AND live_session_id IS NOT NULL)
    OR
    (package_code IN ('HM', 'RG', 'ST') AND live_session_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_order_codes_code ON order_codes(code);
CREATE INDEX IF NOT EXISTS idx_order_codes_status ON order_codes(status);
CREATE INDEX IF NOT EXISTS idx_order_codes_package_code ON order_codes(package_code);
CREATE INDEX IF NOT EXISTS idx_order_codes_live_session_id ON order_codes(live_session_id);

-- ============================================================
-- 3. THEMES
-- ============================================================
CREATE TABLE IF NOT EXISTS themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_code text UNIQUE NOT NULL,
  name text NOT NULL,
  gender text NOT NULL CHECK (gender IN ('boy', 'girl')),
  parents_content text NOT NULL
    CHECK (parents_content IN ('none', 'single_mom', 'single_father', 'mom_and_dad')),
  requires_parents_nickname boolean NOT NULL DEFAULT false,
  requires_parents_nickname_video boolean NOT NULL DEFAULT false,
  requires_parents_nickname_print boolean NOT NULL DEFAULT false,
  requires_parents_sweetname boolean NOT NULL DEFAULT false,
  style_tags text[] NOT NULL DEFAULT '{}',
  color_tags text[] NOT NULL DEFAULT '{}',
  mood_tags text[] NOT NULL DEFAULT '{}',
  is_recommended boolean NOT NULL DEFAULT false,
  display_priority integer NOT NULL DEFAULT 0,
  image_url text NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_themes_gender ON themes(gender);
CREATE INDEX IF NOT EXISTS idx_themes_parents_content ON themes(parents_content);
CREATE INDEX IF NOT EXISTS idx_themes_is_active ON themes(is_active);
CREATE INDEX IF NOT EXISTS idx_themes_theme_code ON themes(theme_code);
CREATE INDEX IF NOT EXISTS idx_themes_filter ON themes(gender, parents_content, is_active);
CREATE INDEX IF NOT EXISTS idx_themes_is_recommended ON themes(is_recommended);
CREATE INDEX IF NOT EXISTS idx_themes_display_priority ON themes(display_priority);
CREATE INDEX IF NOT EXISTS idx_themes_style_tags ON themes USING GIN(style_tags);
CREATE INDEX IF NOT EXISTS idx_themes_color_tags ON themes USING GIN(color_tags);
CREATE INDEX IF NOT EXISTS idx_themes_mood_tags ON themes USING GIN(mood_tags);

-- Migration aman: scope nickname orang tua.
-- Legacy requires_parents_nickname dianggap sebagai kebutuhan video.
ALTER TABLE themes ADD COLUMN IF NOT EXISTS requires_parents_nickname_video boolean NOT NULL DEFAULT false;
ALTER TABLE themes ADD COLUMN IF NOT EXISTS requires_parents_nickname_print boolean NOT NULL DEFAULT false;
ALTER TABLE themes ADD COLUMN IF NOT EXISTS style_tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE themes ADD COLUMN IF NOT EXISTS color_tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE themes ADD COLUMN IF NOT EXISTS mood_tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE themes ADD COLUMN IF NOT EXISTS is_recommended boolean NOT NULL DEFAULT false;
ALTER TABLE themes ADD COLUMN IF NOT EXISTS display_priority integer NOT NULL DEFAULT 0;
UPDATE themes
SET requires_parents_nickname_video = true
WHERE requires_parents_nickname = true
  AND requires_parents_nickname_video = false
  AND requires_parents_nickname_print = false;

-- ============================================================
-- 4. THEME PACKAGE CODES (relasi tema ↔ paket)
-- ============================================================
CREATE TABLE IF NOT EXISTS theme_package_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id uuid NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  package_code text NOT NULL
    CHECK (package_code IN ('HM', 'RG', 'ST', 'RL', 'SL')),
  UNIQUE (theme_id, package_code)
);

CREATE INDEX IF NOT EXISTS idx_theme_package_codes_theme_id ON theme_package_codes(theme_id);
CREATE INDEX IF NOT EXISTS idx_theme_package_codes_package_code ON theme_package_codes(package_code);
CREATE INDEX IF NOT EXISTS idx_theme_package_codes_filter ON theme_package_codes(package_code, theme_id);

-- ============================================================
-- 5. THEME IMAGES (gambar slideshow tema, urut dari display_order)
-- ============================================================
CREATE TABLE IF NOT EXISTS theme_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id uuid NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  storage_path text NULL,
  display_order integer NOT NULL DEFAULT 0 CHECK (display_order BETWEEN 0 AND 2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (theme_id, display_order)
);

CREATE INDEX IF NOT EXISTS idx_theme_images_theme_id ON theme_images(theme_id);
CREATE INDEX IF NOT EXISTS idx_theme_images_display_order ON theme_images(theme_id, display_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_theme_images_storage_path
  ON theme_images(storage_path)
  WHERE storage_path IS NOT NULL;

-- ============================================================
-- 6. THEME CHARACTER VARIANTS (kombinasi karakter per tema)
-- ============================================================
CREATE TABLE IF NOT EXISTS theme_character_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id uuid NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  gender text NOT NULL CHECK (gender IN ('boy', 'girl')),
  hair_type_label text NOT NULL,
  hair_type_key text NOT NULL,
  face_attribute_label text NOT NULL,
  face_attribute_key text NOT NULL,
  variant_name text NULL,
  image_url text NOT NULL,
  storage_path text NULL,
  is_default boolean NOT NULL DEFAULT false,
  is_recommended boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (theme_id, gender, hair_type_key, face_attribute_key)
);

CREATE INDEX IF NOT EXISTS idx_theme_character_variants_theme_id
  ON theme_character_variants(theme_id);
CREATE INDEX IF NOT EXISTS idx_theme_character_variants_filter
  ON theme_character_variants(theme_id, gender, is_active);
CREATE INDEX IF NOT EXISTS idx_theme_character_variants_default
  ON theme_character_variants(theme_id, gender, is_default);
CREATE INDEX IF NOT EXISTS idx_theme_character_variants_display_order
  ON theme_character_variants(theme_id, gender, display_order);

-- ============================================================
-- 7. CHARACTER ASSETS (asset final berdasarkan kode statis)
-- ============================================================
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

-- Migration aman dari schema lama yang memakai hair_style_id/eyeglasses_id.
ALTER TABLE character_assets ADD COLUMN IF NOT EXISTS hair_style_code text;
ALTER TABLE character_assets ADD COLUMN IF NOT EXISTS eyeglasses_code text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'character_assets' AND column_name = 'hair_style_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'hair_styles'
  ) THEN
    UPDATE character_assets ca
    SET hair_style_code = hs.hair_style_code
    FROM hair_styles hs
    WHERE ca.hair_style_id = hs.id
      AND (ca.hair_style_code IS NULL OR ca.hair_style_code = '');
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'character_assets' AND column_name = 'eyeglasses_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'eyeglasses'
  ) THEN
    UPDATE character_assets ca
    SET eyeglasses_code = eg.eyeglasses_code
    FROM eyeglasses eg
    WHERE ca.eyeglasses_id = eg.id
      AND (ca.eyeglasses_code IS NULL OR ca.eyeglasses_code = '');
  END IF;
END $$;

UPDATE character_assets SET hair_style_code = 'HA' WHERE hair_style_code IS NULL OR hair_style_code = '';
UPDATE character_assets SET eyeglasses_code = 'EA' WHERE eyeglasses_code IS NULL OR eyeglasses_code = '';

ALTER TABLE character_assets DROP COLUMN IF EXISTS hair_style_id CASCADE;
ALTER TABLE character_assets DROP COLUMN IF EXISTS eyeglasses_id CASCADE;
ALTER TABLE character_assets ALTER COLUMN hair_style_code SET NOT NULL;
ALTER TABLE character_assets ALTER COLUMN eyeglasses_code SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'character_assets_hair_style_code_check'
  ) THEN
    ALTER TABLE character_assets
      ADD CONSTRAINT character_assets_hair_style_code_check
      CHECK (hair_style_code ~ '^H[A-Z]$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'character_assets_eyeglasses_code_check'
  ) THEN
    ALTER TABLE character_assets
      ADD CONSTRAINT character_assets_eyeglasses_code_check
      CHECK (eyeglasses_code ~ '^E[A-Z]$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'character_assets_combo_unique'
  ) THEN
    ALTER TABLE character_assets
      ADD CONSTRAINT character_assets_combo_unique
      UNIQUE (gender, hair_style_code, eyeglasses_code);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_character_assets_asset_code ON character_assets(asset_code);
CREATE INDEX IF NOT EXISTS idx_character_assets_gender ON character_assets(gender);
CREATE INDEX IF NOT EXISTS idx_character_assets_is_active ON character_assets(is_active);
CREATE INDEX IF NOT EXISTS idx_character_assets_created_at ON character_assets(created_at);
CREATE INDEX IF NOT EXISTS idx_character_assets_combo
  ON character_assets(gender, hair_style_code, eyeglasses_code);

-- ============================================================
-- 6B. CUSTOMER STYLE OPTION VISIBILITY
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_style_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  option_type text NOT NULL CHECK (option_type IN ('hair', 'eyeglasses')),
  option_code text NOT NULL,
  is_visible boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT customer_style_options_code_check CHECK (
    (option_type = 'hair' AND option_code ~ '^H[A-Z]$')
    OR (option_type = 'eyeglasses' AND option_code ~ '^E[A-Z]$')
  ),
  CONSTRAINT customer_style_options_unique UNIQUE (option_type, option_code)
);

CREATE INDEX IF NOT EXISTS idx_customer_style_options_lookup
  ON customer_style_options(option_type, is_visible, sort_order, option_code);

INSERT INTO customer_style_options (option_type, option_code, is_visible, sort_order)
SELECT 'hair', 'H' || chr(65 + n), true, n
FROM generate_series(0, 25) AS n
ON CONFLICT (option_type, option_code) DO NOTHING;

INSERT INTO customer_style_options (option_type, option_code, is_visible, sort_order)
SELECT 'eyeglasses', 'E' || chr(65 + n), true, n
FROM generate_series(0, 25) AS n
ON CONFLICT (option_type, option_code) DO NOTHING;

-- ============================================================
-- 7. ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_order_id text UNIQUE NOT NULL,
  order_code text NOT NULL,
  package_code text NOT NULL
    CHECK (package_code IN ('HM', 'RG', 'ST', 'RL', 'SL')),
  package_label text NOT NULL,

  live_session_id uuid NULL REFERENCES live_sessions(id) ON DELETE RESTRICT,
  live_session_name text NULL,

  theme_code text NOT NULL,
  theme_name text NOT NULL,

  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),

  download_status text NOT NULL DEFAULT 'not_downloaded'
    CHECK (download_status IN ('not_downloaded', 'downloaded')),
  downloaded_at timestamptz NULL,
  download_batch_id uuid NULL,

  nama_pemesan text NOT NULL,
  whatsapp_full text NOT NULL,
  email text NULL,

  nickname_anak text NOT NULL,
  nama_lengkap_anak text NOT NULL,
  usia_anak text NOT NULL,
  character_gender text NOT NULL CHECK (character_gender IN ('boy', 'girl')),
  tanggal_acara date NOT NULL,
  deadline_dibutuhkan date NOT NULL,
  birthday_number integer NOT NULL CHECK (birthday_number BETWEEN 1 AND 10),

  hair_style_code text NOT NULL,
  hair_style_name text NOT NULL,
  eyeglasses_code text NOT NULL,
  eyeglasses_name text NOT NULL,
  character_asset_code text NOT NULL,
  skin_tone text NULL,
  hair_color text NULL,
  outfit_color text NULL,

  parents_content text NOT NULL
    CHECK (parents_content IN ('none', 'single_mom', 'single_father', 'mom_and_dad')),
  requires_parents_nickname boolean NOT NULL DEFAULT false,
  requires_parents_nickname_video boolean NOT NULL DEFAULT false,
  requires_parents_nickname_print boolean NOT NULL DEFAULT false,
  requires_parents_sweetname boolean NOT NULL DEFAULT false,
  mom_nickname text NULL,
  dad_nickname text NULL,
  mom_sweetname text NULL,
  dad_sweetname text NULL,

  special_notes text NULL,
  pronunciation_note text NULL,
  admin_note text NULL,

  is_deleted boolean DEFAULT false,
  deleted_at timestamptz NULL,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_public_order_id ON orders(public_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_code ON orders(order_code);
CREATE INDEX IF NOT EXISTS idx_orders_package_code ON orders(package_code);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_download_status ON orders(download_status);
CREATE INDEX IF NOT EXISTS idx_orders_live_session_id ON orders(live_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_whatsapp_full ON orders(whatsapp_full);
CREATE INDEX IF NOT EXISTS idx_orders_theme_code ON orders(theme_code);
CREATE INDEX IF NOT EXISTS idx_orders_character_asset_code ON orders(character_asset_code);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS requires_parents_nickname_video boolean NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS requires_parents_nickname_print boolean NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_trial boolean NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS trial_code_id uuid NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS trial_code text NULL;
UPDATE orders
SET requires_parents_nickname_video = true
WHERE requires_parents_nickname = true
  AND requires_parents_nickname_video = false
  AND requires_parents_nickname_print = false;

CREATE INDEX IF NOT EXISTS idx_orders_is_trial ON orders(is_trial);
CREATE INDEX IF NOT EXISTS idx_orders_trial_code ON orders(trial_code);

-- ============================================================
-- 9. CODE ATTEMPTS (anti brute force)
-- ============================================================
CREATE TABLE IF NOT EXISTS code_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  device_key text NULL,
  failed_attempt_count int NOT NULL DEFAULT 0,
  need_admin_validation boolean NOT NULL DEFAULT false,
  blocked_until timestamptz NULL,
  last_attempt_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_code_attempts_ip_address ON code_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_code_attempts_device_key ON code_attempts(device_key);
CREATE INDEX IF NOT EXISTS idx_code_attempts_blocked_until ON code_attempts(blocked_until);
CREATE INDEX IF NOT EXISTS idx_code_attempts_ip_device ON code_attempts(ip_address, device_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_code_attempts_unique_identity
  ON code_attempts(ip_address, COALESCE(device_key, ''));

-- ============================================================
-- 10. ADMIN VALIDATION CODES
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_validation_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired')),
  max_usage int DEFAULT 50,
  used_count int DEFAULT 0,
  expired_at timestamptz NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- 11. EXPORT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS export_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_type text NOT NULL CHECK (export_type IN ('live_session_export', 'daily_export')),
  live_session_id uuid NULL REFERENCES live_sessions(id) ON DELETE SET NULL,
  export_date date NOT NULL,
  file_format text NOT NULL CHECK (file_format IN ('csv', 'json')),
  total_orders int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_export_logs_export_type ON export_logs(export_type);
CREATE INDEX IF NOT EXISTS idx_export_logs_export_date ON export_logs(export_date);
CREATE INDEX IF NOT EXISTS idx_export_logs_live_session_id ON export_logs(live_session_id);

-- ============================================================
-- 12. ADMIN SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_settings (
  key text PRIMARY KEY,
  value_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO admin_settings (key, value_json)
VALUES ('revenue_target', jsonb_build_object('amount', 0))
ON CONFLICT (key) DO NOTHING;

INSERT INTO admin_settings (key, value_json)
VALUES ('trial_order_settings', jsonb_build_object('enabled', false))
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS trial_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  label text NULL,
  package_code text NOT NULL CHECK (package_code IN ('HM', 'RG', 'ST', 'RL', 'SL')),
  is_active boolean NOT NULL DEFAULT true,
  notes text NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trial_codes_code ON trial_codes(code);
CREATE INDEX IF NOT EXISTS idx_trial_codes_active ON trial_codes(is_active);

-- ============================================================
-- 13. STORED FUNCTION: SUBMIT ORDER (atomic transaction)
-- ============================================================
-- Anti double submit: kunci kode dengan FOR UPDATE, lalu update jika masih unused.
-- Jika kode sudah used/expired/sesi closed, transaksi rollback.
-- ============================================================
CREATE OR REPLACE FUNCTION submit_order_atomic(p_order_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_code text;
  v_is_trial boolean;
  v_package_code text;
  v_trial_code_id uuid;
  v_code_row order_codes%ROWTYPE;
  v_session_status text;
  v_new_order_id uuid;
  v_public_order_id text;
BEGIN
  v_order_code := p_order_data->>'order_code';
  v_public_order_id := p_order_data->>'public_order_id';
  v_is_trial := COALESCE((p_order_data->>'is_trial')::bool, false);
  v_trial_code_id := NULLIF(p_order_data->>'trial_code_id', '')::uuid;

  IF v_is_trial THEN
    v_package_code := p_order_data->>'package_code';
    IF v_package_code NOT IN ('HM','RG','ST','RL','SL') THEN
      RAISE EXCEPTION 'Package trial tidak valid' USING ERRCODE = 'P0004';
    END IF;
  ELSE
    -- Lock kode supaya tidak bisa dipakai paralel
    SELECT * INTO v_code_row
    FROM order_codes
    WHERE code = v_order_code
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Kode pesanan tidak ditemukan' USING ERRCODE = 'P0001';
    END IF;

    IF v_code_row.status <> 'unused' THEN
      RAISE EXCEPTION 'Kode pesanan sudah % atau tidak berlaku', v_code_row.status USING ERRCODE = 'P0002';
    END IF;

    v_package_code := v_code_row.package_code;
  END IF;

  -- Cek live session jika RL/SL normal. Trial tidak wajib punya live session.
  IF NOT v_is_trial AND v_package_code IN ('RL','SL') THEN
    SELECT status INTO v_session_status
    FROM live_sessions WHERE id = v_code_row.live_session_id;

    IF v_session_status <> 'active' THEN
      RAISE EXCEPTION 'Live session sudah % — kode tidak bisa dipakai', v_session_status USING ERRCODE = 'P0003';
    END IF;
  END IF;

  -- Insert order
  INSERT INTO orders (
    public_order_id, order_code, package_code, package_label,
    live_session_id, live_session_name,
    is_trial, trial_code_id, trial_code,
    theme_code, theme_name,
    nama_pemesan, whatsapp_full, email,
    nickname_anak, nama_lengkap_anak, usia_anak, character_gender,
    tanggal_acara, deadline_dibutuhkan, birthday_number,
    hair_style_code, hair_style_name, eyeglasses_code, eyeglasses_name,
    character_asset_code, skin_tone, hair_color, outfit_color,
    parents_content,
    requires_parents_nickname, requires_parents_nickname_video, requires_parents_nickname_print,
    requires_parents_sweetname,
    mom_nickname, dad_nickname, mom_sweetname, dad_sweetname,
    special_notes, pronunciation_note
  ) VALUES (
    v_public_order_id,
    v_order_code,
    v_package_code,
    p_order_data->>'package_label',
    CASE WHEN v_is_trial THEN NULL ELSE v_code_row.live_session_id END,
    p_order_data->>'live_session_name',
    v_is_trial,
    v_trial_code_id,
    p_order_data->>'trial_code',
    p_order_data->>'theme_code',
    p_order_data->>'theme_name',
    p_order_data->>'nama_pemesan',
    p_order_data->>'whatsapp_full',
    p_order_data->>'email',
    p_order_data->>'nickname_anak',
    p_order_data->>'nama_lengkap_anak',
    p_order_data->>'usia_anak',
    p_order_data->>'character_gender',
    (p_order_data->>'tanggal_acara')::date,
    (p_order_data->>'deadline_dibutuhkan')::date,
    (p_order_data->>'birthday_number')::int,
    p_order_data->>'hair_style_code',
    p_order_data->>'hair_style_name',
    p_order_data->>'eyeglasses_code',
    p_order_data->>'eyeglasses_name',
    p_order_data->>'character_asset_code',
    p_order_data->>'skin_tone',
    p_order_data->>'hair_color',
    p_order_data->>'outfit_color',
    COALESCE(p_order_data->>'parents_content','none'),
    COALESCE((p_order_data->>'requires_parents_nickname')::bool, false),
    COALESCE((p_order_data->>'requires_parents_nickname_video')::bool, COALESCE((p_order_data->>'requires_parents_nickname')::bool, false)),
    COALESCE((p_order_data->>'requires_parents_nickname_print')::bool, false),
    COALESCE((p_order_data->>'requires_parents_sweetname')::bool, false),
    p_order_data->>'mom_nickname',
    p_order_data->>'dad_nickname',
    p_order_data->>'mom_sweetname',
    p_order_data->>'dad_sweetname',
    p_order_data->>'special_notes',
    p_order_data->>'pronunciation_note'
  )
  RETURNING id INTO v_new_order_id;

  -- Mark code used hanya untuk kode pesanan normal. Trial code tetap reusable.
  IF NOT v_is_trial THEN
    UPDATE order_codes
    SET status = 'used', used_at = now(), updated_at = now()
    WHERE id = v_code_row.id;
  END IF;

  RETURN jsonb_build_object(
    'order_id', v_new_order_id,
    'public_order_id', v_public_order_id
  );
END;
$$;

-- ============================================================
-- 14. SEED DATA — contoh tema agar UI tidak kosong
-- ============================================================
INSERT INTO themes (
  theme_code, name, gender, parents_content,
  requires_parents_nickname, requires_parents_nickname_video, requires_parents_nickname_print,
  requires_parents_sweetname, is_active
)
VALUES
  ('PRG001', 'Princess Garden', 'girl', 'mom_and_dad', true, true, false, false, true),
  ('SPK001', 'Superhero Kingdom', 'boy', 'single_mom', true, true, false, true, true),
  ('UND001', 'Underwater Adventure', 'boy', 'none', false, false, false, false, true),
  ('FRY001', 'Fairy Forest', 'girl', 'single_father', true, true, false, false, true)
ON CONFLICT (theme_code) DO NOTHING;

INSERT INTO theme_package_codes (theme_id, package_code)
SELECT id, pc FROM themes
CROSS JOIN (VALUES ('HM'),('RG'),('ST'),('RL'),('SL')) AS p(pc)
ON CONFLICT DO NOTHING;
