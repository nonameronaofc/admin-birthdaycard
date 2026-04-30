import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const body = await req.json();
  const ids: unknown = body.ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'Daftar ID kosong.' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Hanya kode yang masih unused yang boleh di-expire
  // (status used dan expired tidak diubah — bagian 2 aturan irreversible)
  const { error, count } = await supabase
    .from('order_codes')
    .update({ status: 'expired', updated_at: new Date().toISOString() }, { count: 'exact' })
    .in('id', ids as string[])
    .eq('status', 'unused');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, expired: count ?? 0 });
}
