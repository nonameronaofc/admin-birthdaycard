import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import {
  GENDERS,
  PACKAGE_CODES,
  PARENTS_CONTENTS,
  type Gender,
  type PackageCode,
  type ParentsContent,
} from '@/lib/constants';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const gender = searchParams.get('gender') as Gender | null;
  const parentsContent = searchParams.get('parents_content') as ParentsContent | null;
  const packageCode = searchParams.get('package_code') as PackageCode | null;

  if (!gender || !GENDERS.includes(gender)) {
    return NextResponse.json({ error: 'Gender tidak valid.' }, { status: 400 });
  }
  if (!parentsContent || !PARENTS_CONTENTS.includes(parentsContent)) {
    return NextResponse.json({ error: 'Parents content tidak valid.' }, { status: 400 });
  }
  if (!packageCode || !PACKAGE_CODES.includes(packageCode)) {
    return NextResponse.json({ error: 'Package code tidak valid.' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  const { data: packageRows, error: packageError } = await supabase
    .from('theme_package_codes')
    .select('theme_id')
    .eq('package_code', packageCode);

  if (packageError) {
    return NextResponse.json({ error: 'Gagal memuat relasi paket tema.' }, { status: 500 });
  }

  const eligibleIds = (packageRows || []).map((row) => row.theme_id);
  if (eligibleIds.length === 0) {
    return NextResponse.json({ themes: [] });
  }

  const { data: themes, error: themesError } = await supabase
    .from('themes')
    .select('*')
    .in('id', eligibleIds)
    .eq('gender', gender)
    .eq('parents_content', parentsContent)
    .eq('is_active', true)
    .order('name');

  if (themesError) {
    return NextResponse.json({ error: 'Gagal memuat tema.' }, { status: 500 });
  }
  if (!themes || themes.length === 0) {
    return NextResponse.json({ themes: [] });
  }

  const themeIds = themes.map((theme) => theme.id);
  const { data: images, error: imagesError } = await supabase
    .from('theme_images')
    .select('id, theme_id, image_url, display_order')
    .in('theme_id', themeIds)
    .order('display_order');

  if (imagesError) {
    return NextResponse.json({ error: 'Gagal memuat gambar tema.' }, { status: 500 });
  }

  const imagesByTheme = new Map<string, { id: string; image_url: string; position: number }[]>();
  (images || []).forEach((image) => {
    const row = {
      id: image.id,
      image_url: image.image_url,
      position: image.display_order,
    };
    const existing = imagesByTheme.get(image.theme_id) || [];
    imagesByTheme.set(image.theme_id, [...existing, row]);
  });

  return NextResponse.json({
    themes: themes.map((theme) => {
      const themeImages = (imagesByTheme.get(theme.id) || []).slice(0, 3);
      return {
        id: theme.id,
        theme_code: theme.theme_code,
        name: theme.name,
        gender: theme.gender,
        parents_content: theme.parents_content,
        requires_parents_nickname: !!theme.requires_parents_nickname,
        requires_parents_nickname_video: typeof theme.requires_parents_nickname_video === 'boolean'
          ? theme.requires_parents_nickname_video
          : !!theme.requires_parents_nickname,
        requires_parents_nickname_print: !!theme.requires_parents_nickname_print,
        requires_parents_sweetname: !!theme.requires_parents_sweetname,
        image_url: theme.image_url,
        is_active: theme.is_active,
        images: themeImages.length > 0
          ? themeImages
          : theme.image_url
            ? [{ id: theme.id, image_url: theme.image_url, position: 0 }]
            : [],
      };
    }),
  });
}
