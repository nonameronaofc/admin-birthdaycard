'use client';

import { useEffect, useState } from 'react';
import OwnerShell from '@/components/OwnerShell';
import PageHeader from '@/components/PageHeader';

type DashboardResponse =
  | {
      ok: true;
      users: { owners: number; admins: number; activeAdmins: number; disabledAdmins: number };
      orders: { today: number; total: number };
      revenue: { today: number; month: number };
      latestAudit: Array<{
        id: string;
        actor_email: string | null;
        action_type: string;
        target_email: string | null;
        created_at: string;
      }>;
    }
  | { ok?: false; error: string };

function formatIDR(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchDashboard() {
    setLoading(true);
    const r = await fetch('/api/owner/dashboard', { cache: 'no-store' });
    setData(await r.json());
    setLoading(false);
  }

  useEffect(() => {
    fetchDashboard();
  }, []);

  const ok = data && 'ok' in data && data.ok;

  return (
    <OwnerShell>
      <PageHeader
        title="Owner Dashboard"
        subtitle="Ringkasan akses admin, audit, order, dan pendapatan."
        actions={
          <button className="btn-secondary" onClick={fetchDashboard} disabled={loading}>
            Refresh
          </button>
        }
      />

      {!ok ? (
        <section className="card p-5 text-sm text-ink-500">
          {loading
            ? 'Memuat dashboard...'
            : data && 'error' in data
              ? data.error
              : 'Gagal memuat dashboard.'}
        </section>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Owner" value={data.users.owners} />
            <StatCard label="Admin aktif" value={data.users.activeAdmins} />
            <StatCard label="Admin nonaktif" value={data.users.disabledAdmins} />
            <StatCard label="Order hari ini" value={data.orders.today} />
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="card p-5">
              <h2 className="mb-4 text-sm font-semibold text-ink-900">Pendapatan</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <StatCard label="Hari ini" value={formatIDR(data.revenue.today)} compact />
                <StatCard label="Bulan ini" value={formatIDR(data.revenue.month)} compact />
              </div>
            </div>

            <div className="card p-5">
              <h2 className="mb-4 text-sm font-semibold text-ink-900">Audit terbaru</h2>
              <div className="space-y-3">
                {data.latestAudit.length === 0 ? (
                  <p className="text-sm text-ink-500">Belum ada audit log.</p>
                ) : (
                  data.latestAudit.map((item) => (
                    <div key={item.id} className="rounded-lg border border-ink-100 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-ink-900">
                            {item.action_type}
                          </div>
                          <div className="text-xs text-ink-500">
                            {item.actor_email || '-'} {'->'} {item.target_email || '-'}
                          </div>
                        </div>
                        <div className="text-xs text-ink-400">{formatDate(item.created_at)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </OwnerShell>
  );
}

function StatCard({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: number | string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'rounded-lg border border-ink-100 p-4' : 'card p-5'}>
      <div className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-ink-900">{value}</div>
    </div>
  );
}
