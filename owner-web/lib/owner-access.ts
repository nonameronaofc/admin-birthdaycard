import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import { createAdminClient } from './supabase-admin';

function parseOwnerEmails(): string[] {
  return (process.env.OWNER_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function hasOwnerRole(user: User): boolean {
  const roles = [
    user.app_metadata?.role,
    user.user_metadata?.role,
    user.app_metadata?.roles,
    user.user_metadata?.roles,
  ];

  return roles.some((role) => {
    if (Array.isArray(role)) return role.includes('owner');
    return role === 'owner';
  });
}

export function isOwnerUser(user: User | null): boolean {
  if (!user) return false;

  const email = user.email?.trim().toLowerCase();
  const emailAllowed = !!email && parseOwnerEmails().includes(email);

  return emailAllowed || hasOwnerRole(user);
}

export function createServerSupabaseClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options?: Parameters<typeof cookieStore.set>[2];
          }>
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server components cannot always mutate cookies.
          }
        },
      },
    }
  );
}

export async function getOwnerUser() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return isOwnerUser(user) ? user : null;
}

export async function requireOwner(): Promise<NextResponse | null> {
  const user = await getOwnerUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized - akun ini bukan owner.' },
      { status: 401 }
    );
  }

  return null;
}

export async function writeAuditLog(params: {
  actionType: string;
  targetEmail?: string | null;
  targetUserId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const user = await getOwnerUser();
  const supabase = createAdminClient();

  await supabase.from('owner_audit_logs').insert({
    actor_user_id: user?.id ?? null,
    actor_email: user?.email ?? null,
    action_type: params.actionType,
    target_user_id: params.targetUserId ?? null,
    target_email: params.targetEmail ?? null,
    metadata: params.metadata ?? {},
  });
}
