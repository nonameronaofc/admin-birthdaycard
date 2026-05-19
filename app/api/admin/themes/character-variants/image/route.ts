import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { readJsonBody } from '@/lib/api';
import { sanitizeText } from '@/lib/sanitize';
import { createAdminClient } from '@/lib/supabase-admin';
import {
  ensureThemeCharacterBucket,
  THEME_CHARACTER_ALLOWED_TYPES,
  THEME_CHARACTER_BUCKET,
  variantStorageFolder,
} from '@/lib/theme-character-variants';
import { GENDERS } from '@/lib/constants';

const ALLOWED_TYPES = new Set<string>(THEME_CHARACTER_ALLOWED_TYPES);

function getFileExtension(fileName: string, contentType: string): string {
  const fromName = fileName.split('.').pop()?.trim().toLowerCase();
  if (fromName) return fromName;

  const fromType = contentType.split('/').pop()?.trim().toLowerCase();
  return fromType || 'jpg';
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const parsed = await readJsonBody<{
    theme_code?: string;
    gender?: string;
    hair_type_label?: string;
    face_attribute_label?: string;
    file_name?: string;
    content_type?: string;
  }>(req, 'Request upload karakter tema tidak valid.');
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const themeCode = sanitizeText(body.theme_code, 50).toUpperCase();
  const gender = sanitizeText(body.gender, 20).toLowerCase();
  const hairTypeLabel = sanitizeText(body.hair_type_label, 40);
  const faceAttributeLabel = sanitizeText(body.face_attribute_label, 40);
  const fileName = sanitizeText(body.file_name, 160);
  const contentType = sanitizeText(body.content_type, 80);

  if (!themeCode) {
    return NextResponse.json({ error: 'Theme code wajib tersedia sebelum upload karakter.' }, { status: 400 });
  }
  if (!GENDERS.includes(gender as any)) {
    return NextResponse.json({ error: 'Gender karakter tidak valid.' }, { status: 400 });
  }
  if (!hairTypeLabel || !faceAttributeLabel) {
    return NextResponse.json({ error: 'Hair Type dan Face Attribute wajib diisi sebelum upload.' }, { status: 400 });
  }
  if (!fileName) {
    return NextResponse.json({ error: 'Nama file gambar tidak valid.' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json({ error: `Format file ${fileName} tidak didukung.` }, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    await ensureThemeCharacterBucket(supabase);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bucket karakter tema gagal disiapkan.';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const extension = getFileExtension(fileName, contentType);
  const folder = variantStorageFolder(themeCode, gender, hairTypeLabel, faceAttributeLabel);
  const storagePath = `${folder}/${Date.now()}-${randomUUID()}.${extension}`;

  const { data: signedUpload, error: signedError } = await supabase.storage
    .from(THEME_CHARACTER_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (signedError) {
    return NextResponse.json({ error: signedError.message }, { status: 500 });
  }

  const { data } = supabase.storage.from(THEME_CHARACTER_BUCKET).getPublicUrl(storagePath);
  return NextResponse.json({
    data: {
      image_url: data.publicUrl,
      storage_path: storagePath,
      token: signedUpload.token,
    },
  });
}
