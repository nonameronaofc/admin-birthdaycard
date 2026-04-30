import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const supabase = createAdminClient();
  const { searchParams } = new URL(req.url);

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const pageSize = Math.min(200, parseInt(searchParams.get('pageSize') || '50', 10));
  const status = searchParams.get('status');
  const packageCode = searchParams.get('package_code');
  const liveSessionId = searchParams.get('live_session_id');
  const search = searchParams.get('search')?.trim();

  let query = supabase
    .from('order_codes')
    .select('*, live_sessions(name, status)', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (packageCode) query = query.eq('package_code', packageCode);
  if (liveSessionId) query = query.eq('live_session_id', liveSessionId);
  if (search) query = query.ilike('code', `%${search}%`);

  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    data, total: count ?? 0, page, pageSize,
    totalPages: count ? Math.ceil(count / pageSize) : 0,
  });
}
