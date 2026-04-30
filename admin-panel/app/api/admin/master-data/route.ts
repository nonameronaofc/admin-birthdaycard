import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { GENDERS, type Gender } from '@/lib/constants';
import {
  sanitizeEnum,
  sanitizeOptional,
  sanitizeText,
  sanitizeUUID,
} from '@/lib/sanitize';

type Resource = 'character_assets';

function parseResource(input: string | null): Resource | null {
  return input === 'character_assets' ? input : null;
}

function parseBoolean(input: unknown, fallback = true): boolean {
  if (typeof input === 'boolean') return input;
  if (input === 'true') return true;
  if (input === 'false') return false;
  return fallback;
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function isHairCode(input: string) {
  return /^H[A-Z]$/.test(input);
}

function isEyeglassesCode(input: string) {
  return /^E[A-Z]$/.test(input);
}

function buildAssetCode(gender: Gender, hairStyleCode: string, eyeglassesCode: string) {
  return `${gender.toUpperCase()}-${hairStyleCode}-${eyeglassesCode}`;
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const resource = parseResource(req.nextUrl.searchParams.get('resource'));
  if (!resource) return badRequest('Resource tidak valid.');

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(resource)
    .select('id, asset_code, gender, hair_style_code, eyeglasses_code, image_url, is_active, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (error) {
    if (error.message.includes('hair_style_code') || error.message.includes('eyeglasses_code')) {
      const fallback = await supabase
        .from(resource)
        .select('id, asset_code, gender, image_url, is_active, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (!fallback.error) {
        return NextResponse.json({
          data: (fallback.data ?? []).map((row) => {
            const parts = String(row.asset_code ?? '').split('-');
            return {
              ...row,
              hair_style_code: parts[1] ?? 'HA',
              eyeglasses_code: parts[2] ?? 'EA',
            };
          }),
          needs_schema_update: true,
        });
      }
    }

    return NextResponse.json({ error: 'Database character assets belum sinkron. Jalankan schema SQL terbaru.' }, { status: 500 });
  }
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const body = await req.json();
  const resource = parseResource(body.resource);
  if (!resource) return badRequest('Resource tidak valid.');

  const row = cleanCharacterAssetRow(body.values ?? {}, false);
  if (row instanceof NextResponse) return row;

  const supabase = createAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from(resource)
    .select('id, asset_code')
    .eq('asset_code', row.asset_code)
    .maybeSingle();

  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
  if (existing) {
    return NextResponse.json(
      { error: 'Asset code sudah ada.', conflict: existing },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from(resource)
    .insert(row)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const body = await req.json();
  const resource = parseResource(body.resource);
  const id = sanitizeUUID(body.id);
  const action = sanitizeText(body.action, 30);

  if (!resource) return badRequest('Resource tidak valid.');
  if (!id) return badRequest('ID tidak valid.');

  const supabase = createAdminClient();

  if (action === 'deactivate' || action === 'reactivate') {
    const { error } = await supabase
      .from(resource)
      .update({
        is_active: action === 'reactivate',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const row = cleanCharacterAssetRow(body.values ?? {}, true);
  if (row instanceof NextResponse) return row;

  const { data, error } = await supabase
    .from(resource)
    .update({
      ...row,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

function cleanCharacterAssetRow(
  values: Record<string, unknown>,
  isUpdate: boolean
): Record<string, unknown> | NextResponse {
  const gender = sanitizeEnum<Gender>(values.gender, GENDERS);
  const hairStyleCode = sanitizeText(values.hair_style_code, 2).toUpperCase();
  const eyeglassesCode = sanitizeText(values.eyeglasses_code, 2).toUpperCase();
  const imageUrl = sanitizeOptional(values.image_url, 500);
  const assetCode = sanitizeText(values.asset_code, 30).toUpperCase();

  if (!gender) return badRequest('Gender tidak valid.');
  if (!isHairCode(hairStyleCode)) return badRequest('Hair style code harus HA-HZ.');
  if (!isEyeglassesCode(eyeglassesCode)) return badRequest('Eyeglasses code harus EA-EZ.');
  if (!imageUrl) return badRequest('Image URL wajib diisi.');

  const expectedAssetCode = buildAssetCode(gender, hairStyleCode, eyeglassesCode);
  if (!assetCode || assetCode !== expectedAssetCode) {
    return badRequest(`Asset code harus ${expectedAssetCode}.`);
  }

  return {
    ...(!isUpdate ? { asset_code: expectedAssetCode } : {}),
    gender,
    hair_style_code: hairStyleCode,
    eyeglasses_code: eyeglassesCode,
    image_url: imageUrl,
    is_active: parseBoolean(values.is_active, true),
  };
}
