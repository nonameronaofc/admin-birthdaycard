import type { SupabaseClient } from '@supabase/supabase-js';
import { sanitizeText } from './sanitize';

export const THEME_CHARACTER_BUCKET = 'theme-character-variants';
export const MAX_THEME_CHARACTER_IMAGE_BYTES = 10 * 1024 * 1024;
export const THEME_CHARACTER_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

export function makeVariantKey(input: unknown): string {
  const clean = sanitizeText(input, 40)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return clean || 'default';
}

export function variantStorageFolder(themeCode: string, gender: string, hairKey: string, faceKey: string): string {
  return [
    'theme-characters',
    sanitizeText(themeCode, 50).toUpperCase() || 'THEME',
    sanitizeText(gender, 20).toLowerCase() || 'gender',
    `${makeVariantKey(hairKey)}-${makeVariantKey(faceKey)}`,
  ].join('/');
}

export async function ensureThemeCharacterBucket(supabase: SupabaseClient) {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw error;

  const exists = (buckets ?? []).some((bucket) => bucket.name === THEME_CHARACTER_BUCKET);
  if (!exists) {
    const { error: createError } = await supabase.storage.createBucket(THEME_CHARACTER_BUCKET, {
      public: true,
      fileSizeLimit: MAX_THEME_CHARACTER_IMAGE_BYTES,
      allowedMimeTypes: [...THEME_CHARACTER_ALLOWED_TYPES],
    });
    if (createError) throw createError;
  }
}

export async function deleteThemeCharacterObjects(
  supabase: SupabaseClient,
  storagePaths: (string | null | undefined)[]
) {
  const uniquePaths = [...new Set(
    storagePaths
      .map((path) => (typeof path === 'string' ? path.trim() : ''))
      .filter(Boolean)
  )];

  if (uniquePaths.length === 0) return;

  const { error } = await supabase.storage.from(THEME_CHARACTER_BUCKET).remove(uniquePaths);
  if (error) throw error;
}
