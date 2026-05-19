'use client';

import { useEffect, useState, useCallback } from 'react';
import AdminShell from '@/components/AdminShell';
import PageHeader from '@/components/PageHeader';
import ConfirmDialog from '@/components/ConfirmDialog';
import Toast, { type ToastType } from '@/components/Toast';
import { fetchBlobOrThrow, fetchJsonOrThrow } from '@/lib/client-api';
import { PACKAGE_CODES, PACKAGE_LABELS } from '@/lib/constants';

interface Order {
  id: string;
  public_order_id: string;
  order_code: string;
  is_trial?: boolean;
  trial_code?: string | null;
  package_code: string;
  package_label: string;
  status: string;
  download_status: string;
  nama_pemesan: string;
  whatsapp_full: string;
  nickname_anak: string;
  theme_name: string;
  tanggal_acara: string;
  created_at: string;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterPackage, setFilterPackage] = useState('');
  const [filterDownload, setFilterDownload] = useState('');
  const [search, setSearch] = useState('');

  const [confirmCancel, setConfirmCancel] = useState<Order | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);

  const [exportDate, setExportDate] = useState(new Date().toISOString().substring(0, 10));
  const [exporting, setExporting] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (filterPackage) params.set('package_code', filterPackage);
      if (filterDownload) params.set('download_status', filterDownload);
      if (search.trim()) params.set('search', search.trim());

      const json = await fetchJsonOrThrow<{ data: Order[]; total: number }>(
        `/api/admin/orders/list?${params}`,
        undefined,
        'Gagal memuat data. Silakan refresh halaman.'
      );
      setOrders(json.data || []);
      setTotal(json.total || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filterPackage, filterDownload, search]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  async function handleCancel() {
    if (!confirmCancel) return;
    setActionLoading(true);
    try {
      await fetchJsonOrThrow('/api/admin/orders/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: confirmCancel.id }),
      }, 'Gagal membatalkan order');
      setToast({ msg: 'Order berhasil dibatalkan.', type: 'success' });
      setConfirmCancel(null);
      fetchOrders();
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Gagal', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleExportDaily(format: 'csv' | 'json') {
    setExporting(true);
    try {
      const blob = await fetchBlobOrThrow('/api/admin/orders/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ export_type: 'daily_export', file_format: format, date: exportDate }),
      }, 'Export gagal. Silakan coba lagi atau hubungi admin teknis.');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders_daily_${exportDate}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      setToast({ msg: 'Export berhasil. Order ditandai sebagai downloaded.', type: 'success' });
      fetchOrders();
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Gagal', type: 'error' });
    } finally {
      setExporting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <AdminShell>
      <PageHeader
        title="Pesanan"
        subtitle={`${total.toLocaleString('id-ID')} order${total > 0 ? '' : ''} ditampilkan`}
      />

      {/* Export bar */}
      <section className="card p-5 mb-6">
        <h3 className="text-xs font-mono uppercase tracking-wider text-ink-500 mb-3">
          Export Harian
        </h3>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Tanggal</label>
            <input
              type="date"
              value={exportDate}
              onChange={(e) => setExportDate(e.target.value)}
              className="input"
            />
          </div>
          <button onClick={() => handleExportDaily('csv')} disabled={exporting} className="btn-primary">
            ⬇ Download CSV
          </button>
          <button onClick={() => handleExportDaily('json')} disabled={exporting} className="btn-secondary">
            ⬇ Download JSON
          </button>
          <p className="text-xs text-ink-500 ml-auto max-w-md">
            File diberi nama <span className="font-mono">orders_daily_{exportDate}.csv/json</span>. Order yang berhasil diexport akan ditandai sebagai <span className="font-mono">downloaded</span>.
          </p>
        </div>
      </section>

      {/* Filter bar */}
      <section className="card p-5 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="label">Cari</label>
            <input
              type="text"
              placeholder="Cari ID, kode, nama, WA, nickname..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input"
            />
          </div>
          <div>
            <label className="label">Paket</label>
            <select className="input" value={filterPackage} onChange={(e) => { setFilterPackage(e.target.value); setPage(1); }}>
              <option value="">Semua</option>
              {PACKAGE_CODES.map((p) => <option key={p} value={p}>{p} — {PACKAGE_LABELS[p]}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Download</label>
            <select className="input" value={filterDownload} onChange={(e) => { setFilterDownload(e.target.value); setPage(1); }}>
              <option value="">Semua</option>
              <option value="not_downloaded">Belum diunduh</option>
              <option value="downloaded">Sudah diunduh</option>
            </select>
          </div>
        </div>
      </section>

      {/* Table */}
      <section className="card overflow-hidden">
        {error && (
          <div className="px-5 py-4 bg-red-50 text-red-700 text-sm border-b border-red-100">{error}</div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-ink-600 text-xs uppercase tracking-wide font-mono">
              <tr>
                <th className="text-left px-4 py-3">Order ID</th>
                <th className="text-left px-4 py-3">Kode</th>
                <th className="text-left px-4 py-3">Paket</th>
                <th className="text-left px-4 py-3">Pemesan</th>
                <th className="text-left px-4 py-3">Anak</th>
                <th className="text-left px-4 py-3">Tema</th>
                <th className="text-left px-4 py-3">Acara</th>
                <th className="text-left px-4 py-3">Download</th>
                <th className="text-right px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {loading && orders.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-ink-400">Memuat...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-ink-400">
                  {search || filterPackage || filterDownload
                    ? 'Tidak ada data yang sesuai dengan filter.'
                    : 'Belum ada order masuk.'}
                </td></tr>
              ) : orders.map((o) => (
                <tr key={o.id} className="hover:bg-ink-50/50">
                  <td className="px-4 py-3 font-mono text-xs text-ink-700">{o.public_order_id}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    <div>{o.order_code}</div>
                    {o.is_trial && <span className="badge-purple mt-1 inline-block">TRIAL</span>}
                  </td>
                  <td className="px-4 py-3"><span className="badge-purple">{o.package_code}</span> <span className="text-ink-500">{o.package_label}</span></td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink-800">{o.nama_pemesan}</div>
                    <div className="text-xs text-ink-500">{o.whatsapp_full}</div>
                  </td>
                  <td className="px-4 py-3">{o.nickname_anak}</td>
                  <td className="px-4 py-3 text-ink-600">{o.theme_name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{o.tanggal_acara}</td>
                  <td className="px-4 py-3">
                    {o.download_status === 'downloaded'
                      ? <span className="badge-green">✓ Sudah</span>
                      : <span className="badge-gray">Belum</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {o.status !== 'cancelled' && (
                      <button
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => setConfirmCancel(o)}
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-ink-100 bg-ink-50/40">
            <div className="text-xs text-ink-500 font-mono">
              Halaman {page} dari {totalPages}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-xs">‹ Prev</button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-secondary text-xs">Next ›</button>
            </div>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={!!confirmCancel}
        title="Cancel Order"
        message={`Yakin ingin membatalkan order ini?\n\nKode pesanan tetap tidak bisa dipakai ulang.\n\n${confirmCancel?.public_order_id ?? ''}`}
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
