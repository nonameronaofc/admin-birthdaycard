'use client';

import { useEffect, useState, useCallback } from 'react';
import AdminShell from '@/components/AdminShell';
import PageHeader from '@/components/PageHeader';
import ConfirmDialog from '@/components/ConfirmDialog';
import Toast, { type ToastType } from '@/components/Toast';
import { fetchBlobOrThrow, fetchJsonOrThrow } from '@/lib/client-api';

interface CodeStats {
  total: number;
  unused: number;
  used: number;
  expired: number;
}

interface LiveSession {
  id: string;
  name: string;
  status: 'active' | 'closed' | 'cancelled';
  started_at: string;
  closed_at: string | null;
  code_stats: CodeStats;
}

export default function LiveSessionsPage() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState('');

  // Create form
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  // Confirm dialogs
  const [confirmClose, setConfirmClose] = useState<LiveSession | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<LiveSession | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Export per session
  const [exporting, setExporting] = useState<string | null>(null);

  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      const json = await fetchJsonOrThrow<{ data: LiveSession[] }>(
        `/api/admin/live-sessions/list?${params}`,
        undefined,
        'Gagal memuat data. Silakan refresh halaman.'
      );
      setSessions(json.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await fetchJsonOrThrow('/api/admin/live-sessions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      }, 'Gagal membuat sesi');
      setToast({ msg: `Sesi "${newName.trim()}" berhasil dibuat.`, type: 'success' });
      setNewName('');
      fetchSessions();
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Gagal', type: 'error' });
    } finally {
      setCreating(false);
    }
  }

  async function handleClose() {
    if (!confirmClose) return;
    setActionLoading(true);
    try {
      await fetchJsonOrThrow('/api/admin/live-sessions/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: confirmClose.id }),
      }, 'Gagal menutup sesi');
      setToast({ msg: 'Sesi live berhasil ditutup.', type: 'success' });
      setConfirmClose(null);
      fetchSessions();
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Gagal', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    if (!confirmCancel) return;
    setActionLoading(true);
    try {
      await fetchJsonOrThrow('/api/admin/live-sessions/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: confirmCancel.id }),
      }, 'Gagal membatalkan sesi');
      setToast({ msg: 'Sesi live berhasil dibatalkan.', type: 'success' });
      setConfirmCancel(null);
      fetchSessions();
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Gagal', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleExport(session: LiveSession, format: 'csv' | 'json') {
    setExporting(session.id);
    try {
      const blob = await fetchBlobOrThrow('/api/admin/orders/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          export_type: 'live_session_export',
          file_format: format,
          live_session_id: session.id,
        }),
      }, 'Export gagal. Silakan coba lagi atau hubungi admin teknis.');
      const slug = session.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      const dateStr = session.started_at.substring(0, 10);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders_live_${slug}_${dateStr}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      setToast({ msg: 'Export berhasil. Order ditandai downloaded.', type: 'success' });
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Export gagal', type: 'error' });
    } finally {
      setExporting(null);
    }
  }

  return (
    <AdminShell>
      <PageHeader
        title="Live Sessions"
        subtitle="Wadah event live untuk kode RL & SL"
      />

      {/* Create form */}
      <section className="card p-5 mb-6">
        <h3 className="text-xs font-mono uppercase tracking-wider text-ink-500 mb-3">
          Buat Sesi Live Baru
        </h3>
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[240px]">
            <label className="label">Nama Sesi</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="cth: Live Malam 27 April"
              className="input"
              required
              maxLength={100}
            />
          </div>
          <button type="submit" disabled={creating || !newName.trim()} className="btn-primary">
            {creating ? 'Membuat...' : '+ Buat Sesi'}
          </button>
          <p className="text-xs text-ink-500 ml-auto max-w-md">
            Sesi baru otomatis berstatus <span className="badge-green">active</span>. Pakai sesi ini saat import kode RL/SL.
          </p>
        </form>
      </section>

      {/* Filter */}
      <div className="mb-4 flex items-end gap-3">
        <div>
          <label className="label">Filter status</label>
          <select className="input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Semua</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Sessions list */}
      {error && (
        <div className="card p-4 bg-red-50 border-red-200 text-red-700 text-sm mb-4">{error}</div>
      )}

      {loading && sessions.length === 0 ? (
        <div className="card p-12 text-center text-ink-400">Memuat...</div>
      ) : sessions.length === 0 ? (
        <div className="card p-12 text-center text-ink-400">
          Belum ada sesi live. Buat sesi live terlebih dahulu.
        </div>
      ) : (
        <div className="grid gap-4">
          {sessions.map((s) => (
            <div key={s.id} className="card p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-display text-xl font-semibold text-ink-900">{s.name}</h3>
                    <SessionStatusBadge status={s.status} />
                  </div>
                  <div className="text-xs text-ink-500 font-mono">
                    Mulai: {new Date(s.started_at).toLocaleString('id-ID')}
                    {s.closed_at && (
                      <> · Ditutup: {new Date(s.closed_at).toLocaleString('id-ID')}</>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {s.status === 'active' && (
                    <>
                      <button onClick={() => setConfirmClose(s)} className="btn-secondary text-xs">
                        ⏹ Close
                      </button>
                      <button onClick={() => setConfirmCancel(s)} className="btn-secondary text-xs text-red-600">
                        ✕ Cancel
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleExport(s, 'csv')}
                    disabled={exporting === s.id}
                    className="btn-primary text-xs"
                  >
                    ⬇ CSV
                  </button>
                  <button
                    onClick={() => handleExport(s, 'json')}
                    disabled={exporting === s.id}
                    className="btn-secondary text-xs"
                  >
                    ⬇ JSON
                  </button>
                </div>
              </div>

              {/* Code stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-5 border-t border-ink-100">
                <SessionStat label="Total Kode" value={s.code_stats.total} />
                <SessionStat label="Unused" value={s.code_stats.unused} dot="bg-green-400" />
                <SessionStat label="Used" value={s.code_stats.used} dot="bg-ink-400" />
                <SessionStat label="Expired" value={s.code_stats.expired} dot="bg-red-400" />
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmClose}
        title="Close Live Session"
        message={`Yakin ingin menutup live session "${confirmClose?.name}"?\n\nKode RL/SL yang belum digunakan dari session ini tidak bisa dipakai lagi.\nOrder yang sudah masuk tetap aman.`}
        confirmLabel="Ya, tutup"
        loading={actionLoading}
        onConfirm={handleClose}
        onCancel={() => setConfirmClose(null)}
      />

      <ConfirmDialog
        open={!!confirmCancel}
        title="Cancel Live Session"
        message={`Yakin ingin membatalkan live session "${confirmCancel?.name}"?\n\nKode RL/SL yang belum digunakan tidak bisa dipakai lagi.\nOrder yang sudah masuk tetap aman.`}
        confirmLabel="Ya, batalkan"
        variant="danger"
        loading={actionLoading}
        onConfirm={handleCancel}
        onCancel={() => setConfirmCancel(null)}
      />

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </AdminShell>
  );
}

function SessionStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'badge-green',
    closed: 'badge-gray',
    cancelled: 'badge-red',
  };
  return <span className={map[status] || 'badge-gray'}>{status}</span>;
}

function SessionStat({ label, value, dot }: { label: string; value: number; dot?: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        {dot && <span className={`w-2 h-2 rounded-full ${dot}`} />}
        <div className="text-xs text-ink-500">{label}</div>
      </div>
      <div className="font-display text-2xl font-semibold text-ink-900">
        {value.toLocaleString('id-ID')}
      </div>
    </div>
  );
}
