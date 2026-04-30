'use client';

import { useEffect, useRef, useState } from 'react';
import AdminShell from '@/components/AdminShell';
import PageHeader from '@/components/PageHeader';
import ConfirmDialog from '@/components/ConfirmDialog';
import Toast, { type ToastType } from '@/components/Toast';
import {
  GENDERS,
  GENDER_LABELS,
  PACKAGE_CODES,
  PACKAGE_LABELS,
  PARENTS_CONTENTS,
  type Gender,
  type PackageCode,
  type ParentsContent,
} from '@/lib/constants';
import { MAX_THEME_IMAGES, MIN_THEME_IMAGES } from '@/lib/theme-images';

interface ThemePackageCode {
  package_code: PackageCode;
}

interface ThemeImage {
  id?: string;
  image_url: string;
  storage_path: string | null;
  display_order?: number;
}

interface Theme {
  id: string;
  theme_code: string;
  name: string;
  gender: Gender;
  parents_content: ParentsContent;
  requires_parents_nickname: boolean;
  requires_parents_nickname_video?: boolean;
  requires_parents_nickname_print?: boolean;
  requires_parents_sweetname: boolean;
  image_url: string | null;
  is_active: boolean;
  theme_package_codes: ThemePackageCode[];
  theme_images?: ThemeImage[];
}

interface ThemeFormImage extends ThemeImage {
  is_new?: boolean;
}

type NicknameUsage = 'none' | 'video' | 'print' | 'both';

const PARENTS_LABELS: Record<ParentsContent, string> = {
  none: 'Tanpa orang tua',
  single_mom: 'Single Mom',
  single_father: 'Single Father',
  mom_and_dad: 'Mom & Dad',
};

const NICKNAME_USAGE_LABELS: Record<NicknameUsage, string> = {
  none: 'Tidak perlu',
  video: 'Video saja',
  print: 'File siap cetak saja',
  both: 'Video + file siap cetak',
};

function getNicknameUsage(theme: Pick<Theme, 'requires_parents_nickname' | 'requires_parents_nickname_video' | 'requires_parents_nickname_print'>): NicknameUsage {
  const hasNewFlags =
    typeof theme.requires_parents_nickname_video === 'boolean' ||
    typeof theme.requires_parents_nickname_print === 'boolean';
  const video = hasNewFlags
    ? !!theme.requires_parents_nickname_video
    : !!theme.requires_parents_nickname;
  const print = !!theme.requires_parents_nickname_print;

  if (video && print) return 'both';
  if (video) return 'video';
  if (print) return 'print';
  return 'none';
}

function usageToFlags(usage: NicknameUsage) {
  return {
    requires_parents_nickname_video: usage === 'video' || usage === 'both',
    requires_parents_nickname_print: usage === 'print' || usage === 'both',
  };
}

const emptyForm = {
  id: null as string | null,
  theme_code: '',
  name: '',
  gender: 'girl' as Gender,
  parents_content: 'none' as ParentsContent,
  requires_parents_nickname: false,
  requires_parents_nickname_video: false,
  requires_parents_nickname_print: false,
  requires_parents_sweetname: false,
  package_codes: [] as PackageCode[],
  images: [] as ThemeFormImage[],
};

function sortThemeImages(images: ThemeImage[] | undefined, fallbackUrl: string | null): ThemeFormImage[] {
  const fromDb = (images ?? [])
    .slice()
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .map((image) => ({ ...image, is_new: false }));

  if (fromDb.length > 0) return fromDb;
  if (!fallbackUrl) return [];

  return [{
    image_url: fallbackUrl,
    storage_path: null,
    display_order: 0,
    is_new: false,
  }];
}

