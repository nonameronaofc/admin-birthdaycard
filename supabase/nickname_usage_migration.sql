-- ============================================================
-- Nickname usage scope migration
-- ============================================================
-- Jalankan sekali di Supabase SQL Editor.
-- Legacy requires_parents_nickname dianggap sebagai "video saja".

ALTER TABLE themes
  ADD COLUMN IF NOT EXISTS requires_parents_nickname_video boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_parents_nickname_print boolean NOT NULL DEFAULT false;

UPDATE themes
SET requires_parents_nickname_video = true
WHERE requires_parents_nickname = true
  AND requires_parents_nickname_video = false
  AND requires_parents_nickname_print = false;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS requires_parents_nickname_video boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_parents_nickname_print boolean NOT NULL DEFAULT false;

UPDATE orders
SET requires_parents_nickname_video = true
WHERE requires_parents_nickname = true
  AND requires_parents_nickname_video = false
  AND requires_parents_nickname_print = false;

CREATE OR REPLACE FUNCTION submit_order_atomic(p_order_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_code text;
  v_code_row order_codes%ROWTYPE;
  v_session_status text;
  v_new_order_id uuid;
  v_public_order_id text;
BEGIN
  v_order_code := p_order_data->>'order_code';
  v_public_order_id := p_order_data->>'public_order_id';

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

  IF v_code_row.package_code IN ('RL','SL') THEN
    SELECT status INTO v_session_status
    FROM live_sessions WHERE id = v_code_row.live_session_id;

    IF v_session_status <> 'active' THEN
      RAISE EXCEPTION 'Live session sudah % - kode tidak bisa dipakai', v_session_status USING ERRCODE = 'P0003';
    END IF;
  END IF;

  INSERT INTO orders (
    public_order_id, order_code, package_code, package_label,
    live_session_id, live_session_name,
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
    v_code_row.package_code,
    p_order_data->>'package_label',
    v_code_row.live_session_id,
    p_order_data->>'live_session_name',
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

  UPDATE order_codes
  SET status = 'used', used_at = now(), updated_at = now()
  WHERE id = v_code_row.id;

  RETURN jsonb_build_object(
    'order_id', v_new_order_id,
    'public_order_id', v_public_order_id
  );
END;
$$;
