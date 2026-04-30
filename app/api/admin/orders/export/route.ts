import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { sanitizeEnum, sanitizeUUID, sanitizeDate } from '@/lib/sanitize';

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const body = await req.json();
  const exportType = sanitizeEnum(body.export_type, ['daily_export', 'live_session_export'] as const);
  const fileFormat = sanitizeEnum(body.file_format, ['csv', 'json'] as const);
  if (!exportType || !fileFormat) {
    return NextResponse.json({ error: 'Parameter export_type / file_format tidak valid.' }, { status: 400 });
  }

  const supabase = createAdminClient();
  let query = supabase.from('orders').select('*').eq('is_deleted', false);

  let filename = '';
  let liveSessionId: string | null = null;
  let exportDate: string | null = null;

  if (exportType === 'daily_export') {
    const date = sanitizeDate(body.date);
    if (!date) return NextResponse.json({ error: 'Tanggal tidak valid (YYYY-MM-DD).' }, { status: 400 });
    exportDate = date;
    query = query
      .gte('created_at', `${date}T00:00:00`)
      .lte('created_at', `${date}T23:59:59.999`);
    filename = `orders_daily_${date}.${fileFormat}`;
  } else {
    liveSessionId = sanitizeUUID(body.live_session_id);
    if (!liveSessionId) {
      return NextResponse.json({ error: 'live_session_id tidak valid.' }, { status: 400 });
    }
    query = query.eq('live_session_id', liveSessionId);

    const { data: session } = await supabase
      .from('live_sessions').select('name, started_at').eq('id', liveSessionId).single();

    const slug = (session?.name ?? 'session').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const dateStr = (session?.started_at ?? new Date().toISOString()).substring(0, 10);
    exportDate = dateStr;
    filename = `orders_live_${slug}_${dateStr}.${fileFormat}`;
  }

  const { data, error } = await query.order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Generate batch ID + tandai downloaded
  const batchId = crypto.randomUUID();
  if (data && data.length > 0) {
    const ids = data.map((o) => o.id);
    await supabase.from('orders').update({
      download_status: 'downloaded',
      downloaded_at: new Date().toISOString(),
      download_batch_id: batchId,
    }).in('id', ids);

    // Log export
    await supabase.from('export_logs').insert({
      export_type: exportType,
      live_session_id: liveSessionId,
      export_date: exportDate,
      file_format: fileFormat,
      total_orders: data.length,
    });
  }

  // Build file
  const records = data ?? [];
  let content: string;
  let contentType: string;

  if (fileFormat === 'csv') {
    content = Papa.unparse(records);
    contentType = 'text/csv; charset=utf-8';
  } else {
    content = JSON.stringify(records, null, 2);
    contentType = 'application/json; charset=utf-8';
  }

  return new NextResponse(content, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
