import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { sanitizeUUID } from '@/lib/sanitize';

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const { searchParams } = new URL(req.url);
  const id = sanitizeUUID(searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'ID order tidak valid.' }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('orders').select('*').eq('id', id).single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const body = await req.json();
  const id = sanitizeUUID(body.id);
  if (!id) return NextResponse.json({ error: 'ID order tidak valid.' }, { status: 400 });

  // Field yang diizinkan diupdate manual oleh admin
  const allowed: Record<string, unknown> = {};
  if (typeof body.status === 'string') allowed.status = body.status;
  if (typeof body.admin_note === 'string') allowed.admin_note = body.admin_note;
  allowed.updated_at = new Date().toISOString();

  const supabase = createAdminClient();
  const { error } = await supabase.from('orders').update(allowed).eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
