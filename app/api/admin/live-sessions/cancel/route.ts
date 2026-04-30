import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { sanitizeUUID } from '@/lib/sanitize';

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const body = await req.json();
  const id = sanitizeUUID(body.id);
  if (!id) return NextResponse.json({ error: 'ID sesi tidak valid.' }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('live_sessions')
    .update({ status: 'cancelled', closed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'active');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
