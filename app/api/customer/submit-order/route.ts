import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import {
  ORDER_CODE_REGEX, PACKAGE_LABELS, getPackageCodeFromOrderCode,
  GENDERS, PARENTS_CONTENTS, type PackageCode,
} from '@/lib/constants';
import {
  sanitizeText, sanitizeOptional, sanitizeEmail, sanitizeWhatsApp,
  sanitizeDate, sanitizeInt, sanitizeEnum,
} from '@/lib/sanitize';
import { generatePublicOrderId } from '@/lib/order-id';

export async function POST(req: NextRequest) {
  const body = await req.json();

  // ============ SANITASI INPUT (bagian 18) ============
  const orderCode = sanitizeText(body.order_code, 20).toUpperCase();
  const themeCode = sanitizeText(body.theme_code, 50);
  const namaPemesan = sanitizeText(body.nama_pemesan, 100);
  const whatsappFull = sanitizeWhatsApp(body.whatsapp_full);
  const email = sanitizeEmail(body.email);
  const nicknameAnak = sanitizeText(body.nickname_anak, 50);
  const namaLengkapAnak = sanitizeText(body.nama_lengkap_anak, 100);
  const usiaAnak = sanitizeText(body.usia_anak, 30);
  const characterGender = sanitizeEnum(body.character_gender, GENDERS);
  const tanggalAcara = sanitizeDate(body.tanggal_acara);
  const deadlineDibutuhkan = sanitizeDate(body.deadline_dibutuhkan);
  const birthdayNumber = sanitizeInt(body.birthday_number, 1, 10);
  const hairStyleCode = sanitizeText(body.hair_style_code, 2).toUpperCase();
  const eyeglassesCode = sanitizeText(body.eyeglasses_code, 2).toUpperCase();
  const parentsContent = sanitizeEnum(body.parents_content, PARENTS_CONTENTS);

  // ============ VALIDASI WAJIB (bagian 14) ============
  if (!orderCode || !ORDER_CODE_REGEX.test(orderCode)) {
    return NextResponse.json({ error: 'Format kode pesanan tidak valid.' }, { status: 400 });
  }
  if (!themeCode) return NextResponse.json({ error: 'Tema wajib dipilih.' }, { status: 400 });
  if (!namaPemesan) return NextResponse.json({ error: 'Nama pemesan wajib diisi.' }, { status: 400 });
  if (!whatsappFull) return NextResponse.json({ error: 'Nomor WhatsApp tidak valid.' }, { status: 400 });
  if (!nicknameAnak) return NextResponse.json({ error: 'Nickname anak wajib diisi.' }, { status: 400 });
  if (!namaLengkapAnak) return NextResponse.json({ error: 'Nama lengkap anak wajib diisi.' }, { status: 400 });
  if (!usiaAnak) return NextResponse.json({ error: 'Usia anak wajib diisi.' }, { status: 400 });
  if (!characterGender) return NextResponse.json({ error: 'Gender karakter tidak valid.' }, { status: 400 });
  if (!tanggalAcara) return NextResponse.json({ error: 'Tanggal acara tidak valid.' }, { status: 400 });
  if (!deadlineDibutuhkan) return NextResponse.json({ error: 'Deadline tidak valid.' }, { status: 400 });
  if (birthdayNumber === null) return NextResponse.json({ error: 'Birthday number harus 1–10.' }, { status: 400 });
  if (!/^H[A-Z]$/.test(hairStyleCode)) {
    return NextResponse.json({ error: 'Hair style wajib HA-HZ.' }, { status: 400 });
  }
  if (!/^E[A-Z]$/.test(eyeglassesCode)) {
    return NextResponse.json({ error: 'Eyeglasses wajib EA-EZ.' }, { status: 400 });
  }
  if (!parentsContent) return NextResponse.json({ error: 'Parents content tidak valid.' }, { status: 400 });

  const packageCode = getPackageCodeFromOrderCode(orderCode);
  if (!packageCode) {
    return NextResponse.json({ error: 'Prefix kode tidak valid.' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // ============ VALIDASI MASTER DATA ============

  // Validasi tema (bagian 14)
  const { data: theme, error: themeError } = await supabase
    .from('themes')
    .select('*, theme_package_codes(package_code)')
    .eq('theme_code', themeCode)
    .eq('is_active', true)
    .maybeSingle();

  if (themeError || !theme) {
    return NextResponse.json({ error: 'Tema tidak ditemukan atau sudah nonaktif.' }, { status: 400 });
  }
  if (theme.gender !== characterGender) {
    return NextResponse.json({ error: 'Gender tema tidak cocok dengan gender karakter.' }, { status: 400 });
  }
  if (theme.parents_content !== parentsContent) {
    return NextResponse.json({ error: 'Parents content tema tidak cocok.' }, { status: 400 });
  }
  const themePackageCodes: string[] = (theme.theme_package_codes ?? []).map((p: { package_code: string }) => p.package_code);
  if (!themePackageCodes.includes(packageCode)) {
    return NextResponse.json({ error: 'Tema tidak tersedia untuk paket ini.' }, { status: 400 });
  }

  // Validasi parents nickname & sweetname sesuai parents_content
  const momNickname = sanitizeOptional(body.mom_nickname, 50);
  const dadNickname = sanitizeOptional(body.dad_nickname, 50);
  const momSweetname = sanitizeOptional(body.mom_sweetname, 50);
  const dadSweetname = sanitizeOptional(body.dad_sweetname, 50);

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
    if (parentsContent === 'single_mom' && !momNickname) {
      return NextResponse.json({ error: 'Mom nickname wajib diisi untuk tema ini.' }, { status: 400 });
    }
    if (parentsContent === 'single_father' && !dadNickname) {
      return NextResponse.json({ error: 'Dad nickname wajib diisi untuk tema ini.' }, { status: 400 });
    }
    if (parentsContent === 'mom_and_dad' && (!momNickname || !dadNickname)) {
      return NextResponse.json({ error: 'Mom & Dad nickname wajib diisi untuk tema ini.' }, { status: 400 });
    }
  }
  if (theme.requires_parents_sweetname) {
    if (parentsContent === 'single_mom' && !momSweetname) {
      return NextResponse.json({ error: 'Mom sweetname wajib diisi untuk tema ini.' }, { status: 400 });
    }
    if (parentsContent === 'single_father' && !dadSweetname) {
      return NextResponse.json({ error: 'Dad sweetname wajib diisi untuk tema ini.' }, { status: 400 });
    }
    if (parentsContent === 'mom_and_dad' && (!momSweetname || !dadSweetname)) {
      return NextResponse.json({ error: 'Mom & Dad sweetname wajib diisi untuk tema ini.' }, { status: 400 });
    }
  }

  // Validasi character asset
  const { data: asset } = await supabase
    .from('character_assets')
    .select('*')
    .eq('gender', characterGender)
    .eq('hair_style_code', hairStyleCode)
    .eq('eyeglasses_code', eyeglassesCode)
    .eq('is_active', true)
    .maybeSingle();

  if (!asset) {
    return NextResponse.json(
      { error: 'Kombinasi character asset (gender + hair + glasses) tidak tersedia.' },
      { status: 400 }
    );
  }

  // ============ SUBMIT ATOMIC (bagian 6) ============
  const publicOrderId = generatePublicOrderId(packageCode);

  const { data: liveSession } = packageCode === 'RL' || packageCode === 'SL'
    ? await supabase.from('live_sessions').select('name').eq('id', body.live_session_id).maybeSingle()
    : { data: null };

  const orderData = {
    public_order_id: publicOrderId,
    order_code: orderCode,
    package_label: PACKAGE_LABELS[packageCode],
    live_session_name: liveSession?.name ?? null,
    theme_code: theme.theme_code,
    theme_name: theme.name,
    nama_pemesan: namaPemesan,
    whatsapp_full: whatsappFull,
    email,
    nickname_anak: nicknameAnak,
    nama_lengkap_anak: namaLengkapAnak,
    usia_anak: usiaAnak,
    character_gender: characterGender,
    tanggal_acara: tanggalAcara,
    deadline_dibutuhkan: deadlineDibutuhkan,
    birthday_number: birthdayNumber,
    hair_style_code: hairStyleCode,
    hair_style_name: hairStyleCode,
    eyeglasses_code: eyeglassesCode,
    eyeglasses_name: eyeglassesCode,
    character_asset_code: asset.asset_code,
    skin_tone: sanitizeOptional(body.skin_tone, 50),
    hair_color: sanitizeOptional(body.hair_color, 50),
    outfit_color: sanitizeOptional(body.outfit_color, 50),
    parents_content: parentsContent,
    requires_parents_nickname: requiresParentsNickname,
    requires_parents_nickname_video: requiresParentsNicknameVideo,
    requires_parents_nickname_print: requiresParentsNicknamePrint,
    requires_parents_sweetname: theme.requires_parents_sweetname,
    mom_nickname: momNickname,
    dad_nickname: dadNickname,
    mom_sweetname: momSweetname,
    dad_sweetname: dadSweetname,
    special_notes: sanitizeOptional(body.special_notes, 1000),
    pronunciation_note: sanitizeOptional(body.pronunciation_note, 500),
  };

  const { data: result, error: submitError } = await supabase.rpc(
    'submit_order_atomic',
    { p_order_data: orderData }
  );

  if (submitError) {
    return NextResponse.json(
      { error: submitError.message || 'Gagal submit order.' },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    public_order_id: result?.public_order_id ?? publicOrderId,
  });
}
