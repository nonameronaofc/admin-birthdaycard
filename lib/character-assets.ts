import type { SupabaseClient } from '@supabase/supabase-js';

export const CHARACTER_ASSET_BUCKET = 'character-assets';

export async function ensureCharacterAssetBucket(supabase: SupabaseClient) {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw error;

  const exists = (buckets ?? []).some((bucket) => bucket.name === CHARACTER_ASSET_BUCKET);
  if (!exists) {
    const { error: createError } = await supabase.storage.createBucket(CHARACTER_ASSET_BUCKET, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    });
    if (createError) throw createError;
  }
}
