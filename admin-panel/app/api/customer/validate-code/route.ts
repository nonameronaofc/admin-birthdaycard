import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { ORDER_CODE_REGEX, PACKAGE_LABELS, type PackageCode } from '@/lib/constants';
import { sanitizeOptional, sanitizeText } from '@/lib/sanitize';

// Rate limit & anti brute force config (bagian 19)
const MAX_FAILED_ATTEMPTS = 5;
const BLOCK_DURATION_MS = 30 * 60 * 1000; // 30 menit

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real;
  return 'unknown';
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const code = sanitizeText(body.code, 20).toUpperCase();
  const deviceKey = sanitizeOptional(body.device_key, 100);
  const adminValidationCode = sanitizeOptional(body.admin_validation_code, 50)?.toUpperCase() ?? null;
  const ip = getClientIp(req);

  if (!code) {
    return NextResponse.json({ error: 'Kode pesanan kosong.' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Cek attempt record
  let attemptsQuery = supabase
    .from('code_attempts')
    .select('*')
    .eq('ip_address', ip);

  attemptsQuery = deviceKey
    ? attemptsQuery.eq('device_key', deviceKey)
    : attemptsQuery.is('device_key', null);

  let { data: attempts } = await attemptsQuery.maybeSingle();

  // Cek butuh validasi admin?
  if (attempts?.need_admin_validation) {
    if (!adminValidationCode) {
      return NextResponse.json({
        need_admin_validation: true,
        error: 'Anda telah mencapai batas percobaan. Hubungi admin untuk Kode Validasi Admin.',
      }, { status: 403 });
    }

    const validationError = await consumeAdminValidationCode(supabase, adminValidationCode);
    if (validationError) {
      return NextResponse.json({
        need_admin_validation: true,
        error: validationError,
      }, { status: 403 });
    }

    await supabase
      .from('code_attempts')
      .update({
        failed_attempt_count: 0,
        need_admin_validation: false,
        blocked_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', attempts.id);
    attempts = {
      ...attempts,
      failed_attempt_count: 0,
      need_admin_validation: false,
      blocked_until: null,
    };
  }

  // Cek apakah sedang diblokir
  if (attempts?.blocked_until && new Date(attempts.blocked_until) > new Date() && !adminValidationCode) {
    return NextResponse.json({
      error: 'Terlalu banyak percobaan. Silakan coba lagi beberapa saat.',
    }, { status: 429 });
  }

  // 1. Cek format regex
  if (!ORDER_CODE_REGEX.test(code)) {
    await recordFailedAttempt(supabase, ip, deviceKey, attempts);
    return NextResponse.json({ error: 'Format kode tidak valid.' }, { status: 400 });
  }

  // 2. Cek di database
  const { data: codeRow } = await supabase
    .from('order_codes')
    .select('*, live_sessions(id, name, status)')
    .eq('code', code)
    .maybeSingle();

  if (!codeRow) {
    await recordFailedAttempt(supabase, ip, deviceKey, attempts);
    return NextResponse.json({ error: 'Kode pesanan tidak ditemukan.' }, { status: 404 });
  }

  // 3. Cek status
  if (codeRow.status === 'used') {
    return NextResponse.json({ error: 'Kode ini sudah digunakan.' }, { status: 400 });
  }
  if (codeRow.status === 'expired') {
    return NextResponse.json({
      error: 'Kode ini sudah tidak berlaku. Silakan hubungi admin untuk mendapatkan kode baru.',
    }, { status: 400 });
  }

  // 4. Cek live session jika RL/SL
  if (codeRow.package_code === 'RL' || codeRow.package_code === 'SL') {
    if (!codeRow.live_sessions) {
      return NextResponse.json({ error: 'Live session tidak ditemukan.' }, { status: 400 });
    }
    if (codeRow.live_sessions.status !== 'active') {
      return NextResponse.json({
        error: 'Live session sudah ditutup. Kode tidak bisa digunakan lagi.',
      }, { status: 400 });
    }
  }

  // Reset failed attempt counter on success
  if (attempts && attempts.failed_attempt_count > 0) {
    await supabase
      .from('code_attempts')
      .update({ failed_attempt_count: 0, updated_at: new Date().toISOString() })
      .eq('id', attempts.id);
  }

  const pkg = codeRow.package_code as PackageCode;
  return NextResponse.json({
    valid: true,
    package_code: pkg,
    package_label: PACKAGE_LABELS[pkg],
    live_session_id: codeRow.live_session_id,
    live_session_name: codeRow.live_sessions?.name ?? null,
  });
}

async function recordFailedAttempt(
  supabase: ReturnType<typeof createAdminClient>,
  ip: string,
  deviceKey: string | null,
  existing: { id: string; failed_attempt_count: number } | null | undefined
) {
  const now = new Date().toISOString();
  const newCount = (existing?.failed_attempt_count ?? 0) + 1;
  const needAdmin = newCount >= MAX_FAILED_ATTEMPTS;
  const blockedUntil = needAdmin
    ? new Date(Date.now() + BLOCK_DURATION_MS).toISOString()
    : null;

  if (existing) {
    await supabase.from('code_attempts').update({
      failed_attempt_count: newCount,
      need_admin_validation: needAdmin,
      blocked_until: blockedUntil,
      last_attempt_at: now,
      updated_at: now,
    }).eq('id', existing.id);
  } else {
    await supabase.from('code_attempts').insert({
      ip_address: ip,
      device_key: deviceKey,
      failed_attempt_count: newCount,
      need_admin_validation: needAdmin,
      blocked_until: blockedUntil,
      last_attempt_at: now,
    });
  }
}

async function consumeAdminValidationCode(
  supabase: ReturnType<typeof createAdminClient>,
  code: string
): Promise<string | null> {
  const now = new Date();
  const { data: validationCode, error } = await supabase
    .from('admin_validation_codes')
    .select('*')
    .eq('code', code)
    .eq('status', 'active')
    .maybeSingle();

  if (error || !validationCode) return 'Kode Validasi Admin tidak valid.';
  if (validationCode.expired_at && new Date(validationCode.expired_at) < now) {
    await supabase
      .from('admin_validation_codes')
      .update({ status: 'expired', updated_at: now.toISOString() })
      .eq('id', validationCode.id);
    return 'Kode Validasi Admin sudah expired.';
  }
  if (validationCode.used_count >= validationCode.max_usage) {
    return 'Kode Validasi Admin sudah mencapai batas pemakaian.';
  }

  const { error: updateError } = await supabase
    .from('admin_validation_codes')
    .update({
      used_count: validationCode.used_count + 1,
      updated_at: now.toISOString(),
    })
    .eq('id', validationCode.id);

  return updateError ? 'Kode Validasi Admin gagal dipakai. Coba lagi.' : null;
}
