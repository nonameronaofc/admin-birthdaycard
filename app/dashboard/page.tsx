'use client';

import { useEffect, useState } from 'react';
import AdminShell from '@/components/AdminShell';
import PageHeader from '@/components/PageHeader';

interface Stats {
  todayOrders: number;
  monthOrders: number;
  pending: number;
  processing: number;
  completed: number;
  cancelled: number;
  normalOrders: number;
  liveOrders: number;
  unusedCodes: number;
  usedCodes: number;
  expiredCodes: number;
  activeSessions: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchStats() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/admin/dashboard');
      if (!r.ok) throw new Error('Gagal memuat data. Silakan refresh halaman.');
      const data = await r.json();
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchStats(); }, []);

  return (
    <AdminShell>
      <PageHeader
        title="Dashboard"
        subtitle="Ringkasan pesanan dan kode pesanan"
        actions={
          <button onClick={fetchStats} className="btn-secondary" disabled={loading}>
            ↻ Refresh
          </button>
        }
      />

      {error && (
        <div className="card p-4 bg-red-50 border-red-200 text-red-700 text-sm mb-6">
          {error}
        </div>
      )}

      {loading && !stats ? (
        <div className="text-sm text-ink-500">Memuat data...</div>
      ) : stats ? (
        <>
          <section className="mb-5">
            <SectionTitle title="Pesanan" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard label="Hari Ini" value={stats.todayOrders} accent />
              <StatCard label="Bulan Ini" value={stats.monthOrders} />
              <StatCard label="Order Normal" value={stats.normalOrders} sub="HM · RG · ST" />
              <StatCard label="Order Live" value={stats.liveOrders} sub="RL · SL" />
            </div>
          </section>

          <section className="mb-5">
            <SectionTitle title="Status Order" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard label="Pending" value={stats.pending} dotColor="bg-amber-400" />
              <StatCard label="Processing" value={stats.processing} dotColor="bg-blue-400" />
              <StatCard label="Completed" value={stats.completed} dotColor="bg-green-500" />
              <StatCard label="Cancelled" value={stats.cancelled} dotColor="bg-red-400" />
            </div>
          </section>

          <section className="mb-5">
            <SectionTitle title="Kode Pesanan" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard label="Unused" value={stats.unusedCodes} dotColor="bg-green-400" />
              <StatCard label="Used" value={stats.usedCodes} dotColor="bg-ink-400" />
              <StatCard label="Expired" value={stats.expiredCodes} dotColor="bg-red-400" />
              <StatCard label="Live Session Aktif" value={stats.activeSessions} dotColor="bg-accent-400" />
            </div>
          </section>
        </>
      ) : null}
    </AdminShell>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
      {title}
    </h2>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
  dotColor,
}: {
  label: string;
  value: number;
  sub?: string;
  accent?: boolean;
  dotColor?: string;
}) {
  return (
    <div className={`card p-4 ${accent ? 'bg-ink-900 text-white border-ink-900' : ''}`}>
      <div className="mb-1.5 flex items-center gap-2">
        {dotColor && <span className={`w-2 h-2 rounded-full ${dotColor}`} />}
        <div className={`text-xs font-medium ${accent ? 'text-ink-300' : 'text-ink-500'}`}>
          {label}
        </div>
      </div>
      <div className={`text-2xl font-semibold tracking-tight ${accent ? 'text-white' : 'text-ink-900'}`}>
        {value.toLocaleString('id-ID')}
      </div>
      {sub && (
        <div className={`mt-1 text-xs font-mono ${accent ? 'text-ink-300' : 'text-ink-500'}`}>
          {sub}
        </div>
      )}
    </div>
  );
}
