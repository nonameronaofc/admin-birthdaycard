CREATE TABLE IF NOT EXISTS admin_settings (
  key text PRIMARY KEY,
  value_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

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

ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_trial boolean NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS trial_code_id uuid NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS trial_code text NULL;

CREATE INDEX IF NOT EXISTS idx_orders_is_trial ON orders(is_trial);
CREATE INDEX IF NOT EXISTS idx_orders_trial_code ON orders(trial_code);

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

  IF NOT v_is_trial AND v_package_code IN ('RL','SL') THEN
    SELECT status INTO v_session_status
    FROM live_sessions WHERE id = v_code_row.live_session_id;

    IF v_session_status <> 'active' THEN
      RAISE EXCEPTION 'Live session sudah % - kode tidak bisa dipakai', v_session_status USING ERRCODE = 'P0003';
    END IF;
  END IF;

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
