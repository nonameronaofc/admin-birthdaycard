import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { readJsonBody } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase-admin';
import { PACKAGE_CODES, TRIAL_CODE_REGEX, type PackageCode } from '@/lib/constants';
import { sanitizeEnum, sanitizeText, sanitizeUUID } from '@/lib/sanitize';

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function normalizeCode(input: unknown) {
  return sanitizeText(input, 32).toUpperCase();
}

async function readSettings(supabase: ReturnType<typeof createAdminClient>) {
  const { data } = await supabase
    .from('admin_settings')
    .select('value_json')
    .eq('key', 'trial_order_settings')
    .maybeSingle();

  const value = data?.value_json as { enabled?: boolean } | null | undefined;
  return { enabled: value?.enabled === true };
}

export async function GET() {
  const guard = await requireAdmin();
  if (guard) return guard;

  const supabase = createAdminClient();
  const [settings, codes] = await Promise.all([
    readSettings(supabase),
    supabase
      .from('trial_codes')
      .select('id, code, label, package_code, is_active, notes, created_at, updated_at')
      .order('created_at', { ascending: false }),
  ]);

  if (codes.error) return bad(codes.error.message, 500);
  return NextResponse.json({ settings, data: codes.data || [] });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const parsed = await readJsonBody<Record<string, unknown>>(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const code = normalizeCode(body.code);
  const packageCode = sanitizeEnum<PackageCode>(body.package_code, PACKAGE_CODES);
  const label = sanitizeText(body.label, 80) || null;
  const notes = sanitizeText(body.notes, 300) || null;
  const isActive = body.is_active !== false;

  if (!TRIAL_CODE_REGEX.test(code)) {
    return bad('Kode trial harus 3-32 karakter: huruf besar, angka, underscore, atau strip.');
  }
  if (!packageCode) return bad('Package code trial tidak valid.');

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('trial_codes')
    .insert({
      code,
      package_code: packageCode,
      label,
      notes,
      is_active: isActive,
    })
    .select('id, code, label, package_code, is_active, notes, created_at, updated_at')
    .single();

  if (error) return bad(error.message, 500);
  return NextResponse.json({ ok: true, data });
}

export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const parsed = await readJsonBody<Record<string, unknown>>(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;
  const supabase = createAdminClient();

  if (body.settings && typeof body.settings === 'object') {
    const settings = body.settings as { enabled?: unknown };
    const enabled = settings.enabled === true;
    const { error } = await supabase
      .from('admin_settings')
      .upsert({
        key: 'trial_order_settings',
        value_json: { enabled },
        updated_at: new Date().toISOString(),
      });
    if (error) return bad(error.message, 500);
    return NextResponse.json({ ok: true, settings: { enabled } });
  }

  const id = sanitizeUUID(body.id);
  if (!id) return bad('ID kode trial tidak valid.');

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.code !== 'undefined') {
    const code = normalizeCode(body.code);
    if (!TRIAL_CODE_REGEX.test(code)) {
      return bad('Kode trial harus 3-32 karakter: huruf besar, angka, underscore, atau strip.');
    }
    update.code = code;
  }
  if (typeof body.package_code !== 'undefined') {
    const packageCode = sanitizeEnum<PackageCode>(body.package_code, PACKAGE_CODES);
    if (!packageCode) return bad('Package code trial tidak valid.');
    update.package_code = packageCode;
  }
  if (typeof body.label !== 'undefined') update.label = sanitizeText(body.label, 80) || null;
  if (typeof body.notes !== 'undefined') update.notes = sanitizeText(body.notes, 300) || null;
  if (typeof body.is_active !== 'undefined') update.is_active = body.is_active === true;

  const { data, error } = await supabase
    .from('trial_codes')
    .update(update)
    .eq('id', id)
    .select('id, code, label, package_code, is_active, notes, created_at, updated_at')
    .single();

  if (error) return bad(error.message, 500);
  return NextResponse.json({ ok: true, data });
}

export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const parsed = await readJsonBody<Record<string, unknown>>(req);
  if (!parsed.ok) return parsed.response;
  const id = sanitizeUUID(parsed.body.id);
  if (!id) return bad('ID kode trial tidak valid.');

  const supabase = createAdminClient();
  const { error } = await supabase.from('trial_codes').delete().eq('id', id);
  if (error) return bad(error.message, 500);
  return NextResponse.json({ ok: true });
}
