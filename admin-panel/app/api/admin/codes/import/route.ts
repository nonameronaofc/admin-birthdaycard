import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import {
  ORDER_CODE_REGEX,
  PACKAGE_CODES,
  type PackageCode,
  isLivePackage,
} from '@/lib/constants';
import { sanitizeUUID, sanitizeEnum } from '@/lib/sanitize';

interface ImportResult {
  total: number;
  inserted: number;
  rejected: { code: string; reason: string }[];
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const body = await req.json();
  const codes: unknown = body.codes;
  const expectedPackage = sanitizeEnum<PackageCode>(body.package_code, PACKAGE_CODES);
  const liveSessionId = body.live_session_id ? sanitizeUUID(body.live_session_id) : null;

  if (!Array.isArray(codes) || codes.length === 0) {
    return NextResponse.json({ error: 'Daftar kode kosong.' }, { status: 400 });
  }
  if (!expectedPackage) {
    return NextResponse.json({ error: 'Package code tidak valid.' }, { status: 400 });
  }
  if (isLivePackage(expectedPackage) && !liveSessionId) {
    return NextResponse.json(
      { error: 'Kode RL/SL wajib dipasangkan dengan live session.' },
      { status: 400 }
    );
  }
  if (!isLivePackage(expectedPackage) && liveSessionId) {
    return NextResponse.json(
      { error: 'Paket normal (HM/RG/ST) tidak boleh punya live_session_id.' },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Validasi sesi live aktif
  if (liveSessionId) {
    const { data: session } = await supabase
      .from('live_sessions').select('status').eq('id', liveSessionId).single();
    if (!session || session.status !== 'active') {
      return NextResponse.json(
        { error: 'Live session tidak ditemukan atau tidak aktif.' },
        { status: 400 }
      );
    }
  }

  const result: ImportResult = { total: codes.length, inserted: 0, rejected: [] };
  const validRows: { code: string; package_code: string; live_session_id: string | null }[] = [];

  // Validasi tiap kode
  for (const raw of codes) {
    const code = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
    if (!code) {
      result.rejected.push({ code: String(raw), reason: 'Kosong' });
      continue;
    }
    if (!ORDER_CODE_REGEX.test(code)) {
      result.rejected.push({ code, reason: 'Format kode salah' });
      continue;
    }
    const prefix = code.substring(0, 2) as PackageCode;
    if (prefix !== expectedPackage) {
      result.rejected.push({
        code,
        reason: `Prefix ${prefix} tidak cocok dengan paket ${expectedPackage}`,
      });
      continue;
    }
    validRows.push({
      code,
      package_code: prefix,
      live_session_id: liveSessionId,
    });
  }

  // Cek duplikat di database
  if (validRows.length > 0) {
    const codesArray = validRows.map((v) => v.code);
    const { data: existing } = await supabase
      .from('order_codes').select('code').in('code', codesArray);
    const existingSet = new Set((existing ?? []).map((e) => e.code));

    const toInsert = validRows.filter((v) => {
      if (existingSet.has(v.code)) {
        result.rejected.push({ code: v.code, reason: 'Sudah ada di database' });
        return false;
      }
      return true;
    });

    // Cek duplikat dalam batch yang sama
    const seen = new Set<string>();
    const finalInsert = toInsert.filter((v) => {
      if (seen.has(v.code)) {
        result.rejected.push({ code: v.code, reason: 'Duplikat dalam file' });
        return false;
      }
      seen.add(v.code);
      return true;
    });

    if (finalInsert.length > 0) {
      const { error: insertError, count } = await supabase
        .from('order_codes').insert(finalInsert, { count: 'exact' });
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
      result.inserted = count ?? finalInsert.length;
    }
  }

  return NextResponse.json(result);
}
