'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import AdminShell from '@/components/AdminShell';
import PageHeader from '@/components/PageHeader';
import ConfirmDialog from '@/components/ConfirmDialog';
import Toast, { type ToastType } from '@/components/Toast';
import { fetchJsonOrThrow } from '@/lib/client-api';
import {
  PACKAGE_CODES, PACKAGE_LABELS, CODE_STATUSES, isLivePackage, type PackageCode,
} from '@/lib/constants';

interface OrderCode {
  id: string;
  code: string;
  package_code: string;
  status: string;
  live_session_id: string | null;
  used_at: string | null;
  created_at: string;
  live_sessions?: { name: string; status: string } | null;
}

interface LiveSession {
  id: string;
  name: string;
  status: string;
}

interface TrialCode {
  id: string;
  code: string;
  label: string | null;
  package_code: PackageCode;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function extractCodeFromRow(row: unknown): string {
  if (typeof row === 'string') return row;
  if (!row || typeof row !== 'object') return '';

  const record = row as Record<string, unknown>;
  const value = record.code ?? record.kode ?? record.order_code;
  return typeof value === 'string' ? value : '';
}

function parseCodesFromCsv(text: string): string[] {
  const headerResult = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase(),
  });

  const fields = headerResult.meta.fields ?? [];
  const codeField = fields.find((field) => ['code', 'kode', 'order_code'].includes(field));
  if (codeField) {
    return headerResult.data
      .map((row) => row[codeField])
      .filter((code): code is string => typeof code === 'string' && code.trim().length > 0);
  }

  const plainResult = Papa.parse<string[]>(text, { header: false, skipEmptyLines: true });
  return plainResult.data
    .flat()
    .filter((cell): cell is string => typeof cell === 'string' && cell.trim().length > 0)
    .filter((cell, index) => index !== 0 || !['code', 'kode', 'order_code'].includes(cell.trim().toLowerCase()));
}