export default function ThemesPage() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterGender, setFilterGender] = useState('');
  const [filterParents, setFilterParents] = useState('');
  const [filterActive, setFilterActive] = useState('');
  const [search, setSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [removingImageUrl, setRemovingImageUrl] = useState<string | null>(null);

  const [confirmDeactivate, setConfirmDeactivate] = useState<Theme | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void fetchThemes();
  }, [filterGender, filterParents, filterActive, search]);

  async function fetchThemes() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterGender) params.set('gender', filterGender);
      if (filterParents) params.set('parents_content', filterParents);
      if (filterActive) params.set('is_active', filterActive);
      if (search.trim()) params.set('search', search.trim());

      const r = await fetch(`/api/admin/themes/list?${params}`);
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || 'Gagal memuat data. Silakan refresh halaman.');
      setThemes(json.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  }

  function openCreateForm() {
    setForm({ ...emptyForm });
    setShowForm(true);
  }

  function openEditForm(theme: Theme) {
    setForm({
      id: theme.id,
      theme_code: theme.theme_code,
      name: theme.name,
      gender: theme.gender,
      parents_content: theme.parents_content,
      requires_parents_nickname: getNicknameUsage(theme) !== 'none',
      requires_parents_nickname_video: getNicknameUsage(theme) === 'video' || getNicknameUsage(theme) === 'both',
      requires_parents_nickname_print: getNicknameUsage(theme) === 'print' || getNicknameUsage(theme) === 'both',
      requires_parents_sweetname: theme.requires_parents_sweetname,
      package_codes: theme.theme_package_codes.map((item) => item.package_code),
      images: sortThemeImages(theme.theme_images, theme.image_url),
    });
    setShowForm(true);
  }

  async function closeForm() {
    const draftUploads = form.images.filter((image) => image.is_new && image.storage_path);
    if (draftUploads.length > 0) {
      try {
        await fetch('/api/admin/themes/images', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storage_paths: draftUploads.map((image) => image.storage_path),
          }),
        });
      } catch {
        // Best effort cleanup for unsaved draft uploads.
      }
    }

    setShowForm(false);
    setForm({ ...emptyForm });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function togglePackageCode(packageCode: PackageCode) {
    setForm((current) => ({
      ...current,
      package_codes: current.package_codes.includes(packageCode)
        ? current.package_codes.filter((item) => item !== packageCode)
        : [...current.package_codes, packageCode],
    }));
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    if (!form.theme_code.trim()) {
      setToast({ msg: 'Isi Theme Code dulu sebelum upload foto.', type: 'error' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const availableSlots = MAX_THEME_IMAGES - form.images.length;
    if (availableSlots <= 0) {
      setToast({ msg: `Maksimal ${MAX_THEME_IMAGES} foto per tema.`, type: 'error' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const filesToUpload = files.slice(0, availableSlots);
    if (files.length > availableSlots) {
      setToast({ msg: `Hanya ${availableSlots} foto yang bisa ditambahkan lagi.`, type: 'info' });
    }

    setUploadingImages(true);
    try {
      const formData = new FormData();
      formData.append('theme_code', form.theme_code.trim().toUpperCase());
      formData.append('existing_count', String(form.images.length));
      filesToUpload.forEach((file) => formData.append('files', file));

      const r = await fetch('/api/admin/themes/images', {
        method: 'POST',
        body: formData,
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || 'Upload foto tema gagal.');

      const uploadedImages = (json.data ?? []).map((image: ThemeImage) => ({
        ...image,
        is_new: true,
      }));

      setForm((current) => ({
        ...current,
        images: [...current.images, ...uploadedImages].slice(0, MAX_THEME_IMAGES),
      }));
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Upload foto gagal.', type: 'error' });
    } finally {
      setUploadingImages(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleRemoveImage(image: ThemeFormImage) {
    setRemovingImageUrl(image.image_url);
    try {
      if (image.is_new && image.storage_path) {
        const r = await fetch('/api/admin/themes/images', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storage_paths: [image.storage_path] }),
        });
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || 'Gagal menghapus foto draft.');
      }

      setForm((current) => ({
        ...current,
        images: current.images.filter((item) => item.image_url !== image.image_url),
      }));
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Gagal menghapus foto.', type: 'error' });
    } finally {
      setRemovingImageUrl(null);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    if (form.package_codes.length === 0) {
      setToast({ msg: 'Pilih minimal 1 package code.', type: 'error' });
      return;
    }
    if (form.images.length < MIN_THEME_IMAGES || form.images.length > MAX_THEME_IMAGES) {
      setToast({ msg: `Tema wajib punya ${MIN_THEME_IMAGES}-${MAX_THEME_IMAGES} foto.`, type: 'error' });
      return;
    }

    setSaving(true);
    try {
      const url = form.id ? '/api/admin/themes/update' : '/api/admin/themes/create';
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: form.id,
          theme_code: form.theme_code,
          name: form.name,
          gender: form.gender,
          parents_content: form.parents_content,
          requires_parents_nickname: form.parents_content !== 'none' && (form.requires_parents_nickname_video || form.requires_parents_nickname_print),
          requires_parents_nickname_video: form.parents_content !== 'none' && form.requires_parents_nickname_video,
          requires_parents_nickname_print: form.parents_content !== 'none' && form.requires_parents_nickname_print,
          requires_parents_sweetname: form.parents_content !== 'none' && form.requires_parents_sweetname,
          package_codes: form.package_codes,
          theme_images: form.images.map((image) => ({
            image_url: image.image_url,
            storage_path: image.storage_path,
          })),
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || 'Gagal menyimpan tema');

      setToast({
        msg: form.id ? 'Tema berhasil diupdate.' : 'Tema berhasil dibuat.',
        type: 'success',
      });
      setShowForm(false);
      setForm({ ...emptyForm });
      await fetchThemes();
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Gagal', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(theme: Theme) {
    if (theme.is_active) {
      setConfirmDeactivate(theme);
      return;
    }

    try {
      const r = await fetch('/api/admin/themes/deactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: theme.id, is_active: true }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || 'Gagal mengaktifkan tema');
      setToast({ msg: `Tema "${theme.name}" diaktifkan.`, type: 'success' });
      await fetchThemes();
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Gagal', type: 'error' });
    }
  }

  async function confirmDeactivateTheme() {
    if (!confirmDeactivate) return;

    setActionLoading(true);
    try {
      const r = await fetch('/api/admin/themes/deactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: confirmDeactivate.id, is_active: false }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || 'Gagal nonaktifkan tema');
      setToast({ msg: `Tema "${confirmDeactivate.name}" dinonaktifkan.`, type: 'success' });
      setConfirmDeactivate(null);
      await fetchThemes();
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Gagal', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <AdminShell>
      <PageHeader
        title="Tema"
        subtitle={`${themes.length} tema di database`}
        actions={<button onClick={openCreateForm} className="btn-primary">+ Tambah Tema</button>}
      />

      <section className="card p-5 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="label">Cari</label>
            <input
              type="text"
              placeholder="nama / kode tema"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">Gender</label>
            <select className="input" value={filterGender} onChange={(e) => setFilterGender(e.target.value)}>
              <option value="">Semua</option>
              {GENDERS.map((gender) => (
                <option key={gender} value={gender}>{GENDER_LABELS[gender]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Parents Content</label>
            <select className="input" value={filterParents} onChange={(e) => setFilterParents(e.target.value)}>
              <option value="">Semua</option>
              {PARENTS_CONTENTS.map((parentsContent) => (
                <option key={parentsContent} value={parentsContent}>{PARENTS_LABELS[parentsContent]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={filterActive} onChange={(e) => setFilterActive(e.target.value)}>
              <option value="">Semua</option>
              <option value="true">Aktif</option>
              <option value="false">Nonaktif</option>
            </select>
          </div>
        </div>
      </section>

      {error && <div className="card p-4 bg-red-50 border-red-200 text-red-700 text-sm mb-4">{error}</div>}

      {loading && themes.length === 0 ? (
        <div className="card p-12 text-center text-ink-400">Memuat...</div>
      ) : themes.length === 0 ? (
        <div className="card p-12 text-center text-ink-400">
          {search || filterGender || filterParents || filterActive
            ? 'Tidak ada data yang sesuai dengan filter.'
            : 'Belum ada tema. Klik "+ Tambah Tema" untuk menambahkan.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {themes.map((theme) => {
            const images = sortThemeImages(theme.theme_images, theme.image_url);
            const previewImage = images[0];
            return (
              <div key={theme.id} className={`card overflow-hidden ${!theme.is_active ? 'opacity-60' : ''}`}>
                {previewImage ? (
                  <div className="aspect-[16/9] bg-ink-100 overflow-hidden">
                    <img src={previewImage.image_url} alt={theme.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="aspect-[16/9] bg-gradient-to-br from-ink-100 to-ink-200 flex items-center justify-center text-ink-400 font-display text-3xl">
                    Preview
                  </div>
                )}

                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="badge-gray font-mono">{theme.theme_code}</span>
                        {theme.is_active
                          ? <span className="badge-green">Aktif</span>
                          : <span className="badge-red">Nonaktif</span>}
                        <span className="badge-blue text-[10px]">{images.length} foto</span>
                      </div>
                      <h3 className="font-display text-lg font-semibold text-ink-900 truncate">{theme.name}</h3>
                    </div>
                  </div>

                  <div className="text-xs text-ink-600 space-y-0.5 mb-3">
                    <div>Gender: <span className="font-medium text-ink-800">{GENDER_LABELS[theme.gender]}</span></div>
                    <div>Parents: <span className="font-medium text-ink-800">{PARENTS_LABELS[theme.parents_content]}</span></div>
                    <div className="flex gap-2 mt-1">
                      {getNicknameUsage(theme) !== 'none' && (
                        <span className="badge-blue text-[10px]">nickname: {NICKNAME_USAGE_LABELS[getNicknameUsage(theme)]}</span>
                      )}
                      {theme.requires_parents_sweetname && <span className="badge-blue text-[10px]">sweetname: video</span>}
                    </div>
                  </div>

                  {images.length > 1 && (
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {images.slice(0, MAX_THEME_IMAGES).map((image) => (
                        <div key={image.image_url} className="aspect-[4/3] overflow-hidden rounded-lg bg-ink-100">
                          <img src={image.image_url} alt={theme.name} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1 mb-3">
                    {theme.theme_package_codes.map((item) => (
                      <span key={item.package_code} className="badge-purple text-[10px]">{item.package_code}</span>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-ink-100">
                    <button onClick={() => openEditForm(theme)} className="btn-secondary text-xs flex-1">
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggleActive(theme)}
                      className={`btn text-xs flex-1 ${theme.is_active ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
                    >
                      {theme.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-xl shadow-card max-w-3xl w-full p-6 my-8">
            <h3 className="font-display text-xl font-semibold text-ink-900 mb-5">
              {form.id ? 'Edit Tema' : 'Tambah Tema'}
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Theme Code *</label>
                  <input
                    type="text"
                    value={form.theme_code}
                    onChange={(e) => setForm({ ...form, theme_code: e.target.value.toUpperCase() })}
                    placeholder="cth: PRG001"
                    className="input font-mono"
                    required
                    disabled={!!form.id}
                    maxLength={50}
                  />
                  {form.id && <p className="text-xs text-ink-500 mt-1">Theme code tidak bisa diubah.</p>}
                </div>
                <div>
                  <label className="label">Nama Tema *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="cth: Princess Garden"
                    className="input"
                    required
                    maxLength={100}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Gender *</label>
                  <select
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value as Gender })}
                    className="input"
                  >
                    {GENDERS.map((gender) => (
                      <option key={gender} value={gender}>{GENDER_LABELS[gender]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Parents Content *</label>
                  <select
                    value={form.parents_content}
                    onChange={(e) => {
                      const parents_content = e.target.value as ParentsContent;
                      setForm({
                        ...form,
                        parents_content,
                        ...(parents_content === 'none'
                          ? {
                              requires_parents_nickname: false,
                              requires_parents_nickname_video: false,
                              requires_parents_nickname_print: false,
                              requires_parents_sweetname: false,
                            }
                          : {}),
                      });
                    }}
                    className="input"
                  >
                    {PARENTS_CONTENTS.map((parentsContent) => (
                      <option key={parentsContent} value={parentsContent}>{PARENTS_LABELS[parentsContent]}</option>
                    ))}
                  </select>
                </div>
              </div>

              {form.parents_content !== 'none' && (
                <div className="grid grid-cols-1 gap-4 p-3 bg-ink-50 rounded-lg md:grid-cols-2">
                  <div>
                    <label className="label">Parents Nickname</label>
                    <select
                      className="input"
                      value={
                        form.requires_parents_nickname_video && form.requires_parents_nickname_print
                          ? 'both'
                          : form.requires_parents_nickname_video
                            ? 'video'
                            : form.requires_parents_nickname_print
                              ? 'print'
                              : 'none'
                      }
                      onChange={(e) => {
                        const flags = usageToFlags(e.target.value as NicknameUsage);
                        setForm({
                          ...form,
                          ...flags,
                          requires_parents_nickname: flags.requires_parents_nickname_video || flags.requires_parents_nickname_print,
                        });
                      }}
                    >
                      {(['none', 'video', 'print', 'both'] as NicknameUsage[]).map((usage) => (
                        <option key={usage} value={usage}>{NICKNAME_USAGE_LABELS[usage]}</option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-sm md:mt-7">
                    <input
                      type="checkbox"
                      checked={form.requires_parents_sweetname}
                      onChange={(e) => setForm({ ...form, requires_parents_sweetname: e.target.checked })}
                    />
                    Butuh Parents Sweetname
                  </label>
                </div>
              )}

              <div className="rounded-xl border border-ink-100 p-4 bg-ink-50/50">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <label className="label mb-0">Foto Tema *</label>
                    <p className="text-xs text-ink-500 mt-1">
                      Minimal {MIN_THEME_IMAGES} foto, maksimal {MAX_THEME_IMAGES} foto. File akan diupload ke Supabase Storage.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      multiple
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={uploadingImages || form.images.length >= MAX_THEME_IMAGES}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploadingImages ? 'Mengupload...' : 'Browse Foto'}
                    </button>
                    <span className="text-xs text-ink-500">{form.images.length}/{MAX_THEME_IMAGES}</span>
                  </div>
                </div>

                {form.images.length === 0 ? (
                  <div className="mt-4 rounded-lg border border-dashed border-ink-200 bg-white px-4 py-8 text-center text-sm text-ink-400">
                    Belum ada foto tema.
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {form.images.map((image, index) => (
                      <div key={image.image_url} className="rounded-lg border border-ink-100 bg-white overflow-hidden">
                        <div className="aspect-[4/3] bg-ink-100">
                          <img src={image.image_url} alt={`Tema ${index + 1}`} className="w-full h-full object-cover" />
                        </div>
                        <div className="p-3">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-xs font-medium text-ink-700">Foto {index + 1}</span>
                            {index === 0 && <span className="badge-green text-[10px]">Utama</span>}
                          </div>
                          <button
                            type="button"
                            className="btn-secondary w-full text-xs"
                            disabled={removingImageUrl === image.image_url}
                            onClick={() => handleRemoveImage(image)}
                          >
                            {removingImageUrl === image.image_url ? 'Menghapus...' : 'Hapus Foto'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="label">Package Codes * (pilih minimal 1)</label>
                <div className="flex flex-wrap gap-2">
                  {PACKAGE_CODES.map((packageCode) => (
                    <button
                      key={packageCode}
                      type="button"
                      onClick={() => togglePackageCode(packageCode)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        form.package_codes.includes(packageCode)
                          ? 'bg-ink-900 text-white border-ink-900'
                          : 'bg-white text-ink-700 border-ink-200 hover:bg-ink-50'
                      }`}
                    >
                      {packageCode} <span className="opacity-60 font-normal">- {PACKAGE_LABELS[packageCode]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-3 border-t border-ink-100 mt-5">
                <button type="button" onClick={() => void closeForm()} className="btn-secondary" disabled={saving || uploadingImages}>
                  Batal
                </button>
                <button type="submit" className="btn-primary" disabled={saving || uploadingImages}>
                  {saving ? 'Menyimpan...' : form.id ? 'Simpan Perubahan' : 'Buat Tema'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDeactivate}
        title="Nonaktifkan Tema"
        message={`Yakin ingin nonaktifkan tema "${confirmDeactivate?.name}"?\n\nTema yang dinonaktifkan tidak akan tampil di pilihan customer, tapi data order yang sudah ada tetap aman karena pakai snapshot.`}
        confirmLabel="Ya, nonaktifkan"
        variant="danger"
        loading={actionLoading}
        onConfirm={confirmDeactivateTheme}
        onCancel={() => setConfirmDeactivate(null)}
      />

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </AdminShell>
  );
}
