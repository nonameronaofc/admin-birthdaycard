import { NextRequest, NextResponse } from 'next/server';
import { requireOwner, writeAuditLog } from '@/lib/owner-access';
import { createAdminClient } from '@/lib/supabase-admin';
import { PACKAGE_CODES, PACKAGE_PRICES, type PackageCode } from '@/lib/constants';
import { isRevenueAuthed } from '@/lib/revenue-auth';

type Period = 'today' | 'week' | 'month' | 'all';

function parsePeriod(value: string | null): Period {
  if (value === 'today' || value === 'week' || value === 'month' || value === 'all') return value;
  return 'today';
}

function startOfLocalDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function getRange(period: Period) {
  const now = new Date();

  if (period === 'all') return { from: null as Date | null, to: now };
  if (period === 'today') return { from: startOfLocalDay(now), to: now };
  if (period === 'week') {
    const from = startOfLocalDay(now);
    from.setDate(from.getDate() - 6);
    return { from, to: now };
  }

  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  from.setHours(0, 0, 0, 0);
  return { from, to: now };
}

export async function GET(req: NextRequest) {
  const guard = await requireOwner();
  if (guard) return guard;

  if (!isRevenueAuthed()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const period = parsePeriod(searchParams.get('period'));
  const { from, to } = getRange(period);
  const supabase = createAdminClient();

  const { data: targetRow, error: targetError } = await supabase
    .from('owner_settings')
    .select('value_json')
    .eq('key', 'revenue_target')
    .maybeSingle();

  if (targetError) return NextResponse.json({ error: targetError.message }, { status: 500 });

  let query = supabase
    .from('orders')
    .select('id, public_order_id, order_code, package_code, nama_pemesan, theme_code, created_at')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  if (from) query = query.gte('created_at', from.toISOString());
  query = query.lte('created_at', to.toISOString());

  const { data, error } = await query.limit(5000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const orders = (data || [])
    .map((order) => {
      const packageCode = String(order.package_code || '').toUpperCase() as PackageCode;
      if (!PACKAGE_CODES.includes(packageCode)) return null;
      return {
        id: String(order.id),
        public_order_id: String(order.public_order_id || ''),
        order_code: String(order.order_code || ''),
        package_code: packageCode,
        nama_pemesan: String(order.nama_pemesan || ''),
        theme_code: String(order.theme_code || ''),
        created_at: String(order.created_at || ''),
        price: PACKAGE_PRICES[packageCode],
      };
    })
    .filter(Boolean) as Array<{
      id: string;
      public_order_id: string;
      order_code: string;
      package_code: PackageCode;
      nama_pemesan: string;
      theme_code: string;
      created_at: string;
      price: number;
    }>;

  const byPackage = Object.fromEntries(
    PACKAGE_CODES.map((code) => [code, { count: 0, revenue: 0 }])
  ) as Record<PackageCode, { count: number; revenue: number }>;

  let totalRevenue = 0;
  for (const order of orders) {
    byPackage[order.package_code].count += 1;
    byPackage[order.package_code].revenue += order.price;
    totalRevenue += order.price;
  }

  return NextResponse.json({
    ok: true,
    updated_at: new Date().toISOString(),
    period,
    target_amount: Number(targetRow?.value_json?.amount || 0),
    totals: {
      count: orders.length,
      revenue: totalRevenue,
      by_package: byPackage,
    },
    latest_orders: orders.slice(0, 24),
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireOwner();
  if (guard) return guard;

  if (!isRevenueAuthed()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { target_amount?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const targetAmount = Number(body.target_amount);
  if (!Number.isFinite(targetAmount) || targetAmount < 0) {
    return NextResponse.json({ error: 'Target pendapatan harus angka 0 atau lebih.' }, { status: 400 });
  }

  const rounded = Math.round(targetAmount);
  const supabase = createAdminClient();
  const { error } = await supabase.from('owner_settings').upsert(
    {
      key: 'revenue_target',
      value_json: { amount: rounded },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog({
    actionType: 'owner_revenue_target_update',
    metadata: { target_amount: rounded },
  });

  return NextResponse.json({ ok: true, target_amount: rounded });
}
