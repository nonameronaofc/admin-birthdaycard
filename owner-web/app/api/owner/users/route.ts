import { NextRequest, NextResponse } from 'next/server';
import { requireOwner, writeAuditLog } from '@/lib/owner-access';
import { createAdminClient } from '@/lib/supabase-admin';
import { INTERNAL_ROLES, INTERNAL_STATUSES, type InternalRole, type InternalStatus } from '@/lib/constants';

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function isRole(value: unknown): value is InternalRole {
  return INTERNAL_ROLES.includes(value as InternalRole);
}

function isStatus(value: unknown): value is InternalStatus {
  return INTERNAL_STATUSES.includes(value as InternalStatus);
}

export async function GET() {
  const guard = await requireOwner();
  if (guard) return guard;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('internal_users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, users: data || [] });
}

export async function POST(req: NextRequest) {
  const guard = await requireOwner();
  if (guard) return guard;

  let body: { email?: string; name?: string; role?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  const role = isRole(body.role) ? body.role : 'admin';
  const status = isStatus(body.status) ? body.status : 'active';

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Email tidak valid.' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('internal_users')
    .upsert(
      {
        email,
        name: body.name?.trim() || null,
        role,
        status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'email' }
    )
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog({
    actionType: 'internal_user_upsert',
    targetEmail: email,
    targetUserId: data.id,
    metadata: { role, status },
  });

  return NextResponse.json({ ok: true, user: data });
}

export async function PATCH(req: NextRequest) {
  const guard = await requireOwner();
  if (guard) return guard;

  let body: { id?: string; role?: string; status?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: 'ID user wajib diisi.' }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) patch.name = body.name.trim() || null;
  if (body.role !== undefined) {
    if (!isRole(body.role)) return NextResponse.json({ error: 'Role tidak valid.' }, { status: 400 });
    patch.role = body.role;
  }
  if (body.status !== undefined) {
    if (!isStatus(body.status)) return NextResponse.json({ error: 'Status tidak valid.' }, { status: 400 });
    patch.status = body.status;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('internal_users')
    .update(patch)
    .eq('id', body.id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog({
    actionType: 'internal_user_update',
    targetEmail: data.email,
    targetUserId: data.id,
    metadata: patch,
  });

  return NextResponse.json({ ok: true, user: data });
}
