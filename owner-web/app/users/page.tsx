'use client';

import { useEffect, useState } from 'react';
import OwnerShell from '@/components/OwnerShell';
import PageHeader from '@/components/PageHeader';
import type { InternalRole, InternalStatus } from '@/lib/constants';

type InternalUser = {
  id: string;
  auth_user_id: string | null;
  email: string;
  name: string | null;
  role: InternalRole;
  status: InternalStatus;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
};

type UsersResponse =
  | { ok: true; users: InternalUser[] }
  | { ok?: false; error: string };

const ROLES: InternalRole[] = ['owner', 'admin'];
const STATUSES: InternalStatus[] = ['active', 'disabled', 'pending'];

export default function UsersPage() {
  const [users, setUsers] = useState<InternalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: '',
    name: '',
    role: 'admin' as InternalRole,
    status: 'active' as InternalStatus,
  });

  async function fetchUsers() {
    setLoading(true);
    const r = await fetch('/api/owner/users', { cache: 'no-store' });
    const data: UsersResponse = await r.json();
    if ('ok' in data && data.ok) {
      setUsers(data.users);
    } else {
      setMessage(data.error || 'Gagal memuat users.');
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    const r = await fetch('/api/owner/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await r.json();
    if (!r.ok || !data.ok) {
      setMessage(data.error || 'Gagal menyimpan user.');
      return;
    }
    setForm({ email: '', name: '', role: 'admin', status: 'active' });
    setMessage('User internal berhasil disimpan.');
    await fetchUsers();
  }

  async function updateUser(user: InternalUser, patch: Partial<InternalUser>) {
    setMessage(null);
    const r = await fetch('/api/owner/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, ...patch }),
    });
    const data = await r.json();
    if (!r.ok || !data.ok) {
      setMessage(data.error || 'Gagal update user.');
      return;
    }
    await fetchUsers();
  }

  return (
    <OwnerShell>
      <PageHeader
        title="Admin Users"
        subtitle="Atur siapa saja yang boleh masuk ke web admin dan owner."
        actions={
          <button className="btn-secondary" onClick={fetchUsers} disabled={loading}>
            Refresh
          </button>
        }
      />

      <section className="card mb-6 p-5">
        <h2 className="mb-4 text-sm font-semibold text-ink-900">Tambah / upsert user internal</h2>
        <form className="grid gap-4 md:grid-cols-5" onSubmit={handleCreate}>
          <div className="md:col-span-2">
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label">Nama</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Role</label>
            <select
              className="input"
              value={form.role}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, role: e.target.value as InternalRole }))
              }
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select
              className="input"
              value={form.status}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, status: e.target.value as InternalStatus }))
              }
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-5">
            <button className="btn-primary" type="submit">
              Simpan User
            </button>
          </div>
        </form>
        {message && <div className="mt-4 rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-600">{message}</div>}
      </section>

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-ink-100 text-sm">
            <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last login</th>
                <th className="px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-5 text-ink-500" colSpan={5}>
                    Memuat users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td className="px-4 py-5 text-ink-500" colSpan={5}>
                    Belum ada user internal.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink-900">{user.email}</div>
                      <div className="text-xs text-ink-500">{user.name || '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="input min-w-28"
                        value={user.role}
                        onChange={(e) => updateUser(user, { role: e.target.value as InternalRole })}
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="input min-w-32"
                        value={user.status}
                        onChange={(e) =>
                          updateUser(user, { status: e.target.value as InternalStatus })
                        }
                      >
                        {STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-ink-500">
                      {user.last_login_at ? new Date(user.last_login_at).toLocaleString('id-ID') : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className={user.status === 'disabled' ? 'btn-primary' : 'btn-danger'}
                        onClick={() =>
                          updateUser(user, {
                            status: user.status === 'disabled' ? 'active' : 'disabled',
                          })
                        }
                      >
                        {user.status === 'disabled' ? 'Aktifkan' : 'Nonaktifkan'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </OwnerShell>
  );
}
