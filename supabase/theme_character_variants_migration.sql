-- Karakter per tema untuk konsep character builder customer.
-- Jalankan di Supabase SQL Editor jika database sudah pernah dibuat sebelum tabel ini ada di schema.sql.

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
