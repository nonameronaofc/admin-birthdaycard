import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { sanitizeText, sanitizeEnum } from '@/lib/sanitize';
import { readJsonBody } from '@/lib/api';
import { parseThemeTags } from '@/lib/theme-filters';
import {
  GENDERS, PARENTS_CONTENTS, PACKAGE_CODES, type PackageCode,
} from '@/lib/constants';
import {
  deleteThemeStorageObjects,
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

  const themeCode = sanitizeText(body.theme_code, 50).toUpperCase();
  const name = sanitizeText(body.name, 100);
  const gender = sanitizeEnum(body.gender, GENDERS);
  const parentsContent = sanitizeEnum(body.parents_content, PARENTS_CONTENTS);
  const requiresParentsNicknameVideo = parentsContent !== 'none' && !!body.requires_parents_nickname_video;
  const requiresParentsNicknamePrint = parentsContent !== 'none' && !!body.requires_parents_nickname_print;
  const requiresParentsNickname = parentsContent !== 'none' && (
    requiresParentsNicknameVideo ||
    requiresParentsNicknamePrint ||
    !!body.requires_parents_nickname
  );
  const requiresParentsSweetname = parentsContent !== 'none' && !!body.requires_parents_sweetname;
  const styleTags = parseThemeTags(body.style_tags);
  const colorTags = parseThemeTags(body.color_tags);
  const moodTags = parseThemeTags(body.mood_tags);
  const displayPriority = typeof body.display_priority === 'number'
    ? body.display_priority
    : parseInt(String(body.display_priority ?? 0), 10);
  const themeImages = sanitizeThemeImages(body.theme_images);
  const packageCodes: PackageCode[] = Array.isArray(body.package_codes)
    ? (body.package_codes as unknown[]).filter((p): p is PackageCode =>
        typeof p === 'string' && (PACKAGE_CODES as readonly string[]).includes(p))
    : [];

  if (!themeCode || !name || !gender || !parentsContent) {
    return NextResponse.json(
      { error: 'theme_code, name, gender, dan parents_content wajib diisi.' },
      { status: 400 }
    );
  }
  if (packageCodes.length === 0) {
    return NextResponse.json(
      { error: 'Pilih minimal 1 package code untuk tema ini.' },
      { status: 400 }
    );
  }
  if (themeImages.length < MIN_THEME_IMAGES) {
    return NextResponse.json(
      { error: `Tema wajib punya minimal ${MIN_THEME_IMAGES} foto.` },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data: theme, error: themeError } = await supabase
    .from('themes')
    .insert({
      theme_code: themeCode,
      name,
      gender,
      parents_content: parentsContent,
      requires_parents_nickname: requiresParentsNickname,
      requires_parents_nickname_video: requiresParentsNicknameVideo || (!!body.requires_parents_nickname && !requiresParentsNicknamePrint),
      requires_parents_nickname_print: requiresParentsNicknamePrint,
      requires_parents_sweetname: requiresParentsSweetname,
      style_tags: styleTags,
      color_tags: colorTags,
      mood_tags: moodTags,
      is_recommended: !!body.is_recommended,
      display_priority: Number.isFinite(displayPriority) ? displayPriority : 0,
      image_url: themeImages[0]?.image_url ?? null,
      is_active: true,
    })
    .select()
    .single();

  if (themeError) {
    await deleteThemeStorageObjects(supabase, themeImages.map((image) => image.storage_path));
    if (
      themeError.message.includes('requires_parents_nickname_video') ||
      themeError.message.includes('requires_parents_nickname_print')
    ) {
      return NextResponse.json(
        { error: 'Database belum punya kolom scope nickname. Jalankan supabase/nickname_usage_migration.sql dulu.' },
        { status: 500 }
      );
    }
    if (
      themeError.message.includes('style_tags') ||
      themeError.message.includes('color_tags') ||
      themeError.message.includes('mood_tags') ||
      themeError.message.includes('is_recommended') ||
      themeError.message.includes('display_priority')
    ) {
      return NextResponse.json(
        { error: 'Database belum punya kolom filter tema. Jalankan supabase/theme_filter_tags_migration.sql dulu.' },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: themeError.message }, { status: 500 });
  }

  // Insert relasi package codes
  const relRows = packageCodes.map((pc) => ({ theme_id: theme.id, package_code: pc }));
  const { error: relError } = await supabase.from('theme_package_codes').insert(relRows);
  if (relError) {
    // Rollback: hapus theme yang baru dibuat
    await supabase.from('themes').delete().eq('id', theme.id);
    await deleteThemeStorageObjects(supabase, themeImages.map((image) => image.storage_path));
    return NextResponse.json({ error: relError.message }, { status: 500 });
  }

  try {
    await syncThemeImages(supabase, theme.id, themeImages);
  } catch (syncError) {
    await supabase.from('theme_package_codes').delete().eq('theme_id', theme.id);
    await supabase.from('themes').delete().eq('id', theme.id);
    await deleteThemeStorageObjects(supabase, themeImages.map((image) => image.storage_path));
    const rawMessage = syncError instanceof Error ? syncError.message : 'Gagal menyimpan galeri tema.';
    const message = rawMessage.includes('theme_images')
      ? 'Fitur foto tema butuh update database. Jalankan ulang schema.sql di Supabase lalu coba lagi.'
      : rawMessage;
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ data: theme });
}
