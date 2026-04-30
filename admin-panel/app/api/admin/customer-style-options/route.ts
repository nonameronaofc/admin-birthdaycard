import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-admin';

const CODE_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const HAIR_CODES = CODE_LETTERS.map((letter) => `H${letter}`);
const EYEGLASSES_CODES = CODE_LETTERS.map((letter) => `E${letter}`);
const ALL_CODES = {
  hair: HAIR_CODES,
  eyeglasses: EYEGLASSES_CODES,
} as const;

type OptionType = keyof typeof ALL_CODES;

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function normalizeCodes(type: OptionType, input: unknown) {
  if (!Array.isArray(input)) return null;
  const allowed = new Set<string>(ALL_CODES[type]);
  const unique = new Set<string>();
  input.forEach((value) => {
    const code = String(value ?? '').toUpperCase();
    if (allowed.has(code)) unique.add(code);
  });
  return unique;
}

function seedRows(type: OptionType) {
  return ALL_CODES[type].map((code, index) => ({
    option_type: type,
    option_code: code,
    is_visible: true,
    sort_order: index,
  }));
}

export async function GET() {
  const guard = await requireAdmin();
  if (guard) return guard;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('customer_style_options')
    .select('option_type, option_code, is_visible, sort_order')
    .order('option_type')
    .order('sort_order');

  if (error) {
    return NextResponse.json({
      hair: seedRows('hair').map((row) => ({ code: row.option_code, is_visible: true })),
      eyeglasses: seedRows('eyeglasses').map((row) => ({ code: row.option_code, is_visible: true })),
      needs_schema_update: true,
    });
  }

  const existing = new Set((data ?? []).map((row) => `${row.option_type}:${row.option_code}`));
  const missingRows = [...seedRows('hair'), ...seedRows('eyeglasses')].filter(
    (row) => !existing.has(`${row.option_type}:${row.option_code}`)
  );

  if (missingRows.length > 0) {
    await supabase.from('customer_style_options').upsert(missingRows, {
      onConflict: 'option_type,option_code',
    });
  }

  const rows = [...(data ?? []), ...missingRows];
  return NextResponse.json({
    hair: rows
      .filter((row) => row.option_type === 'hair')
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((row) => ({ code: row.option_code, is_visible: row.is_visible })),
    eyeglasses: rows
      .filter((row) => row.option_type === 'eyeglasses')
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((row) => ({ code: row.option_code, is_visible: row.is_visible })),
  });
}

export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const body = await req.json();
  const visibleHair = normalizeCodes('hair', body.visible_hair_codes);
  const visibleEyeglasses = normalizeCodes('eyeglasses', body.visible_eyeglasses_codes);

  if (!visibleHair || !visibleEyeglasses) {
    return badRequest('Payload visibilitas tidak valid.');
  }
  if (visibleHair.size === 0) return badRequest('Minimal satu hair style harus tampil.');
  if (visibleEyeglasses.size === 0) return badRequest('Minimal satu eyeglasses harus tampil.');

  const now = new Date().toISOString();
  const rows = [
    ...ALL_CODES.hair.map((code, index) => ({
      option_type: 'hair',
      option_code: code,
      is_visible: visibleHair.has(code),
      sort_order: index,
      updated_at: now,
    })),
    ...ALL_CODES.eyeglasses.map((code, index) => ({
      option_type: 'eyeglasses',
      option_code: code,
      is_visible: visibleEyeglasses.has(code),
      sort_order: index,
      updated_at: now,
    })),
  ];

  const supabase = createAdminClient();
  const { error } = await supabase.from('customer_style_options').upsert(rows, {
    onConflict: 'option_type,option_code',
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
