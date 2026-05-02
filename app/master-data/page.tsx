'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AdminShell from '@/components/AdminShell';
import ConfirmDialog from '@/components/ConfirmDialog';
import PageHeader from '@/components/PageHeader';
import Toast, { type ToastType } from '@/components/Toast';
import { fetchJsonOrThrow } from '@/lib/client-api';
import { GENDERS, GENDER_LABELS, type Gender } from '@/lib/constants';

type SortOrder = 'newest' | 'oldest';

interface CharacterAsset {
  id: string;
  asset_code: string;
  gender: Gender;
  hair_style_code: string;
  eyeglasses_code: string;
  image_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface FormState {
  id: string | null;
  gender: Gender;
  hair_style_code: string;
  eyeglasses_code: string;
  asset_code: string;
  image_url: string;
  is_active: boolean;
}

const CODE_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const HAIR_CODES = CODE_LETTERS.map((letter) => `H${letter}`);
const EYEGLASSES_CODES = CODE_LETTERS.map((letter) => `E${letter}`);

const emptyForm: FormState = {
  id: null,
  gender: 'girl',
  hair_style_code: 'HA',
  eyeglasses_code: 'EA',
  asset_code: 'GIRL-HA-EA',
  image_url: '',
  is_active: true,
};

function buildAssetCode(gender: Gender, hairCode: string, eyeglassesCode: string) {
  return `${gender.toUpperCase()}-${hairCode}-${eyeglassesCode}`;
}

function formatDate(input: string) {
  return new Date(input).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function MasterDataPage() {
  const [rows, setRows] = useState<CharacterAsset[]>([]);
  const [form, setForm] = useState<FormState>({ ...emptyForm });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<CharacterAsset | null>(null);
  const [confirmReplace, setConfirmReplace] = useState<CharacterAsset | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [filterGender, setFilterGender] = useState('');
  const [filterActive, setFilterActive] = useState('');
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ resource: 'character_assets' });
      const json = await fetchJsonOrThrow<{ data: CharacterAsset[] }>(
        `/api/admin/master-data?${params}`,
        undefined,
        'Gagal memuat character assets.'
      );
      setRows(json.data || []);
    } catch (e) {
      setRows([]);
      setToast({
        msg: e instanceof Error ? e.message : 'Gagal memuat character assets.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAssets();
  }, [fetchAssets]);

  useEffect(() => {
    const assetCode = buildAssetCode(form.gender, form.hair_style_code, form.eyeglasses_code);
    if (assetCode === form.asset_code) return;
    setForm((current) => ({
      ...current,
      asset_code: buildAssetCode(current.gender, current.hair_style_code, current.eyeglasses_code),
    }));
  }, [form.asset_code, form.eyeglasses_code, form.gender, form.hair_style_code]);

  const existingAsset = rows.find((row) => row.asset_code === form.asset_code) ?? null;
  const filteredRows = useMemo(() => {
    const query = search.trim().toUpperCase();

    return rows
      .filter((row) => (filterGender ? row.gender === filterGender : true))
      .filter((row) => (filterActive ? String(row.is_active) === filterActive : true))
      .filter((row) => (query ? row.asset_code.includes(query) : true))
      .sort((a, b) => {
        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();
        return sortOrder === 'newest' ? bTime - aTime : aTime - bTime;
      });
  }, [filterActive, filterGender, rows, search, sortOrder]);

  function updateForm(next: Partial<FormState>) {
    setEditMode(false);
    setForm((current) => {
      const merged = { ...current, ...next };
      return {
        ...merged,
        id: null,
        image_url: '',
        is_active: true,
        asset_code: buildAssetCode(merged.gender, merged.hair_style_code, merged.eyeglasses_code),
      };
    });
  }

  function resetForm() {
    setEditMode(false);
    setForm({ ...emptyForm });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function openEdit(row: CharacterAsset) {
    setEditMode(true);
    setForm({
      id: row.id,
      gender: row.gender,
      hair_style_code: row.hair_style_code,
      eyeglasses_code: row.eyeglasses_code,
      asset_code: row.asset_code,
      image_url: row.image_url,
      is_active: row.is_active,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('asset_code', form.asset_code);
      formData.append('file', file);

      const json = await fetchJsonOrThrow<{ data?: { image_url?: string } }>('/api/admin/character-assets/image', {
        method: 'POST',
        body: formData,
      }, 'Upload character asset gagal.');

      setForm((current) => ({
        ...current,
        image_url: json.data?.image_url ?? current.image_url,
      }));
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Upload image gagal.', type: 'error' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function saveAsset(mode: 'create' | 'update', targetId?: string) {
    setSaving(true);
    try {
      await fetchJsonOrThrow('/api/admin/master-data', {
        method: mode === 'update' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource: 'character_assets',
          id: targetId ?? form.id,
          values: {
            asset_code: form.asset_code,
            gender: form.gender,
            hair_style_code: form.hair_style_code,
            eyeglasses_code: form.eyeglasses_code,
            image_url: form.image_url,
            is_active: form.is_active,
          },
        }),
      }, 'Gagal menyimpan character asset.');

      setToast({
        msg: mode === 'update' ? 'Character asset berhasil diupdate.' : 'Character asset berhasil dibuat.',
        type: 'success',
      });
      setConfirmReplace(null);
      resetForm();
      await fetchAssets();
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Gagal menyimpan character asset.', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.image_url) {
      setToast({ msg: 'Upload image character asset dulu sebelum submit.', type: 'error' });
      return;
    }

    if (editMode && form.id) {
      await saveAsset('update', form.id);
      return;
    }

    if (existingAsset) {
      setConfirmReplace(existingAsset);
      return;
    }

    await saveAsset('create');
  }

  async function toggleStatus(row: CharacterAsset) {
    setSaving(true);
    try {
      await fetchJsonOrThrow('/api/admin/master-data', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource: 'character_assets',
          id: row.id,
          action: row.is_active ? 'deactivate' : 'reactivate',
        }),
      }, 'Gagal mengubah status.');

      setToast({ msg: 'Status asset berhasil diubah.', type: 'success' });
      setConfirmStatus(null);
      await fetchAssets();
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Gagal mengubah status.', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  const combinationStatus = existingAsset
    ? existingAsset.is_active ? 'Sudah ada asset aktif' : 'Sudah ada asset nonaktif'
    : 'Belum ada asset';
  const combinationBadge = existingAsset
    ? existingAsset.is_active ? 'badge-green' : 'badge-red'
    : 'badge-amber';

  return (
    <AdminShell>
      <PageHeader
        title="Master Data"
        subtitle="Kelola character assets final untuk pilihan karakter customer"
      />

      <section className="card mb-6 p-5">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink-900">
              {editMode ? 'Edit Character Asset' : 'Character Asset Editor'}
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              Default customer memakai GIRL-HA-EA atau BOY-HA-EA.
            </p>
          </div>
          <span className={combinationBadge}>{combinationStatus}</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(260px,0.8fr)_minmax(360px,1.2fr)]">
            <div className="space-y-4">
              <div>
                <label className="label">Gender</label>
                <select
                  value={form.gender}
                  onChange={(e) => updateForm({ gender: e.target.value as Gender })}
                  className="input"
                >
                  {GENDERS.map((gender) => (
                    <option key={gender} value={gender}>{GENDER_LABELS[gender]}</option>
                  ))}
                </select>
              </div>

              <CodePicker
                label="Hair Style"
                value={form.hair_style_code}
                options={HAIR_CODES}
                onChange={(hair_style_code) => updateForm({ hair_style_code })}
              />

              <CodePicker
                label="Eyeglasses"
                value={form.eyeglasses_code}
                options={EYEGLASSES_CODES}
                onChange={(eyeglasses_code) => updateForm({ eyeglasses_code })}
              />
            </div>

            <div className="rounded-lg border border-ink-100 bg-ink-50/60 p-4">
              <div className="flex flex-col gap-4 md:flex-row">
                <div className="flex min-h-[300px] flex-1 items-center justify-center overflow-hidden rounded-lg border border-ink-100 bg-white">
                  {form.image_url ? (
                    <img
                      src={form.image_url}
                      alt={form.asset_code}
                      className="h-full max-h-[380px] w-full object-contain p-3"
                    />
                  ) : (
                    <div className="px-6 text-center">
                      <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-ink-100 font-display text-3xl text-ink-400">
                        {form.hair_style_code.slice(1)}
                      </div>
                      <p className="text-sm font-medium text-ink-700">Belum ada image</p>
                      <p className="mt-1 text-xs text-ink-500">{form.hair_style_code} + {form.eyeglasses_code}</p>
                    </div>
                  )}
                </div>

                <div className="w-full space-y-3 md:w-60">
                  <div>
                    <label className="label">Asset Code</label>
                    <input value={form.asset_code} readOnly className="input font-mono" />
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    className="btn-secondary w-full"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? 'Mengupload...' : form.image_url ? 'Ganti Image' : 'Upload Image'}
                  </button>

                  <label className="flex items-center gap-2 text-sm text-ink-700">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    />
                    Aktif
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-ink-100 pt-4 sm:flex-row sm:justify-end">
            {(editMode || form.image_url || form.asset_code !== emptyForm.asset_code) && (
              <button type="button" className="btn-secondary" disabled={saving || uploading} onClick={resetForm}>
                Reset
              </button>
            )}
            <button type="submit" className="btn-primary" disabled={saving || uploading}>
              {saving ? 'Menyimpan...' : editMode ? 'Simpan Asset' : 'Submit Asset'}
            </button>
          </div>
        </form>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-ink-100 px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink-900">Tabel Asset Character</h2>
              <p className="text-xs text-ink-500">{filteredRows.length} dari {rows.length} data</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 lg:w-[720px]">
              <div>
                <label className="label">Cari</label>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input font-mono"
                  placeholder="BOY-HA-EA"
                />
              </div>
              <div>
                <label className="label">Gender</label>
                <select value={filterGender} onChange={(e) => setFilterGender(e.target.value)} className="input">
                  <option value="">Semua</option>
                  {GENDERS.map((gender) => (
                    <option key={gender} value={gender}>{GENDER_LABELS[gender]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <select value={filterActive} onChange={(e) => setFilterActive(e.target.value)} className="input">
                  <option value="">Semua</option>
                  <option value="true">Aktif</option>
                  <option value="false">Nonaktif</option>
                </select>
              </div>
              <div>
                <label className="label">Sort</label>
                <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as SortOrder)} className="input">
                  <option value="newest">Terbaru</option>
                  <option value="oldest">Terlama</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {loading && rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-ink-400">Memuat...</div>
        ) : filteredRows.length === 0 ? (
          <div className="p-12 text-center text-sm text-ink-400">
            Belum ada asset yang sesuai filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 font-mono text-xs uppercase tracking-wide text-ink-600">
                <tr>
                  <th className="px-4 py-3 text-left">Asset</th>
                  <th className="px-4 py-3 text-left">Gender</th>
                  <th className="px-4 py-3 text-left">Hair</th>
                  <th className="px-4 py-3 text-left">Glasses</th>
                  <th className="px-4 py-3 text-left">Uploaded</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filteredRows.map((row) => (
                  <tr key={row.id} className={`hover:bg-ink-50/50 ${!row.is_active ? 'opacity-70' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-14 w-14 overflow-hidden rounded-lg border border-ink-100 bg-ink-50">
                          <img src={row.image_url} alt={row.asset_code} className="h-full w-full object-contain" />
                        </div>
                        <div>
                          <div className="font-mono text-xs font-medium">{row.asset_code}</div>
                          <a href={row.image_url} target="_blank" rel="noreferrer" className="text-xs text-accent-700 hover:underline">
                            Preview
                          </a>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{GENDER_LABELS[row.gender]}</td>
                    <td className="px-4 py-3 font-mono text-xs">{row.hair_style_code}</td>
                    <td className="px-4 py-3 font-mono text-xs">{row.eyeglasses_code}</td>
                    <td className="px-4 py-3 font-mono text-xs">{formatDate(row.created_at)}</td>
                    <td className="px-4 py-3">
                      {row.is_active ? <span className="badge-green">Aktif</span> : <span className="badge-red">Nonaktif</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button type="button" className="btn-secondary text-xs" onClick={() => openEdit(row)}>
                          Edit Foto
                        </button>
                        <button
                          type="button"
                          className={`btn text-xs ${row.is_active ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
                          onClick={() => setConfirmStatus(row)}
                        >
                          {row.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={!!confirmReplace}
        title="Asset Code Sudah Ada"
        message={confirmReplace ? `Asset ${confirmReplace.asset_code} sudah ada.\n\nPilih Upload Ulang untuk mengganti foto/data asset lama, atau Kembali untuk membatalkan.` : ''}
        confirmLabel="Upload Ulang"
        cancelLabel="Kembali"
        loading={saving}
        onConfirm={() => {
          if (confirmReplace) void saveAsset('update', confirmReplace.id);
        }}
        onCancel={() => setConfirmReplace(null)}
      />

      <ConfirmDialog
        open={!!confirmStatus}
        title={confirmStatus?.is_active ? 'Nonaktifkan Asset' : 'Aktifkan Asset'}
        message={confirmStatus ? `Yakin ingin ${confirmStatus.is_active ? 'menonaktifkan' : 'mengaktifkan'} ${confirmStatus.asset_code}?` : ''}
        confirmLabel={confirmStatus?.is_active ? 'Ya, nonaktifkan' : 'Ya, aktifkan'}
        variant={confirmStatus?.is_active ? 'danger' : 'default'}
        loading={saving}
        onConfirm={() => {
          if (confirmStatus) void toggleStatus(confirmStatus);
        }}
        onCancel={() => setConfirmStatus(null)}
      />

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </AdminShell>
  );
}

function CodePicker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input font-mono"
        size={7}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
