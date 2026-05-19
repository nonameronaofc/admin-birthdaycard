import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { logApiError } from '@/lib/logger';
import { escapeIlikePattern, sanitizeSearchTerm } from '@/lib/sanitize';

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
  const search = sanitizeSearchTerm(searchParams.get('search'));

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
    const escapedSearch = escapeIlikePattern(search);
    query = query.or(
      `public_order_id.ilike.%${escapedSearch}%,order_code.ilike.%${escapedSearch}%,trial_code.ilike.%${escapedSearch}%,nama_pemesan.ilike.%${escapedSearch}%,whatsapp_full.ilike.%${escapedSearch}%,nickname_anak.ilike.%${escapedSearch}%`
    );
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) {
    logApiError('admin.orders.list', error, {
      page,
      pageSize,
      status,
      packageCode,
      downloadStatus,
      liveSessionId,
      search,
    });
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
