import { NextRequest, NextResponse } from 'next/server';
import { requireOwner, writeAuditLog } from '@/lib/owner-access';
import {
  clearRevenueCookie,
  hasRevenuePasswordConfigured,
  setRevenueCookie,
  verifyRevenuePassword,
} from '@/lib/revenue-auth';

export async function POST(req: NextRequest) {
  const guard = await requireOwner();
  if (guard) return guard;

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!hasRevenuePasswordConfigured()) {
    return NextResponse.json(
      { error: 'OWNER_REVENUE_PASSWORD belum diatur.' },
      { status: 500 }
    );
  }

  if (!verifyRevenuePassword(body.password || '')) {
    return NextResponse.json({ error: 'Kata sandi salah.' }, { status: 401 });
  }

  setRevenueCookie();
  await writeAuditLog({ actionType: 'owner_revenue_unlock' });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const guard = await requireOwner();
  if (guard) return guard;

  clearRevenueCookie();
  await writeAuditLog({ actionType: 'owner_revenue_lock' });
  return NextResponse.json({ ok: true });
}
