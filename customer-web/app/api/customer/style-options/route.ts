import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { EYE_CODES, HAIR_CODES } from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function fallbackOptions() {
  return {
    hair_codes: HAIR_CODES,
    eyeglasses_codes: EYE_CODES,
  };
}

export async function GET() {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('customer_style_options')
    .select('option_type, option_code, is_visible, sort_order')
    .eq('is_visible', true)
    .order('sort_order');

  if (error) {
    return NextResponse.json(fallbackOptions());
  }

  const hairCodes = (data ?? [])
    .filter((row) => row.option_type === 'hair')
    .map((row) => row.option_code)
    .filter((code) => HAIR_CODES.includes(code));
  const eyeglassesCodes = (data ?? [])
    .filter((row) => row.option_type === 'eyeglasses')
    .map((row) => row.option_code)
    .filter((code) => EYE_CODES.includes(code));

  return NextResponse.json({
    hair_codes: hairCodes.length > 0 ? hairCodes : HAIR_CODES,
    eyeglasses_codes: eyeglassesCodes.length > 0 ? eyeglassesCodes : EYE_CODES,
  });
}
