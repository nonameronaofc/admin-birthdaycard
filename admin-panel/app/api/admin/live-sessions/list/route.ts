import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const supabase = createAdminClient();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');

  let query = supabase
    .from('live_sessions')
    .select('*')
    .order('started_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Hitung kode per sesi
  const sessionIds = (data ?? []).map((s) => s.id);
  if (sessionIds.length === 0) return NextResponse.json({ data: [] });

  const { data: codes } = await supabase
    .from('order_codes')
    .select('live_session_id, status')
    .in('live_session_id', sessionIds);

  const stats: Record<string, { total: number; unused: number; used: number; expired: number }> = {};
  (codes ?? []).forEach((c) => {
    if (!c.live_session_id) return;
    if (!stats[c.live_session_id]) stats[c.live_session_id] = { total: 0, unused: 0, used: 0, expired: 0 };
    stats[c.live_session_id].total++;
    if (c.status === 'unused') stats[c.live_session_id].unused++;
    else if (c.status === 'used') stats[c.live_session_id].used++;
    else if (c.status === 'expired') stats[c.live_session_id].expired++;
  });

  const enriched = (data ?? []).map((s) => ({
    ...s,
    code_stats: stats[s.id] || { total: 0, unused: 0, used: 0, expired: 0 },
  }));

  return NextResponse.json({ data: enriched });
}
