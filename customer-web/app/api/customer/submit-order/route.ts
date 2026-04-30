import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import {
  validateOrderCode,
  validateCustomerName,
  validateEmail,
  validateChildNickname,
  validateChildFullName,
  validateBirthdayNumber,
  validateGender,
  validateHair,
  validateEye,
  validateParentsContent,
  validateParentNickname,
  validateParentSweetname,
} from '@/lib/validation';
import {
  buildAssetCode,
  LIVE_PACKAGES,
  PACKAGE_LABELS,
  type Gender,
  type PackageCode,
} from '@/lib/constants';

function validateWhatsappFull(raw: string) {
  const v = (raw || '').trim();
  if (!/^\d{8,15}$/.test(v)) {
    return { ok: false, error: 'Nomor WhatsApp lengkap (kode negara + nomor) harus 8-15 digit angka.' };
  }
  return { ok: true as const };
}

function formatDateOnly(input: Date): string {
  const yyyy = input.getFullYear().toString();
  const mm = String(input.getMonth() + 1).padStart(2, '0');
  const dd = String(input.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function generatePublicOrderId(packageCode: PackageCode): string {
  const now = new Date();
  const yyyy = now.getFullYear().toString();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const HH = String(now.getHours()).padStart(2, '0');
  const MM = String(now.getMinutes()).padStart(2, '0');
  const SS = String(now.getSeconds()).padStart(2, '0');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  let random5 = '';
  for (let i = 0; i < 5; i++) {
    random5 += chars[Math.floor(Math.random() * chars.length)];
  }

  return `${packageCode}-${yyyy}${mm}${dd}-${HH}${MM}${SS}-${random5}`;
}

export const runtime = 'nodejs';

type Payload = {
  order_code: string;
  theme_code: string;
  nama_pemesan: string;
  whatsapp_full: string;
  email?: string | null;
  nickname_anak: string;
  nama_lengkap_anak: string;
  usia_anak: string;
  character_gender: Gender;
  birthday_number: number;
  hair_style_code: string;
  eyeglasses_code: string;
  parents_content: string;
  mom_nickname?: string | null;
  dad_nickname?: string | null;
  mom_sweetname?: string | null;
  dad_sweetname?: string | null;
  // optional fields per spec
  tanggal_acara?: string;
  deadline_dibutuhkan?: string;
  skin_tone?: string;
  hair_color?: string;
  outfit_color?: string;
  special_notes?: string;
  pronunciation_note?: string;
};

function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function isCustomerVisibleStyle(
  supabase: ReturnType<typeof getServerSupabase>,
  optionType: 'hair' | 'eyeglasses',
  optionCode: string
) {
  const { data, error } = await supabase
    .from('customer_style_options')
    .select('is_visible')
    .eq('option_type', optionType)
    .eq('option_code', optionCode)
    .maybeSingle();

  if (error || !data) return true;
  return !!data.is_visible;
}

export async function POST(req: NextRequest) {
  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return err('Invalid JSON body.');
  }

  // ============ FIELD-LEVEL VALIDATION ============
  const checks = [
    validateOrderCode(body.order_code),
    validateCustomerName(body.nama_pemesan),
    validateWhatsappFull(body.whatsapp_full),
    validateEmail(body.email || ''),
    validateChildNickname(body.nickname_anak),
    validateChildFullName(body.nama_lengkap_anak),
    validateBirthdayNumber(body.birthday_number),
    validateGender(body.character_gender),
    validateHair(body.hair_style_code),
    validateEye(body.eyeglasses_code),
    validateParentsContent(body.parents_content),
  ];
  for (const c of checks) {
    if (!c.ok) return err(c.error || 'Validasi gagal.');
  }
  if (!body.theme_code) return err('Tema wajib dipilih.');

  const supabase = getServerSupabase();
  const packageCode = body.order_code.slice(0, 2) as PackageCode;
  const packageLabel = PACKAGE_LABELS[packageCode];

  const [hairVisible, eyeglassesVisible] = await Promise.all([
    isCustomerVisibleStyle(supabase, 'hair', body.hair_style_code),
    isCustomerVisibleStyle(supabase, 'eyeglasses', body.eyeglasses_code),
  ]);
  if (!hairVisible || !eyeglassesVisible) {
    return err('Pilihan hair style atau eyeglasses sudah tidak tersedia untuk customer.');
  }

  // ============ THEME VALIDATION ============
  const { data: theme, error: themeErr } = await supabase
    .from('themes')
    .select('*')
    .eq('theme_code', body.theme_code)
    .maybeSingle();
  if (themeErr) return err('Gagal memeriksa tema.', 500);
  if (!theme || !theme.is_active) {
    return err('Tema tidak ditemukan atau sudah nonaktif.');
  }
  if (theme.gender !== body.character_gender) {
    return err('Gender tema tidak cocok dengan gender karakter.');
  }
  if (theme.parents_content !== body.parents_content) {
    return err('Parents content tema tidak cocok.');
  }

  // theme_package_codes check
  const pkgPrefix = body.order_code.slice(0, 2);
  const { data: pkgRow } = await supabase
    .from('theme_package_codes')
    .select('id')
    .eq('theme_id', theme.id)
    .eq('package_code', pkgPrefix)
    .maybeSingle();
  if (!pkgRow) return err('Tema tidak tersedia untuk paket ini.');

  // ============ PARENTS REQUIREMENT ============
  const hasNewNicknameScope =
    typeof theme.requires_parents_nickname_video === 'boolean' ||
    typeof theme.requires_parents_nickname_print === 'boolean';
  const requiresParentsNicknameVideo = hasNewNicknameScope
    ? !!theme.requires_parents_nickname_video
    : !!theme.requires_parents_nickname;
  const requiresParentsNicknamePrint = !!theme.requires_parents_nickname_print;
  const requiresParentsNickname =
    requiresParentsNicknameVideo ||
    requiresParentsNicknamePrint ||
    !!theme.requires_parents_nickname;

  if (requiresParentsNickname) {
    if (body.parents_content === 'single_mom') {
      const c = validateParentNickname(body.mom_nickname || '', 'mom');
      if (!c.ok) return err(c.error!);
    } else if (body.parents_content === 'single_father') {
      const c = validateParentNickname(body.dad_nickname || '', 'dad');
      if (!c.ok) return err(c.error!);
    } else if (body.parents_content === 'mom_and_dad') {
      const m = validateParentNickname(body.mom_nickname || '', 'mom');
      if (!m.ok) return err(m.error!);
      const d = validateParentNickname(body.dad_nickname || '', 'dad');
      if (!d.ok) return err(d.error!);
    }
  }

  if (theme.requires_parents_sweetname) {
    if (body.parents_content === 'single_mom') {
      const c = validateParentSweetname(body.mom_sweetname || '', 'mom');
      if (!c.ok) return err(c.error!);
    } else if (body.parents_content === 'single_father') {
      const c = validateParentSweetname(body.dad_sweetname || '', 'dad');
      if (!c.ok) return err(c.error!);
    } else if (body.parents_content === 'mom_and_dad') {
      const m = validateParentSweetname(body.mom_sweetname || '', 'mom');
      if (!m.ok) return err(m.error!);
      const d = validateParentSweetname(body.dad_sweetname || '', 'dad');
      if (!d.ok) return err(d.error!);
    }
  }

  // ============ CHARACTER ASSET CHECK ============
  const assetCode = buildAssetCode(
    body.character_gender,
    body.hair_style_code,
    body.eyeglasses_code
  );
  const { data: asset } = await supabase
    .from('character_assets')
    .select('id, asset_code, is_active')
    .eq('gender', body.character_gender)
    .eq('hair_style_code', body.hair_style_code)
    .eq('eyeglasses_code', body.eyeglasses_code)
    .eq('is_active', true)
    .maybeSingle();
  if (!asset) {
    return err('Kombinasi character asset (gender + hair + glasses) tidak tersedia.');
  }

  let liveSessionName: string | null = null;
  if (LIVE_PACKAGES.includes(packageCode)) {
    const { data: codeRow, error: codeRowErr } = await supabase
      .from('order_codes')
      .select('live_session_id')
      .eq('code', body.order_code)
      .maybeSingle();
    if (codeRowErr) return err('Gagal memeriksa live session.', 500);

    if (codeRow?.live_session_id) {
      const { data: session, error: sessionErr } = await supabase
        .from('live_sessions')
        .select('name')
        .eq('id', codeRow.live_session_id)
        .maybeSingle();
      if (sessionErr) return err('Gagal memuat nama live session.', 500);
      liveSessionName = session?.name || null;
    }
  }

  // ============ ATOMIC SUBMIT ============
  const today = formatDateOnly(new Date());
  const orderData = {
    public_order_id: generatePublicOrderId(packageCode),
    order_code: body.order_code,
    package_label: packageLabel,
    live_session_name: liveSessionName,
    theme_code: body.theme_code,
    theme_name: theme.name,
    theme_id: theme.id,
    nama_pemesan: body.nama_pemesan.trim(),
    whatsapp_full: body.whatsapp_full,
    email: (body.email || '').trim() || null,
    nickname_anak: body.nickname_anak.trim(),
    nama_lengkap_anak: body.nama_lengkap_anak,
    usia_anak: body.usia_anak,
    character_gender: body.character_gender,
    birthday_number: body.birthday_number,
    hair_style_code: body.hair_style_code,
    hair_style_name: body.hair_style_code,
    eyeglasses_code: body.eyeglasses_code,
    eyeglasses_name: body.eyeglasses_code,
    character_asset_code: assetCode,
    parents_content: body.parents_content,
    requires_parents_nickname: requiresParentsNickname,
    requires_parents_nickname_video: requiresParentsNicknameVideo,
    requires_parents_nickname_print: requiresParentsNicknamePrint,
    requires_parents_sweetname: !!theme.requires_parents_sweetname,
    mom_nickname: body.mom_nickname || null,
    dad_nickname: body.dad_nickname || null,
    mom_sweetname: body.mom_sweetname || null,
    dad_sweetname: body.dad_sweetname || null,
    tanggal_acara: body.tanggal_acara || today,
    deadline_dibutuhkan: body.deadline_dibutuhkan || today,
    skin_tone: body.skin_tone || null,
    hair_color: body.hair_color || null,
    outfit_color: body.outfit_color || null,
    special_notes: body.special_notes || null,
    pronunciation_note: body.pronunciation_note || null,
  };

  const { data: result, error: rpcErr } = await supabase.rpc(
    'submit_order_atomic',
    { p_order_data: orderData }
  );

  if (rpcErr) {
    return err(`Gagal submit order: ${rpcErr.message}`, 500);
  }

  return NextResponse.json({
    ok: true,
    public_order_id: result?.public_order_id || result?.[0]?.public_order_id,
  });
}
