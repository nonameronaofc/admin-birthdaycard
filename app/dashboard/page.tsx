'use client';

import { useEffect, useState } from 'react';
import AdminShell from '@/components/AdminShell';
import PageHeader from '@/components/PageHeader';
import { fetchJsonOrThrow } from '@/lib/client-api';

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
      const data = await fetchJsonOrThrow<Stats>(
        '/api/admin/dashboard',
        undefined,
        'Gagal memuat data. Silakan refresh halaman.'
      );
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
          <section className="mb-8">
            <h2 className="text-xs font-mono uppercase tracking-wider text-ink-500 mb-3">
              Pesanan
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Hari Ini" value={stats.todayOrders} accent />
              <StatCard label="Bulan Ini" value={stats.monthOrders} />
              <StatCard label="Order Normal" value={stats.normalOrders} sub="HM · RG · ST" />
              <StatCard label="Order Live" value={stats.liveOrders} sub="RL · SL" />
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xs font-mono uppercase tracking-wider text-ink-500 mb-3">
              Status Order
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Pending" value={stats.pending} dotColor="bg-amber-400" />
              <StatCard label="Processing" value={stats.processing} dotColor="bg-blue-400" />
              <StatCard label="Completed" value={stats.completed} dotColor="bg-green-500" />
              <StatCard label="Cancelled" value={stats.cancelled} dotColor="bg-red-400" />
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xs font-mono uppercase tracking-wider text-ink-500 mb-3">
              Kode Pesanan
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
    <div className={`card p-5 ${accent ? 'bg-ink-900 text-white border-ink-900' : ''}`}>
      <div className="flex items-center gap-2 mb-2">
        {dotColor && <span className={`w-2 h-2 rounded-full ${dotColor}`} />}
        <div className={`text-xs font-medium ${accent ? 'text-ink-300' : 'text-ink-500'}`}>
          {label}
        </div>
      </div>
      <div className={`font-display text-3xl font-semibold ${accent ? 'text-white' : 'text-ink-900'}`}>
        {value.toLocaleString('id-ID')}
      </div>
      {sub && (
        <div className={`text-xs mt-1 font-mono ${accent ? 'text-ink-400' : 'text-ink-500'}`}>
          {sub}
        </div>
      )}
    </div>
  );
}
