import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { readJsonBody } from '@/lib/api';
import { sanitizeText, sanitizeUUID, sanitizeEnum, sanitizeInt } from '@/lib/sanitize';
import { createAdminClient } from '@/lib/supabase-admin';
import { GENDERS, type Gender } from '@/lib/constants';
import {
  deleteThemeCharacterObjects,
  makeVariantKey,
} from '@/lib/theme-character-variants';

function missingThemeVariantColumns(message: string): boolean {
  return message.includes('theme_character_variants');
}

async function unsetDefaultForGender(themeId: string, gender: Gender, exceptId?: string) {
  const supabase = createAdminClient();
  let query = supabase
    .from('theme_character_variants')
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq('theme_id', themeId)
    .eq('gender', gender);

  if (exceptId) query = query.neq('id', exceptId);

  const { error } = await query;
  if (error) throw error;
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const { searchParams } = new URL(req.url);
  const themeId = sanitizeUUID(searchParams.get('theme_id'));
  if (!themeId) return NextResponse.json({ error: 'Theme ID tidak valid.' }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('theme_character_variants')
    .select('*')
    .eq('theme_id', themeId)
    .order('gender')
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    const message = missingThemeVariantColumns(error.message)
      ? 'Database belum punya tabel karakter tema. Jalankan supabase/theme_character_variants_migration.sql dulu.'
      : error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const parsed = await readJsonBody<Record<string, unknown>>(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const themeId = sanitizeUUID(body.theme_id);
  const gender = sanitizeEnum(body.gender, GENDERS);
  const hairTypeLabel = sanitizeText(body.hair_type_label, 40);
  const faceAttributeLabel = sanitizeText(body.face_attribute_label, 40);
  const variantName = sanitizeText(body.variant_name, 80) || null;
  const imageUrl = sanitizeText(body.image_url, 500);
  const storagePath = sanitizeText(body.storage_path, 500) || null;
  const displayOrder = sanitizeInt(body.display_order, 0, 9999) ?? 0;
  const isDefault = !!body.is_default;

  if (!themeId || !gender || !hairTypeLabel || !faceAttributeLabel || !imageUrl) {
    return NextResponse.json(
      { error: 'Theme, gender, Hair Type, Face Attribute, dan gambar karakter wajib diisi.' },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const row = {
    theme_id: themeId,
    gender,
    hair_type_label: hairTypeLabel,
    hair_type_key: makeVariantKey(hairTypeLabel),
    face_attribute_label: faceAttributeLabel,
    face_attribute_key: makeVariantKey(faceAttributeLabel),
    variant_name: variantName,
    image_url: imageUrl,
    storage_path: storagePath,
    is_default: isDefault,
    is_recommended: !!body.is_recommended,
    is_active: typeof body.is_active === 'boolean' ? body.is_active : true,
    display_order: displayOrder,
  };

  if (isDefault) {
    try {
      await unsetDefaultForGender(themeId, gender);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal mengatur default karakter.';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const { data, error } = await supabase
    .from('theme_character_variants')
    .insert(row)
    .select()
    .single();

  if (error) {
    const message = missingThemeVariantColumns(error.message)
      ? 'Database belum punya tabel karakter tema. Jalankan supabase/theme_character_variants_migration.sql dulu.'
      : error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const parsed = await readJsonBody<Record<string, unknown>>(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const id = sanitizeUUID(body.id);
  const themeId = sanitizeUUID(body.theme_id);
  const gender = sanitizeEnum(body.gender, GENDERS);
  if (!id || !themeId || !gender) {
    return NextResponse.json({ error: 'ID karakter tema tidak valid.' }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.hair_type_label === 'string') {
    const label = sanitizeText(body.hair_type_label, 40);
    updates.hair_type_label = label;
    updates.hair_type_key = makeVariantKey(label);
  }
  if (typeof body.face_attribute_label === 'string') {
    const label = sanitizeText(body.face_attribute_label, 40);
    updates.face_attribute_label = label;
    updates.face_attribute_key = makeVariantKey(label);
  }
  if (typeof body.variant_name === 'string') updates.variant_name = sanitizeText(body.variant_name, 80) || null;
  if (typeof body.image_url === 'string') updates.image_url = sanitizeText(body.image_url, 500);
  if (typeof body.storage_path === 'string') updates.storage_path = sanitizeText(body.storage_path, 500) || null;
  if (typeof body.is_default === 'boolean') updates.is_default = body.is_default;
  if (typeof body.is_recommended === 'boolean') updates.is_recommended = body.is_recommended;
  if (typeof body.is_active === 'boolean') updates.is_active = body.is_active;
  if (body.display_order !== undefined) updates.display_order = sanitizeInt(body.display_order, 0, 9999) ?? 0;

  if (updates.is_default === true) {
    try {
      await unsetDefaultForGender(themeId, gender, id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal mengatur default karakter.';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const supabase = createAdminClient();
  const { data: existingRow } = await supabase
    .from('theme_character_variants')
    .select('storage_path')
    .eq('id', id)
    .single();

  const { error } = await supabase.from('theme_character_variants').update(updates).eq('id', id);

  if (error) {
    const message = missingThemeVariantColumns(error.message)
      ? 'Database belum punya tabel karakter tema. Jalankan supabase/theme_character_variants_migration.sql dulu.'
      : error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (
    typeof updates.storage_path === 'string' &&
    existingRow?.storage_path &&
    existingRow.storage_path !== updates.storage_path
  ) {
    try {
      await deleteThemeCharacterObjects(supabase, [existingRow.storage_path]);
    } catch {
      // Storage cleanup is best effort after the database update succeeds.
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const parsed = await readJsonBody<Record<string, unknown>>(req);
  if (!parsed.ok) return parsed.response;
  const id = sanitizeUUID(parsed.body.id);
  if (!id) return NextResponse.json({ error: 'ID karakter tema tidak valid.' }, { status: 400 });

  const supabase = createAdminClient();
  const { data: row, error: findError } = await supabase
    .from('theme_character_variants')
    .select('storage_path')
    .eq('id', id)
    .single();

  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 });

  const { error } = await supabase.from('theme_character_variants').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    await deleteThemeCharacterObjects(supabase, [row?.storage_path]);
  } catch {
    // Deleting storage is best effort; the database row is the source of truth.
  }

  return NextResponse.json({ ok: true });
}
