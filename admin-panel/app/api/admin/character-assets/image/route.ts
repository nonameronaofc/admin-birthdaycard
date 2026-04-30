import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { sanitizeText } from '@/lib/sanitize';
import { CHARACTER_ASSET_BUCKET, ensureCharacterAssetBucket } from '@/lib/character-assets';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function getFileExtension(file: File): string {
  const fromName = file.name.split('.').pop()?.trim().toLowerCase();
  if (fromName) return fromName;

  const fromType = file.type.split('/').pop()?.trim().toLowerCase();
  return fromType || 'jpg';
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const formData = await req.formData();
  const assetCode = sanitizeText(formData.get('asset_code'), 50).toUpperCase();
  const file = formData.get('file');

  if (!assetCode) {
    return NextResponse.json({ error: 'Asset code wajib tersedia sebelum upload gambar.' }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Pilih 1 file gambar.' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: `Format file ${file.name} tidak didukung.` }, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    await ensureCharacterAssetBucket(supabase);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bucket character asset gagal disiapkan.';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const extension = getFileExtension(file);
  const storagePath = `characters/${assetCode}/${Date.now()}-${randomUUID()}.${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(CHARACTER_ASSET_BUCKET)
    .upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data } = supabase.storage.from(CHARACTER_ASSET_BUCKET).getPublicUrl(storagePath);
  return NextResponse.json({
    data: {
      image_url: data.publicUrl,
      storage_path: storagePath,
    },
  });
}
