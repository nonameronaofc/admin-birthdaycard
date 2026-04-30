import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner-access';
import { createAdminClient } from '@/lib/supabase-admin';

export async function GET() {
  const guard = await requireOwner();
  if (guard) return guard;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('owner_audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, logs: data || [] });
}
