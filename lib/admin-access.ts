import type { User } from '@supabase/supabase-js';
import { createAdminClient } from './supabase-admin';

export type InternalAccessRole = 'owner' | 'admin';
export type InternalAccessStatus = 'active' | 'disabled' | 'pending';

export type InternalAccess = {
  allowed: boolean;
  role: InternalAccessRole | null;
  status: InternalAccessStatus | null;
  source: 'internal_users' | 'env' | 'metadata' | 'none';
};

function parseAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function hasAdminLikeRole(user: User): InternalAccessRole | null {
  const roles = [
    user.app_metadata?.role,
    user.user_metadata?.role,
    user.app_metadata?.roles,
    user.user_metadata?.roles,
  ];

  for (const role of roles) {
    if (Array.isArray(role)) {
      if (role.includes('owner')) return 'owner';
      if (role.includes('admin')) return 'admin';
    }
    if (role === 'owner') return 'owner';
    if (role === 'admin') return 'admin';
  }

  return null;
}

function fallbackAccess(user: User | null): InternalAccess {
  if (!user) {
    return { allowed: false, role: null, status: null, source: 'none' };
  }

  const email = user.email?.trim().toLowerCase();
  const emailAllowed = !!email && parseAdminEmails().includes(email);
  if (emailAllowed) {
    return { allowed: true, role: 'admin', status: 'active', source: 'env' };
  }

  const metadataRole = hasAdminLikeRole(user);
  if (metadataRole) {
    return { allowed: true, role: metadataRole, status: 'active', source: 'metadata' };
  }

  return { allowed: false, role: null, status: null, source: 'none' };
}

export async function getAdminAccess(user: User | null): Promise<InternalAccess> {
  if (!user?.email) {
    return { allowed: false, role: null, status: null, source: 'none' };
  }

  const email = user.email.trim().toLowerCase();

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('internal_users')
      .select('role,status')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      console.warn('Gagal membaca internal_users, fallback ke akses lama:', error.message);
      return fallbackAccess(user);
    }

    if (data) {
      const role = data.role === 'owner' || data.role === 'admin' ? data.role : null;
      const status =
        data.status === 'active' || data.status === 'disabled' || data.status === 'pending'
          ? data.status
          : null;

      return {
        allowed: !!role && status === 'active',
        role,
        status,
        source: 'internal_users',
      };
    }
  } catch (error) {
    console.warn(
      'Gagal memakai internal_users, fallback ke akses lama:',
      error instanceof Error ? error.message : error
    );
    return fallbackAccess(user);
  }

  return fallbackAccess(user);
}

export async function isAdminUser(user: User | null): Promise<boolean> {
  const access = await getAdminAccess(user);
  return access.allowed;
}
