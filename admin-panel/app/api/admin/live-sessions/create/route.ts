import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { sanitizeText } from '@/lib/sanitize';

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const body = await req.json();
  const name = sanitizeText(body.name, 100);
  if (!name) return NextResponse.json({ error: 'Nama sesi wajib diisi.' }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('live_sessions')
    .insert({ name, status: 'active' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
