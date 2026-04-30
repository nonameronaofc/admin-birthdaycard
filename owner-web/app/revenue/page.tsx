'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import OwnerShell from '@/components/OwnerShell';
import PageHeader from '@/components/PageHeader';
import { PACKAGE_LABELS, type PackageCode } from '@/lib/constants';

type Period = 'today' | 'week' | 'month' | 'all';

type RevenueTotals = {
  count: number;
  revenue: number;
  by_package: Record<PackageCode, { count: number; revenue: number }>;
};

type RevenueOrder = {
  id: string;
  public_order_id: string;
  order_code: string;
  package_code: PackageCode;
  nama_pemesan: string;
  theme_code: string;
  created_at: string;
  price: number;
};

type RevenueResponse =
  | {
      ok: true;
      updated_at: string;
      period: Period;
      target_amount: number;
      totals: RevenueTotals;
      latest_orders: RevenueOrder[];
    }
  | { ok?: false; error: string };

const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Hari ini' },
  { value: 'week', label: '7 hari' },
  { value: 'month', label: 'Bulan ini' },
  { value: 'all', label: 'Semua' },
];

function formatIDR(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default function RevenuePage() {
  const [period, setPeriod] = useState<Period>('today');
  const [target, setTarget] = useState(0);
  const [targetInput, setTargetInput] = useState('');
  const [savingTarget, setSavingTarget] = useState(false);
  const [targetMessage, setTargetMessage] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [needPassword, setNeedPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [totals, setTotals] = useState<RevenueTotals | null>(null);
  const [latestOrders, setLatestOrders] = useState<RevenueOrder[]>([]);
  const [updatedAt, setUpdatedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const progress = useMemo(() => {
    const revenue = totals?.revenue || 0;
    if (!target) return { percent: 0, remaining: 0 };
    return {
      percent: Math.min(100, Math.round((revenue / target) * 100)),
      remaining: Math.max(0, target - revenue),
    };
  }, [target, totals]);

  const fetchRevenue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ period });
      const r = await fetch(`/api/owner/revenue?${params}`, { cache: 'no-store' });
      const data: RevenueResponse = await r.json();

      if (r.status === 401) {
        setNeedPassword(true);
        setTotals(null);
        setLatestOrders([]);
        return;
      }

      if (!r.ok || !('ok' in data) || data.ok !== true) {
        setError('error' in data ? data.error : 'Gagal memuat data pendapatan.');
        return;
      }

      setNeedPassword(false);
      setTarget(data.target_amount || 0);
      setTargetInput(String(data.target_amount || 0));
      setTotals(data.totals);
      setLatestOrders(data.latest_orders);
      setUpdatedAt(data.updated_at);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchRevenue();
  }, [fetchRevenue]);

  useEffect(() => {
    if (needPassword) return;
    const timer = window.setInterval(fetchRevenue, 10000);
    return () => window.clearInterval(timer);
  }, [fetchRevenue, needPassword]);

  async function handleLogin() {
    setLoggingIn(true);
    setLoginError(null);
    try {
      const r = await fetch('/api/owner/revenue/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setLoginError(data.error || 'Kata sandi salah.');
        return;
      }
      setPassword('');
      await fetchRevenue();
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleRevenueLogout() {
    await fetch('/api/owner/revenue/login', { method: 'DELETE' });
    setNeedPassword(true);
    setTotals(null);
    setLatestOrders([]);
  }

  async function handleSaveTarget() {
    const parsedTarget = Number(targetInput);
    if (!Number.isFinite(parsedTarget) || parsedTarget < 0) {
      setTargetMessage('Target harus berupa angka 0 atau lebih.');
      return;
    }

    setSavingTarget(true);
    setTargetMessage(null);
    try {
      const r = await fetch('/api/owner/revenue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_amount: parsedTarget }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setTargetMessage(data.error || 'Gagal menyimpan target.');
        return;
      }

      const nextTarget = Number(data.target_amount || 0);
      setTarget(nextTarget);
      setTargetInput(String(nextTarget));
      setTargetMessage('Target pendapatan berhasil disimpan.');
    } finally {
      setSavingTarget(false);
    }
  }

  return (
    <OwnerShell>
      <PageHeader
        title="Pendapatan"
        subtitle="Panel pendapatan dipindahkan ke owner untuk akses yang lebih terbatas."
        actions={
          <>
            <button onClick={fetchRevenue} className="btn-secondary" disabled={loading}>
              Refresh
            </button>
            {!needPassword && (
              <button onClick={handleRevenueLogout} className="btn-secondary" disabled={loading}>
                Kunci Ulang
              </button>
            )}
          </>
        }
      />

      <section className="card mb-6 p-5">
        <h2 className="mb-3 font-mono text-xs uppercase tracking-wider text-ink-500">Periode</h2>
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={period === p.value ? 'btn-primary' : 'btn-secondary'}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-3 font-mono text-xs text-ink-500">
          Update terakhir: {updatedAt ? formatDateTime(updatedAt) : '-'}
        </div>
      </section>

      {needPassword ? (
        <section className="card p-5">
          <h2 className="mb-1 text-sm font-semibold text-ink-900">Password Pendapatan</h2>
          <p className="mb-4 text-sm text-ink-500">
            Masukkan kata sandi khusus owner untuk membuka halaman pendapatan.
          </p>
          <div className="max-w-md">
            <label className="label">Kata sandi</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            {loginError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {loginError}
              </div>
            )}
            <button
              type="button"
              className="btn-primary mt-4"
              onClick={handleLogin}
              disabled={loggingIn || !password.trim()}
            >
              {loggingIn ? 'Membuka...' : 'Buka Pendapatan'}
            </button>
          </div>
        </section>
      ) : (
        <>
          {error && <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}

          <section className="mb-6 grid gap-4 md:grid-cols-3">
            <div className="card p-5">
              <div className="text-sm text-ink-500">Total omzet</div>
              <div className="mt-2 text-3xl font-semibold text-ink-900">
                {formatIDR(totals?.revenue || 0)}
              </div>
            </div>
            <div className="card p-5">
              <div className="text-sm text-ink-500">Jumlah order</div>
              <div className="mt-2 text-3xl font-semibold text-ink-900">{totals?.count || 0}</div>
            </div>
            <div className="card p-5">
              <div className="text-sm text-ink-500">Sisa target</div>
              <div className="mt-2 text-3xl font-semibold text-ink-900">
                {formatIDR(progress.remaining)}
              </div>
            </div>
          </section>

          <section className="card mb-6 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex-1">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-ink-900">Progress target</span>
                  <span className="text-ink-500">{progress.percent}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-ink-100">
                  <div className="h-full bg-accent-500" style={{ width: `${progress.percent}%` }} />
                </div>
              </div>
              <div className="w-full max-w-sm">
                <label className="label">Target pendapatan</label>
                <div className="flex gap-2">
                  <input
                    className="input"
                    value={targetInput}
                    onChange={(e) => setTargetInput(e.target.value)}
                    inputMode="numeric"
                  />
                  <button className="btn-primary" onClick={handleSaveTarget} disabled={savingTarget}>
                    Simpan
                  </button>
                </div>
                {targetMessage && <div className="mt-2 text-sm text-ink-500">{targetMessage}</div>}
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="card p-5">
              <h2 className="mb-4 text-sm font-semibold text-ink-900">Per paket</h2>
              <div className="space-y-3">
                {totals &&
                  Object.entries(totals.by_package).map(([code, item]) => (
                    <div key={code} className="flex items-center justify-between rounded-lg border border-ink-100 p-3">
                      <div>
                        <div className="font-medium text-ink-900">
                          {PACKAGE_LABELS[code as PackageCode]}
                        </div>
                        <div className="text-xs text-ink-500">{item.count} order</div>
                      </div>
                      <div className="font-medium text-ink-900">{formatIDR(item.revenue)}</div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="card p-5">
              <h2 className="mb-4 text-sm font-semibold text-ink-900">Order terbaru</h2>
              <div className="space-y-3">
                {latestOrders.length === 0 ? (
                  <div className="text-sm text-ink-500">Belum ada order pada periode ini.</div>
                ) : (
                  latestOrders.map((order) => (
                    <div key={order.id} className="rounded-lg border border-ink-100 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-ink-900">{order.public_order_id}</div>
                          <div className="text-xs text-ink-500">
                            {order.nama_pemesan} - {order.theme_code}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-ink-900">{formatIDR(order.price)}</div>
                          <div className="text-xs text-ink-500">{formatDateTime(order.created_at)}</div>
                        </div>
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
