-- Tambahan filter tema untuk customer-web.
-- Jalankan di Supabase SQL Editor jika database sudah pernah dibuat sebelum field ini ada di schema.sql.

ALTER TABLE themes ADD COLUMN IF NOT EXISTS style_tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE themes ADD COLUMN IF NOT EXISTS color_tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE themes ADD COLUMN IF NOT EXISTS mood_tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE themes ADD COLUMN IF NOT EXISTS is_recommended boolean NOT NULL DEFAULT false;
ALTER TABLE themes ADD COLUMN IF NOT EXISTS display_priority integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_themes_is_recommended ON themes(is_recommended);
CREATE INDEX IF NOT EXISTS idx_themes_display_priority ON themes(display_priority);
CREATE INDEX IF NOT EXISTS idx_themes_style_tags ON themes USING GIN(style_tags);
CREATE INDEX IF NOT EXISTS idx_themes_color_tags ON themes USING GIN(color_tags);
CREATE INDEX IF NOT EXISTS idx_themes_mood_tags ON themes USING GIN(mood_tags);