export default function CodesPage() {
  const [codes, setCodes] = useState<OrderCode[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState('');
  const [filterPackage, setFilterPackage] = useState('');
  const [search, setSearch] = useState('');

  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Import state
  const [importPackage, setImportPackage] = useState<PackageCode>('HM');
  const [importSessionId, setImportSessionId] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<null | {
    total: number; inserted: number; rejected: { code: string; reason: string }[];
  }>(null);
  const [activeSessions, setActiveSessions] = useState<LiveSession[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [trialEnabled, setTrialEnabled] = useState(false);
  const [trialCodes, setTrialCodes] = useState<TrialCode[]>([]);
  const [trialLoading, setTrialLoading] = useState(false);
  const [savingTrial, setSavingTrial] = useState(false);
  const [editingTrialId, setEditingTrialId] = useState<string | null>(null);
  const [trialForm, setTrialForm] = useState({
    code: 'TRIAL2026',
    label: 'Trial Admin',
    package_code: 'HM' as PackageCode,
    notes: '',
    is_active: true,
  });

  // Expire confirm
  const [confirmExpire, setConfirmExpire] = useState<{ ids: string[]; label: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);

  const fetchCodes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (filterStatus) params.set('status', filterStatus);
      if (filterPackage) params.set('package_code', filterPackage);
      if (search.trim()) params.set('search', search.trim().toUpperCase());

      const json = await fetchJsonOrThrow<{ data: OrderCode[]; total: number }>(
        `/api/admin/codes/list?${params}`,
        undefined,
        'Gagal memuat data. Silakan refresh halaman.'
      );
      setCodes(json.data || []);
      setTotal(json.total || 0);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filterStatus, filterPackage, search]);

  const fetchActiveSessions = useCallback(async () => {
    try {
      const json = await fetchJsonOrThrow<{ data: LiveSession[] }>(
        '/api/admin/live-sessions/list?status=active',
        undefined,
        'Gagal memuat live session aktif.'
      );
      setActiveSessions(json.data || []);
    } catch { /* ignore */ }
  }, []);

  const fetchTrialCodes = useCallback(async () => {
    setTrialLoading(true);
    try {
      const r = await fetch('/api/admin/trial-codes');
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || 'Gagal memuat kode trial.');
      setTrialEnabled(json.settings?.enabled === true);
      setTrialCodes(json.data || []);
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Gagal memuat kode trial.', type: 'error' });
    } finally {
      setTrialLoading(false);
    }
  }, []);

  useEffect(() => { fetchCodes(); }, [fetchCodes]);
  useEffect(() => { fetchActiveSessions(); }, [fetchActiveSessions]);
  useEffect(() => { fetchTrialCodes(); }, [fetchTrialCodes]);

  function toggleSelect(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  function toggleSelectAll() {
    if (selected.size === codes.filter((c) => c.status === 'unused').length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(codes.filter((c) => c.status === 'unused').map((c) => c.id)));
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isLivePackage(importPackage) && !importSessionId) {
      setToast({ msg: 'Paket RL/SL wajib dipasangkan dengan live session aktif.', type: 'error' });
      return;
    }

    let codes: string[] = [];
    try {
      const text = await file.text();
      if (file.name.endsWith('.json')) {
        const parsed = JSON.parse(text);
        const arr = Array.isArray(parsed) ? parsed : [];
        codes = arr.map(extractCodeFromRow);
      } else {
        codes = parseCodesFromCsv(text);
      }
    } catch {
      setToast({ msg: 'File tidak valid. Pastikan format CSV atau JSON.', type: 'error' });
      return;
    }

    if (codes.length === 0) {
      setToast({ msg: 'File kosong / tidak mengandung kode.', type: 'error' });
      return;
    }

    setImporting(true);
    setImportResult(null);
    try {
      const json = await fetchJsonOrThrow<{
        total: number;
        inserted: number;
        rejected: { code: string; reason: string }[];
      }>('/api/admin/codes/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codes,
          package_code: importPackage,
          live_session_id: isLivePackage(importPackage) ? importSessionId : null,
        }),
      }, 'Import gagal');
      setImportResult(json);
      setToast({
        msg: `${json.inserted} dari ${json.total} kode berhasil diimport.`,
        type: json.rejected.length > 0 ? 'info' : 'success',
      });
      fetchCodes();
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Import gagal', type: 'error' });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleExpire() {
    if (!confirmExpire) return;
    setActionLoading(true);
    try {
      const json = await fetchJsonOrThrow<{ expired: number }>('/api/admin/codes/expire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: confirmExpire.ids }),
      }, 'Expire gagal');
      setToast({ msg: `${json.expired} kode berhasil di-expire.`, type: 'success' });
      setConfirmExpire(null);
      fetchCodes();
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Expire gagal', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleExportCodes(format: 'csv' | 'json') {
    const params = new URLSearchParams({ format });
    if (filterStatus) params.set('status', filterStatus);
    if (filterPackage) params.set('package_code', filterPackage);
    window.location.href = `/api/admin/codes/export?${params}`;
  }

  async function toggleTrialEnabled(next: boolean) {
    setTrialEnabled(next);
    try {
      const r = await fetch('/api/admin/trial-codes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { enabled: next } }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || 'Gagal update status trial.');
      setToast({ msg: next ? 'Akses trial diaktifkan.' : 'Akses trial dinonaktifkan.', type: 'success' });
    } catch (e) {
      setTrialEnabled(!next);
      setToast({ msg: e instanceof Error ? e.message : 'Gagal update status trial.', type: 'error' });
    }
  }

  function resetTrialForm() {
    setEditingTrialId(null);
    setTrialForm({
      code: 'TRIAL2026',
      label: 'Trial Admin',
      package_code: 'HM',
      notes: '',
      is_active: true,
    });
  }

  function editTrialCode(code: TrialCode) {
    setEditingTrialId(code.id);
    setTrialForm({
      code: code.code,
      label: code.label || '',
      package_code: code.package_code,
      notes: code.notes || '',
      is_active: code.is_active,
    });
  }

  async function saveTrialCode() {
    setSavingTrial(true);
    try {
      const r = await fetch('/api/admin/trial-codes', {
        method: editingTrialId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingTrialId,
          code: trialForm.code,
          label: trialForm.label,
          package_code: trialForm.package_code,
          notes: trialForm.notes,
          is_active: trialForm.is_active,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || 'Gagal menyimpan kode trial.');
      setToast({ msg: editingTrialId ? 'Kode trial diupdate.' : 'Kode trial ditambahkan.', type: 'success' });
      resetTrialForm();
      await fetchTrialCodes();
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Gagal menyimpan kode trial.', type: 'error' });
    } finally {
      setSavingTrial(false);
    }
  }

  async function toggleTrialCode(code: TrialCode) {
    try {
      const r = await fetch('/api/admin/trial-codes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: code.id, is_active: !code.is_active }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || 'Gagal update kode trial.');
      await fetchTrialCodes();
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Gagal update kode trial.', type: 'error' });
    }
  }

  async function deleteTrialCode(code: TrialCode) {
    if (!window.confirm(`Hapus kode trial ${code.code}?`)) return;
    try {
      const r = await fetch('/api/admin/trial-codes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: code.id }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || 'Gagal hapus kode trial.');
      setToast({ msg: 'Kode trial dihapus.', type: 'success' });
      await fetchTrialCodes();
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Gagal hapus kode trial.', type: 'error' });
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <AdminShell>
      <PageHeader
        title="Kode Pesanan"
        subtitle={`${total.toLocaleString('id-ID')} kode di database`}
        actions={
          <>
            <button onClick={() => handleExportCodes('csv')} className="btn-secondary">⬇ CSV</button>
            <button onClick={() => handleExportCodes('json')} className="btn-secondary">⬇ JSON</button>
          </>
        }
      />

      {/* Import section */}
      <section className="card p-5 mb-6">
        <h3 className="text-xs font-mono uppercase tracking-wider text-ink-500 mb-3">
          Import Kode dari CSV / JSON
        </h3>
        <p className="text-xs text-ink-500 mb-4 max-w-2xl">
          Kode dibuat di aplikasi HP/PC, lalu file CSV/JSON-nya diimport di sini.
          Web admin tidak generate kode sendiri — hanya menerima dan validasi.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="label">Package Code</label>
            <select className="input" value={importPackage} onChange={(e) => setImportPackage(e.target.value as PackageCode)}>
              {PACKAGE_CODES.map((p) => (
                <option key={p} value={p}>{p} — {PACKAGE_LABELS[p]}</option>
              ))}
            </select>
          </div>
          {isLivePackage(importPackage) && (
            <div>
              <label className="label">Live Session (wajib)</label>
              <select className="input" value={importSessionId} onChange={(e) => setImportSessionId(e.target.value)}>
                <option value="">— Pilih sesi aktif —</option>
                {activeSessions.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {activeSessions.length === 0 && (
                <p className="text-xs text-amber-700 mt-1">Belum ada sesi live aktif. Buat dulu di menu Live Sessions.</p>
              )}
            </div>
          )}
          <div className="flex items-end">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json"
              onChange={handleFileSelect}
              disabled={importing}
              className="block w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-ink-900 file:text-white file:cursor-pointer hover:file:bg-ink-800"
            />
          </div>
        </div>

        {importing && <p className="text-sm text-ink-500">Memproses file...</p>}

        {importResult && (
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border border-ink-100 p-3">
              <div className="text-2xl font-display font-semibold">{importResult.total}</div>
              <div className="text-xs text-ink-500">Total di file</div>
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <div className="text-2xl font-display font-semibold text-green-700">{importResult.inserted}</div>
              <div className="text-xs text-green-700">Berhasil insert</div>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <div className="text-2xl font-display font-semibold text-red-700">{importResult.rejected.length}</div>
              <div className="text-xs text-red-700">Ditolak</div>
            </div>

            {importResult.rejected.length > 0 && (
              <div className="col-span-3 mt-3 max-h-48 overflow-y-auto border border-red-200 bg-red-50 rounded-lg p-3 text-left">
                <div className="text-xs font-medium text-red-800 mb-2">
                  Beberapa kode gagal diimport. Silakan cek daftar error di bawah:
                </div>
                <ul className="text-xs space-y-1 font-mono">
                  {importResult.rejected.slice(0, 100).map((r, i) => (
                    <li key={i} className="text-red-700">
                      <span className="font-semibold">{r.code}</span> — {r.reason}
                    </li>
                  ))}
                </ul>
                {importResult.rejected.length > 100 && (
                  <div className="text-xs text-red-700 mt-2">+{importResult.rejected.length - 100} lainnya...</div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="card p-5 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-ink-500 mb-1">
              Kode Trial Admin
            </h3>
            <p className="text-xs text-ink-500 max-w-2xl">
              Satu kode trial bisa dipakai berulang untuk masuk form customer. Order yang masuk akan ditandai sebagai trial.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-ink-700">
            <input
              type="checkbox"
              checked={trialEnabled}
              onChange={(e) => toggleTrialEnabled(e.target.checked)}
            />
            Aktifkan akses trial
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr_140px_1.3fr_auto] gap-3 items-end">
          <div>
            <label className="label">Kode Trial</label>
            <input
              className="input font-mono uppercase"
              value={trialForm.code}
              onChange={(e) => setTrialForm((current) => ({ ...current, code: e.target.value.toUpperCase().trim() }))}
              maxLength={32}
              placeholder="TRIAL2026"
            />
          </div>
          <div>
            <label className="label">Label</label>
            <input
              className="input"
              value={trialForm.label}
              onChange={(e) => setTrialForm((current) => ({ ...current, label: e.target.value }))}
              placeholder="Trial Admin"
            />
          </div>
          <div>
            <label className="label">Paket</label>
            <select
              className="input"
              value={trialForm.package_code}
              onChange={(e) => setTrialForm((current) => ({ ...current, package_code: e.target.value as PackageCode }))}
            >
              {PACKAGE_CODES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Catatan</label>
            <input
              className="input"
              value={trialForm.notes}
              onChange={(e) => setTrialForm((current) => ({ ...current, notes: e.target.value }))}
              placeholder="Opsional"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={saveTrialCode} disabled={savingTrial} className="btn-primary whitespace-nowrap">
              {savingTrial ? 'Menyimpan...' : editingTrialId ? 'Update' : 'Tambah'}
            </button>
            {editingTrialId && (
              <button onClick={resetTrialForm} className="btn-secondary whitespace-nowrap">
                Batal
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-ink-100">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-ink-600 text-xs uppercase tracking-wide font-mono">
              <tr>
                <th className="text-left px-4 py-3">Kode</th>
                <th className="text-left px-4 py-3">Label</th>
                <th className="text-left px-4 py-3">Paket</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {trialLoading ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-ink-400">Memuat kode trial...</td></tr>
              ) : trialCodes.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-ink-400">Belum ada kode trial.</td></tr>
              ) : trialCodes.map((code) => (
                <tr key={code.id}>
                  <td className="px-4 py-3 font-mono font-semibold">{code.code}</td>
                  <td className="px-4 py-3">{code.label || '—'}</td>
                  <td className="px-4 py-3"><span className="badge-purple">{code.package_code}</span> {PACKAGE_LABELS[code.package_code]}</td>
                  <td className="px-4 py-3">
                    <span className={code.is_active ? 'badge-green' : 'badge-gray'}>
                      {code.is_active ? 'active' : 'off'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button className="text-xs text-ink-600 hover:underline" onClick={() => editTrialCode(code)}>Edit</button>
                    <button className="text-xs text-accent-deep hover:underline" onClick={() => toggleTrialCode(code)}>
                      {code.is_active ? 'Off' : 'On'}
                    </button>
                    <button className="text-xs text-red-600 hover:underline" onClick={() => deleteTrialCode(code)}>Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Filter bar */}
      <section className="card p-5 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="label">Cari kode</label>
            <input type="text" placeholder="cth: HM7A!9KQ2P" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input font-mono" />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}>
              <option value="">Semua</option>
              {CODE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Paket</label>
            <select className="input" value={filterPackage} onChange={(e) => { setFilterPackage(e.target.value); setPage(1); }}>
              <option value="">Semua</option>
              {PACKAGE_CODES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        {selected.size > 0 && (
          <div className="mt-4 flex items-center gap-3 pt-4 border-t border-ink-100">
            <span className="text-sm text-ink-700 font-medium">{selected.size} kode dipilih</span>
            <button
              className="btn-danger text-xs"
              onClick={() => setConfirmExpire({ ids: [...selected], label: `${selected.size} kode terpilih` })}
            >
              Expire kode terpilih
            </button>
          </div>
        )}
      </section>

      {/* Table */}
      <section className="card overflow-hidden">
        {error && <div className="px-5 py-4 bg-red-50 text-red-700 text-sm border-b border-red-100">{error}</div>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-ink-600 text-xs uppercase tracking-wide font-mono">
              <tr>
                <th className="px-3 py-3 w-10">
                  <input type="checkbox"
                    checked={selected.size > 0 && selected.size === codes.filter((c) => c.status === 'unused').length}
                    onChange={toggleSelectAll} />
                </th>
                <th className="text-left px-4 py-3">Kode</th>
                <th className="text-left px-4 py-3">Paket</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Live Session</th>
                <th className="text-left px-4 py-3">Used At</th>
                <th className="text-left px-4 py-3">Created</th>
                <th className="text-right px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {loading && codes.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-ink-400">Memuat...</td></tr>
              ) : codes.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-ink-400">
                  Belum ada kode pesanan. Silakan import kode terlebih dahulu.
                </td></tr>
              ) : codes.map((c) => (
                <tr key={c.id} className="hover:bg-ink-50/50">
                  <td className="px-3 py-3">
                    {c.status === 'unused' ? (
                      <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} />
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono font-medium">{c.code}</td>
                  <td className="px-4 py-3">
                    <span className="badge-purple">{c.package_code}</span>{' '}
                    <span className="text-ink-500 text-xs">{PACKAGE_LABELS[c.package_code as PackageCode]}</span>
                  </td>
                  <td className="px-4 py-3"><CodeStatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 text-ink-600">
                    {c.live_sessions ? (
                      <span>
                        {c.live_sessions.name}{' '}
                        <span className="text-xs text-ink-400">({c.live_sessions.status})</span>
                      </span>
                    ) : <span className="text-ink-400">—</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{c.used_at ? new Date(c.used_at).toLocaleString('id-ID') : '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{new Date(c.created_at).toLocaleDateString('id-ID')}</td>
                  <td className="px-4 py-3 text-right">
                    {c.status === 'unused' && (
                      <button className="text-xs text-red-600 hover:underline"
                        onClick={() => setConfirmExpire({ ids: [c.id], label: c.code })}>
                        Expire
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-ink-100 bg-ink-50/40">
            <div className="text-xs text-ink-500 font-mono">Halaman {page} dari {totalPages}</div>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-xs">‹ Prev</button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-secondary text-xs">Next ›</button>
            </div>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={!!confirmExpire}
        title="Expire Kode"
        message={`Yakin ingin expire ${confirmExpire?.label}?\n\nKode yang sudah expired tidak bisa digunakan customer.\nAksi ini tidak menghapus kode dari database.\nKode expired bersifat irreversible.`}
        confirmLabel="Ya, expire"
        variant="danger"
        loading={actionLoading}
        onConfirm={handleExpire}
        onCancel={() => setConfirmExpire(null)}
      />

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </AdminShell>
  );
}

function CodeStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    unused: 'badge-green',
    used: 'badge-gray',
    expired: 'badge-red',
  };
  return <span className={map[status] || 'badge-gray'}>{status}</span>;
}
