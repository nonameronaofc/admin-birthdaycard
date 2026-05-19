import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { sanitizeText, sanitizeEnum, sanitizeUUID, sanitizeInt } from '@/lib/sanitize';
import { readJsonBody } from '@/lib/api';
import { parseThemeTags } from '@/lib/theme-filters';
import {
  GENDERS, PARENTS_CONTENTS, PACKAGE_CODES, type PackageCode,
} from '@/lib/constants';
import {
  MIN_THEME_IMAGES,
  sanitizeThemeImages,
  syncThemeImages,
} from '@/lib/theme-images';

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const parsed = await readJsonBody<Record<string, unknown>>(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;
  const id = sanitizeUUID(body.id);
  if (!id) return NextResponse.json({ error: 'ID tema tidak valid.' }, { status: 400 });
  const themeImages = sanitizeThemeImages(body.theme_images);

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.name === 'string') updates.name = sanitizeText(body.name, 100);
  if (body.gender) updates.gender = sanitizeEnum(body.gender, GENDERS);
  if (body.parents_content) updates.parents_content = sanitizeEnum(body.parents_content, PARENTS_CONTENTS);
  const parentsContent = (updates.parents_content || body.parents_content) as string | undefined;
  const hasNicknameScope =
    typeof body.requires_parents_nickname_video === 'boolean' ||
    typeof body.requires_parents_nickname_print === 'boolean';
  if (hasNicknameScope || typeof body.requires_parents_nickname === 'boolean') {
    const video = parentsContent !== 'none' && (
      typeof body.requires_parents_nickname_video === 'boolean'
        ? body.requires_parents_nickname_video
        : !!body.requires_parents_nickname
    );
    const print = parentsContent !== 'none' && !!body.requires_parents_nickname_print;
    updates.requires_parents_nickname = video || print || (parentsContent !== 'none' && !!body.requires_parents_nickname);
    updates.requires_parents_nickname_video = video;
    updates.requires_parents_nickname_print = print;
  }
  if (typeof body.requires_parents_sweetname === 'boolean') {
    updates.requires_parents_sweetname = parentsContent !== 'none' && body.requires_parents_sweetname;
  }
  if (Array.isArray(body.style_tags)) updates.style_tags = parseThemeTags(body.style_tags);
  if (Array.isArray(body.color_tags)) updates.color_tags = parseThemeTags(body.color_tags);
  if (Array.isArray(body.mood_tags)) updates.mood_tags = parseThemeTags(body.mood_tags);
  if (typeof body.is_recommended === 'boolean') updates.is_recommended = body.is_recommended;
  if (body.display_priority !== undefined) {
    updates.display_priority = sanitizeInt(body.display_priority, -9999, 9999) ?? 0;
  }
  if (typeof body.is_active === 'boolean') updates.is_active = body.is_active;

  if (Array.isArray(body.theme_images)) {
    if (themeImages.length < MIN_THEME_IMAGES) {
      return NextResponse.json(
        { error: `Tema wajib punya minimal ${MIN_THEME_IMAGES} foto.` },
        { status: 400 }
      );
    }
    updates.image_url = themeImages[0]?.image_url ?? null;
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from('themes').update(updates).eq('id', id);
  if (error) {
    if (
      error.message.includes('requires_parents_nickname_video') ||
      error.message.includes('requires_parents_nickname_print')
    ) {
      return NextResponse.json(
        { error: 'Database belum punya kolom scope nickname. Jalankan supabase/nickname_usage_migration.sql dulu.' },
        { status: 500 }
      );
    }
    if (
      error.message.includes('style_tags') ||
      error.message.includes('color_tags') ||
      error.message.includes('mood_tags') ||
      error.message.includes('is_recommended') ||
      error.message.includes('display_priority')
    ) {
      return NextResponse.json(
        { error: 'Database belum punya kolom filter tema. Jalankan supabase/theme_filter_tags_migration.sql dulu.' },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Sync package codes jika dikirim
  if (Array.isArray(body.package_codes)) {
    const newPackageCodes: PackageCode[] = (body.package_codes as unknown[]).filter(
      (p): p is PackageCode =>
        typeof p === 'string' && (PACKAGE_CODES as readonly string[]).includes(p)
    );
    await supabase.from('theme_package_codes').delete().eq('theme_id', id);
    if (newPackageCodes.length > 0) {
      const rows = newPackageCodes.map((pc) => ({ theme_id: id, package_code: pc }));
      await supabase.from('theme_package_codes').insert(rows);
    }
  }

  if (Array.isArray(body.theme_images)) {
    try {
      await syncThemeImages(supabase, id, themeImages);
    } catch (syncError) {
      const rawMessage = syncError instanceof Error ? syncError.message : 'Gagal menyimpan galeri tema.';
      const message = rawMessage.includes('theme_images')
        ? 'Fitur foto tema butuh update database. Jalankan ulang schema.sql di Supabase lalu coba lagi.'
        : rawMessage;
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
