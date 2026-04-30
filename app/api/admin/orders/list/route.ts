import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const supabase = createAdminClient();
  const { searchParams } = new URL(req.url);

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') || '20', 10));
  const status = searchParams.get('status');
  const packageCode = searchParams.get('package_code');
  const downloadStatus = searchParams.get('download_status');
  const liveSessionId = searchParams.get('live_session_id');
  const search = searchParams.get('search')?.trim();

  let query = supabase
    .from('orders')
    .select('*', { count: 'exact' })
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (packageCode) query = query.eq('package_code', packageCode);
  if (downloadStatus) query = query.eq('download_status', downloadStatus);
  if (liveSessionId) query = query.eq('live_session_id', liveSessionId);
  if (search) {
    query = query.or(
      `public_order_id.ilike.%${search}%,order_code.ilike.%${search}%,nama_pemesan.ilike.%${search}%,whatsapp_full.ilike.%${search}%,nickname_anak.ilike.%${search}%`
    );
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data,
    total: count ?? 0,
    page,
    pageSize,
    totalPages: count ? Math.ceil(count / pageSize) : 0,
  });
}
