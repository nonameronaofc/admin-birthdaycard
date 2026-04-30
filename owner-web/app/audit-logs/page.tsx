'use client';

import { useEffect, useState } from 'react';
import OwnerShell from '@/components/OwnerShell';
import PageHeader from '@/components/PageHeader';

type AuditLog = {
  id: string;
  actor_email: string | null;
  action_type: string;
  target_email: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type LogsResponse = { ok: true; logs: AuditLog[] } | { ok?: false; error: string };

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchLogs() {
    setLoading(true);
    setError(null);
    const r = await fetch('/api/owner/audit-logs', { cache: 'no-store' });
    const data: LogsResponse = await r.json();
    if ('ok' in data && data.ok) {
      setLogs(data.logs);
    } else {
      setError(data.error || 'Gagal memuat audit log.');
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <OwnerShell>
      <PageHeader
        title="Audit Log"
        subtitle="Riwayat perubahan akses dan aksi owner."
        actions={
          <button className="btn-secondary" onClick={fetchLogs} disabled={loading}>
            Refresh
          </button>
        }
      />

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-ink-100 text-sm">
            <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-5 text-ink-500" colSpan={5}>
                    Memuat audit log...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td className="px-4 py-5 text-red-700" colSpan={5}>
                    {error}
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td className="px-4 py-5 text-ink-500" colSpan={5}>
                    Belum ada audit log.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-500">
                      {new Date(log.created_at).toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3">{log.actor_email || '-'}</td>
                    <td className="px-4 py-3 font-medium text-ink-900">{log.action_type}</td>
                    <td className="px-4 py-3">{log.target_email || '-'}</td>
                    <td className="px-4 py-3">
                      <code className="rounded bg-ink-50 px-2 py-1 text-xs text-ink-600">
                        {JSON.stringify(log.metadata || {})}
                      </code>
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
