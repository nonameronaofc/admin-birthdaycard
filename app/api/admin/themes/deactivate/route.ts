import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { sanitizeUUID } from '@/lib/sanitize';

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const body = await req.json();
  const id = sanitizeUUID(body.id);
  if (!id) return NextResponse.json({ error: 'ID tema tidak valid.' }, { status: 400 });

  // Toggle: kalau is_active dikirim, pakai itu; kalau tidak, default deactivate
  const isActive = typeof body.is_active === 'boolean' ? body.is_active : false;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('themes')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
