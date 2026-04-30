import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { validateOrderCode } from '@/lib/validation';
import { LIVE_PACKAGES, PACKAGE_LABELS, type PackageCode } from '@/lib/constants';
import { isLocale, packageLabel, type Locale } from '@/lib/i18n';

export const runtime = 'nodejs';

type Body = {
  code?: string;
  device_key?: string;
  admin_validation_code?: string;
  locale?: Locale;
};

function msg(locale: Locale, id: string, en: string) {
  return locale === 'en' ? en : id;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const code = (body.code || '').trim().toUpperCase();
  const locale: Locale = isLocale(body.locale) ? body.locale : 'id';
  const codeCheck = validateOrderCode(code, locale);
  if (!codeCheck.ok) {
    return NextResponse.json(
      { error: codeCheck.error, hint: codeCheck.hint, example: codeCheck.example },
      { status: 400 }
    );
  }

  const supabase = getServerSupabase();

  // Cek kode di table order_codes
  const { data: codeRow, error: codeErr } = await supabase
    .from('order_codes')
    .select('id, code, package_code, status, live_session_id')
    .eq('code', code)
    .maybeSingle();

  if (codeErr) {
    return NextResponse.json({ error: msg(locale, 'Gagal memeriksa kode.', 'Failed to check the code.') }, { status: 500 });
  }
  if (!codeRow) {
    return NextResponse.json({ error: msg(locale, 'Kode pesanan tidak ditemukan.', 'Order code was not found.') }, { status: 404 });
  }
  if (codeRow.status === 'used') {
    return NextResponse.json({ error: msg(locale, 'Kode ini sudah digunakan.', 'This code has already been used.') }, { status: 409 });
  }
  if (codeRow.status === 'expired' || codeRow.status === 'inactive') {
    return NextResponse.json(
      { error: msg(locale, 'Kode ini sudah tidak berlaku. Silakan hubungi admin untuk mendapatkan kode baru.', 'This code is no longer valid. Please contact admin to get a new code.') },
      { status: 410 }
    );
  }

  const pkg = codeRow.package_code as PackageCode;
  let liveSessionId: string | null = null;
  let liveSessionName: string | null = null;

  if (LIVE_PACKAGES.includes(pkg)) {
    if (!codeRow.live_session_id) {
      return NextResponse.json(
        { error: msg(locale, 'Live session sudah ditutup. Kode tidak bisa digunakan lagi.', 'The live session has ended. This code can no longer be used.') },
        { status: 410 }
      );
    }
    const { data: session } = await supabase
      .from('live_sessions')
      .select('id, name, status')
      .eq('id', codeRow.live_session_id)
      .maybeSingle();
    if (!session || session.status !== 'active') {
      return NextResponse.json(
        { error: msg(locale, 'Live session sudah ditutup. Kode tidak bisa digunakan lagi.', 'The live session has ended. This code can no longer be used.') },
        { status: 410 }
      );
    }
    liveSessionId = session.id;
    liveSessionName = session.name;
  }

  return NextResponse.json({
    valid: true,
    package_code: pkg,
    package_label: packageLabel(pkg, PACKAGE_LABELS[pkg], locale),
    live_session_id: liveSessionId,
    live_session_name: liveSessionName,
  });
}
