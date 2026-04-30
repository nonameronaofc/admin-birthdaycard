import { NextRequest, NextResponse } from 'next/server';
import { requireOwner, writeAuditLog } from '@/lib/owner-access';
import { createAdminClient } from '@/lib/supabase-admin';

const DEFAULT_SETTINGS = {
  site_name: 'Birthday Video',
  admin_invite_mode: 'manual',
  login_lock_mode: 'normal',
};

export async function GET() {
  const guard = await requireOwner();
  if (guard) return guard;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('owner_settings')
    .select('value_json')
    .eq('key', 'owner_panel')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    settings: {
      ...DEFAULT_SETTINGS,
      ...(data?.value_json || {}),
    },
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireOwner();
  if (guard) return guard;

  let body: typeof DEFAULT_SETTINGS;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const settings = {
    site_name: String(body.site_name || DEFAULT_SETTINGS.site_name).trim(),
    admin_invite_mode: body.admin_invite_mode === 'approval' ? 'approval' : 'manual',
    login_lock_mode: body.login_lock_mode === 'locked' ? 'locked' : 'normal',
  };

  const supabase = createAdminClient();
  const { error } = await supabase.from('owner_settings').upsert(
    {
      key: 'owner_panel',
      value_json: settings,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog({
    actionType: 'owner_settings_update',
    metadata: settings,
  });

  return NextResponse.json({ ok: true, settings });
}
