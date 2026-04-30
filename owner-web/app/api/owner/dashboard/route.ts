import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner-access';
import { createAdminClient } from '@/lib/supabase-admin';
import { INTERNAL_ROLES, INTERNAL_STATUSES, PACKAGE_CODES, PACKAGE_PRICES, type PackageCode } from '@/lib/constants';

function startOfLocalDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

export async function GET() {
  const guard = await requireOwner();
  if (guard) return guard;

  const supabase = createAdminClient();
  const now = new Date();
  const today = startOfLocalDay(now).toISOString();
  const month = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    usersResult,
    todayOrdersResult,
    allOrdersResult,
    monthOrdersResult,
    auditResult,
  ] = await Promise.all([
    supabase.from('internal_users').select('role,status'),
    supabase
      .from('orders')
      .select('package_code,created_at')
      .eq('is_deleted', false)
      .gte('created_at', today)
      .limit(5000),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('is_deleted', false),
    supabase
      .from('orders')
      .select('package_code,created_at')
      .eq('is_deleted', false)
      .gte('created_at', month)
      .limit(5000),
    supabase
      .from('owner_audit_logs')
      .select('id,actor_email,action_type,target_email,created_at')
      .order('created_at', { ascending: false })
      .limit(6),
  ]);

  if (usersResult.error) return NextResponse.json({ error: usersResult.error.message }, { status: 500 });
  if (todayOrdersResult.error) return NextResponse.json({ error: todayOrdersResult.error.message }, { status: 500 });
  if (allOrdersResult.error) return NextResponse.json({ error: allOrdersResult.error.message }, { status: 500 });
  if (monthOrdersResult.error) return NextResponse.json({ error: monthOrdersResult.error.message }, { status: 500 });
  if (auditResult.error) return NextResponse.json({ error: auditResult.error.message }, { status: 500 });

  const users = usersResult.data || [];
  const todayOrders = todayOrdersResult.data || [];
  const monthOrders = monthOrdersResult.data || [];

  const sumRevenue = (orders: Array<{ package_code: string | null }>) =>
    orders.reduce((total, order) => {
      const code = String(order.package_code || '').toUpperCase() as PackageCode;
      return PACKAGE_CODES.includes(code) ? total + PACKAGE_PRICES[code] : total;
    }, 0);

  return NextResponse.json({
    ok: true,
    users: {
      owners: users.filter((u) => u.role === 'owner').length,
      admins: users.filter((u) => u.role === 'admin').length,
      activeAdmins: users.filter((u) => u.role === 'admin' && u.status === 'active').length,
      disabledAdmins: users.filter((u) => u.role === 'admin' && u.status === 'disabled').length,
      validRoles: INTERNAL_ROLES,
      validStatuses: INTERNAL_STATUSES,
    },
    orders: {
      today: todayOrders.length,
      total: allOrdersResult.count || 0,
    },
    revenue: {
      today: sumRevenue(todayOrders),
      month: sumRevenue(monthOrders),
    },
    latestAudit: auditResult.data || [],
  });
}
