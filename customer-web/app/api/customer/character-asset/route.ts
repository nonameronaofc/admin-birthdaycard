import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { GENDERS, HAIR_REGEX, EYE_REGEX, type Gender } from '@/lib/constants';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const gender = searchParams.get('gender') as Gender | null;
  const hairStyleCode = (searchParams.get('hair_style_code') || '').toUpperCase();
  const eyeglassesCode = (searchParams.get('eyeglasses_code') || '').toUpperCase();

  if (!gender || !GENDERS.includes(gender)) {
    return NextResponse.json({ error: 'Gender tidak valid.' }, { status: 400 });
  }
  if (!HAIR_REGEX.test(hairStyleCode)) {
    return NextResponse.json({ error: 'Hair style code tidak valid.' }, { status: 400 });
  }
  if (!EYE_REGEX.test(eyeglassesCode)) {
    return NextResponse.json({ error: 'Eyeglasses code tidak valid.' }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('character_assets')
    .select('image_url')
    .eq('gender', gender)
    .eq('hair_style_code', hairStyleCode)
    .eq('eyeglasses_code', eyeglassesCode)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'Gagal memuat character asset.' }, { status: 500 });
  }

  return NextResponse.json({ image_url: data?.image_url || null });
}
