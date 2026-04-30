'use client';

import { useEffect, useState } from 'react';
import OwnerShell from '@/components/OwnerShell';
import PageHeader from '@/components/PageHeader';

type Settings = {
  site_name: string;
  admin_invite_mode: string;
  login_lock_mode: string;
};

type SettingsResponse =
  | { ok: true; settings: Settings }
  | { ok?: false; error: string };

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    site_name: 'Birthday Video',
    admin_invite_mode: 'manual',
    login_lock_mode: 'normal',
  });
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchSettings() {
    setLoading(true);
    const r = await fetch('/api/owner/settings', { cache: 'no-store' });
    const data: SettingsResponse = await r.json();
    if ('ok' in data && data.ok) setSettings(data.settings);
    else setMessage(data.error || 'Gagal memuat settings.');
    setLoading(false);
  }

  useEffect(() => {
    fetchSettings();
  }, []);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    const r = await fetch('/api/owner/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    const data = await r.json();
    setMessage(r.ok && data.ok ? 'Settings berhasil disimpan.' : data.error || 'Gagal menyimpan settings.');
  }

  return (
    <OwnerShell>
      <PageHeader title="Settings" subtitle="Pengaturan dasar owner panel dan akses internal." />

      <form className="card max-w-2xl p-5" onSubmit={handleSave}>
        <div className="space-y-4">
          <div>
            <label className="label">Nama sistem</label>
            <input
              className="input"
              value={settings.site_name}
              onChange={(e) => setSettings((prev) => ({ ...prev, site_name: e.target.value }))}
              disabled={loading}
            />
          </div>
          <div>
            <label className="label">Mode invite admin</label>
            <select
              className="input"
              value={settings.admin_invite_mode}
              onChange={(e) => setSettings((prev) => ({ ...prev, admin_invite_mode: e.target.value }))}
            >
              <option value="manual">manual</option>
              <option value="approval">approval</option>
            </select>
          </div>
          <div>
            <label className="label">Mode login internal</label>
            <select
              className="input"
              value={settings.login_lock_mode}
              onChange={(e) => setSettings((prev) => ({ ...prev, login_lock_mode: e.target.value }))}
            >
              <option value="normal">normal</option>
              <option value="locked">locked</option>
            </select>
          </div>
        </div>

        {message && <div className="mt-4 rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-600">{message}</div>}

        <button className="btn-primary mt-6" type="submit">
          Simpan Settings
        </button>
      </form>
    </OwnerShell>
  );
}
