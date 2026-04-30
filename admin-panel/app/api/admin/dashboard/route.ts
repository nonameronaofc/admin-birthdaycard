import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  const guard = await requireAdmin();
  if (guard) return guard;

  const supabase = createAdminClient();

  const today = new Date();
  const todayStr = today.toISOString().substring(0, 10);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString();

  // Hitung paralel
  const [
    todayOrders, monthOrders, pendingCount, processingCount,
    completedCount, cancelledCount, normalCount, liveCount,
    unusedCodes, usedCodes, expiredCodes, activeSessions,
  ] = await Promise.all([
    supabase.from('orders').select('id', { count: 'exact', head: true })
      .gte('created_at', `${todayStr}T00:00:00`)
      .lte('created_at', `${todayStr}T23:59:59`)
      .eq('is_deleted', false),
    supabase.from('orders').select('id', { count: 'exact', head: true })
      .gte('created_at', monthStart).eq('is_deleted', false),
    supabase.from('orders').select('id', { count: 'exact', head: true })
      .eq('status', 'pending').eq('is_deleted', false),
    supabase.from('orders').select('id', { count: 'exact', head: true })
      .eq('status', 'processing').eq('is_deleted', false),
    supabase.from('orders').select('id', { count: 'exact', head: true })
      .eq('status', 'completed').eq('is_deleted', false),
    supabase.from('orders').select('id', { count: 'exact', head: true })
      .eq('status', 'cancelled').eq('is_deleted', false),
    supabase.from('orders').select('id', { count: 'exact', head: true })
      .in('package_code', ['HM', 'RG', 'ST']).eq('is_deleted', false),
    supabase.from('orders').select('id', { count: 'exact', head: true })
      .in('package_code', ['RL', 'SL']).eq('is_deleted', false),
    supabase.from('order_codes').select('id', { count: 'exact', head: true })
      .eq('status', 'unused'),
    supabase.from('order_codes').select('id', { count: 'exact', head: true })
      .eq('status', 'used'),
    supabase.from('order_codes').select('id', { count: 'exact', head: true })
      .eq('status', 'expired'),
    supabase.from('live_sessions').select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
  ]);

  return NextResponse.json({
    todayOrders: todayOrders.count ?? 0,
    monthOrders: monthOrders.count ?? 0,
    pending: pendingCount.count ?? 0,
    processing: processingCount.count ?? 0,
    completed: completedCount.count ?? 0,
    cancelled: cancelledCount.count ?? 0,
    normalOrders: normalCount.count ?? 0,
    liveOrders: liveCount.count ?? 0,
    unusedCodes: unusedCodes.count ?? 0,
    usedCodes: usedCodes.count ?? 0,
    expiredCodes: expiredCodes.count ?? 0,
    activeSessions: activeSessions.count ?? 0,
  });
}
