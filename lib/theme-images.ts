import type { SupabaseClient } from '@supabase/supabase-js';
import { sanitizeText } from './sanitize';

export const THEME_IMAGE_BUCKET = 'theme-previews';
export const MAX_THEME_IMAGES = 3;
export const MIN_THEME_IMAGES = 1;

export interface ThemeImageInput {
  image_url: string;
  storage_path: string | null;
}

interface ExistingThemeImageRow extends ThemeImageInput {
  id: string;
}

export function sanitizeThemeImages(input: unknown): ThemeImageInput[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const imageUrl = sanitizeText(row.image_url, 500);
      const storagePathRaw = row.storage_path;
      const storagePath = typeof storagePathRaw === 'string'
        ? sanitizeText(storagePathRaw, 500) || null
        : null;

      if (!imageUrl) return null;
      return {
        image_url: imageUrl,
        storage_path: storagePath,
      };
    })
    .filter((item): item is ThemeImageInput => item !== null);
}

export async function ensureThemeBucket(supabase: SupabaseClient) {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw error;

  const exists = (buckets ?? []).some((bucket) => bucket.name === THEME_IMAGE_BUCKET);
  if (!exists) {
    const { error: createError } = await supabase.storage.createBucket(THEME_IMAGE_BUCKET, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    });
    if (createError) throw createError;
  }
}

export async function deleteThemeStorageObjects(
  supabase: SupabaseClient,
  storagePaths: (string | null | undefined)[]
) {
  const uniquePaths = [...new Set(
    storagePaths
      .map((path) => (typeof path === 'string' ? path.trim() : ''))
      .filter(Boolean)
  )];

  if (uniquePaths.length === 0) return;

  const { error } = await supabase.storage.from(THEME_IMAGE_BUCKET).remove(uniquePaths);
  if (error) throw error;
}

export async function syncThemeImages(
  supabase: SupabaseClient,
  themeId: string,
  images: ThemeImageInput[]
) {
  const normalizedImages = images.slice(0, MAX_THEME_IMAGES);

  const { data: existingRows, error: existingError } = await supabase
    .from('theme_images')
    .select('id, image_url, storage_path')
    .eq('theme_id', themeId);

  if (existingError) throw existingError;

  const existing = (existingRows ?? []) as ExistingThemeImageRow[];
  const nextPaths = new Set(
    normalizedImages
      .map((image) => image.storage_path)
      .filter((path): path is string => typeof path === 'string' && path.length > 0)
  );

  const pathsToDelete = existing
    .filter((row) => row.storage_path && !nextPaths.has(row.storage_path))
    .map((row) => row.storage_path);

  await supabase.from('theme_images').delete().eq('theme_id', themeId);

  if (normalizedImages.length > 0) {
    const rows = normalizedImages.map((image, index) => ({
      theme_id: themeId,
      image_url: image.image_url,
      storage_path: image.storage_path,
      display_order: index,
    }));

    const { error: insertError } = await supabase.from('theme_images').insert(rows);
    if (insertError) throw insertError;
  }

  const { error: updateThemeError } = await supabase
    .from('themes')
    .update({
      image_url: normalizedImages[0]?.image_url ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', themeId);

  if (updateThemeError) throw updateThemeError;

  await deleteThemeStorageObjects(supabase, pathsToDelete);
}
