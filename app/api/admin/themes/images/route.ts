import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { sanitizeText } from '@/lib/sanitize';
import {
  deleteThemeStorageObjects,
  ensureThemeBucket,
  MAX_THEME_IMAGES,
  THEME_IMAGE_BUCKET,
} from '@/lib/theme-images';

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
  const themeCode = sanitizeText(formData.get('theme_code'), 50).toUpperCase();
  const existingCount = Math.max(0, Number(formData.get('existing_count') || 0));
  const files = formData.getAll('files').filter((file): file is File => file instanceof File);

  if (!themeCode) {
    return NextResponse.json({ error: 'Theme code wajib diisi sebelum upload foto.' }, { status: 400 });
  }
  if (files.length === 0) {
    return NextResponse.json({ error: 'Pilih minimal 1 file gambar.' }, { status: 400 });
  }
  if (existingCount + files.length > MAX_THEME_IMAGES) {
    return NextResponse.json({ error: `Maksimal ${MAX_THEME_IMAGES} foto per tema.` }, { status: 400 });
  }

  const invalidFile = files.find((file) => !ALLOWED_TYPES.has(file.type));
  if (invalidFile) {
    return NextResponse.json({ error: `Format file ${invalidFile.name} tidak didukung.` }, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    await ensureThemeBucket(supabase);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bucket tema gagal disiapkan.';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const uploaded: { image_url: string; storage_path: string }[] = [];

  try {
    for (const file of files) {
      const extension = getFileExtension(file);
      const storagePath = `themes/${themeCode}/${Date.now()}-${randomUUID()}.${extension}`;
      const bytes = Buffer.from(await file.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from(THEME_IMAGE_BUCKET)
        .upload(storagePath, bytes, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(THEME_IMAGE_BUCKET).getPublicUrl(storagePath);
      uploaded.push({
        image_url: data.publicUrl,
        storage_path: storagePath,
      });
    }
  } catch (error) {
    await deleteThemeStorageObjects(supabase, uploaded.map((image) => image.storage_path));
    const message = error instanceof Error ? error.message : 'Upload gambar tema gagal.';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ data: uploaded });
}

export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const body = await req.json();
  const storagePaths = Array.isArray(body.storage_paths)
    ? body.storage_paths
        .map((path: unknown) => sanitizeText(path, 500))
        .filter((path: string): path is string => path.length > 0)
    : [];

  if (storagePaths.length === 0) {
    return NextResponse.json({ error: 'Tidak ada file yang dipilih untuk dihapus.' }, { status: 400 });
  }

  const supabase = createAdminClient();
  try {
    await deleteThemeStorageObjects(supabase, storagePaths);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal menghapus gambar tema.';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
