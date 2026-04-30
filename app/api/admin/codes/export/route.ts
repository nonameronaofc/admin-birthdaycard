import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const supabase = createAdminClient();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const packageCode = searchParams.get('package_code');
  const format = searchParams.get('format') === 'json' ? 'json' : 'csv';

  let query = supabase
    .from('order_codes')
    .select('code, package_code, status, live_session_id, used_at, created_at')
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (packageCode) query = query.eq('package_code', packageCode);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const records = data ?? [];
  const dateStr = new Date().toISOString().substring(0, 10);
  const filename = `order_codes_${dateStr}.${format}`;

  if (format === 'csv') {
    return new NextResponse(Papa.unparse(records), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  }
  return new NextResponse(JSON.stringify(records, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
