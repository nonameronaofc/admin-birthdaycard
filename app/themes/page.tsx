'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import AdminShell from '@/components/AdminShell';
import PageHeader from '@/components/PageHeader';
import ConfirmDialog from '@/components/ConfirmDialog';
import Toast, { type ToastType } from '@/components/Toast';
import { fetchJsonOrThrow } from '@/lib/client-api';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { THEME_CHARACTER_BUCKET } from '@/lib/theme-character-variants';
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
import { parseThemeTags, themeTagsToText } from '@/lib/theme-filters';
import { MIN_THEME_IMAGES } from '@/lib/theme-images';

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
  style_tags?: string[];
  color_tags?: string[];
  mood_tags?: string[];
  is_recommended?: boolean;
  display_priority?: number;
  theme_package_codes: ThemePackageCode[];
  theme_images?: ThemeImage[];
}

interface ThemeFormImage extends ThemeImage {
  is_new?: boolean;
}

interface ThemeCharacterVariant {
  id: string;
  theme_id: string;
  gender: Gender;
  hair_type_label: string;
  hair_type_key: string;
  face_attribute_label: string;
  face_attribute_key: string;
  variant_name: string | null;
  image_url: string;
  storage_path: string | null;
  is_default: boolean;
  is_recommended: boolean;
  is_active: boolean;
  display_order: number;
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
  video: 'Atribut video',
  print: 'Atribut video',
  both: 'Atribut video',
};
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const HAIR_TYPE_OPTIONS = Array.from({ length: 30 }, (_, index) => `Hair Type ${index + 1}`);
const FACE_ATTRIBUTE_OPTIONS = Array.from({ length: 30 }, (_, index) => `Face ${index + 1}`);

async function readJsonResponse(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  if (response.status === 413) {
    throw new Error('File terlalu besar untuk diupload. Kompres gambar dulu, maksimal 10 MB.');
  }

  if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
    throw new Error('Server mengembalikan halaman HTML, bukan JSON. Silakan login ulang lalu coba lagi.');
  }

  throw new Error(text || 'Response server tidak valid.');
}

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
    requires_parents_nickname_video: usage !== 'none',
    requires_parents_nickname_print: false,
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
  style_tags_text: '',
  color_tags_text: '',
  mood_tags_text: '',
  is_recommended: false,
  display_priority: 0,
  images: [] as ThemeFormImage[],
};

const emptyVariantForm = {
  id: null as string | null,
  gender: 'boy' as Gender,
  hair_type_label: 'Hair Type 1',
  face_attribute_label: 'Face 1',
  variant_name: '',
  image_url: '',
  storage_path: null as string | null,
  is_default: false,
  is_recommended: false,
  is_active: true,
  display_order: 0,
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
  const [themeVariants, setThemeVariants] = useState<ThemeCharacterVariant[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [variantForm, setVariantForm] = useState({ ...emptyVariantForm });
  const [uploadingVariantImage, setUploadingVariantImage] = useState(false);
  const [savingVariant, setSavingVariant] = useState(false);
  const [deletingVariantId, setDeletingVariantId] = useState<string | null>(null);

  const [confirmDeactivate, setConfirmDeactivate] = useState<Theme | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const variantFileInputRef = useRef<HTMLInputElement>(null);
  const supabaseBrowser = useMemo(() => createSupabaseBrowserClient(), []);

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

      const json = await fetchJsonOrThrow<{ data: Theme[] }>(
        `/api/admin/themes/list?${params}`,
        undefined,
        'Gagal memuat data. Silakan refresh halaman.'
      );
      setThemes(json.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  }

  function openCreateForm() {
    setForm({ ...emptyForm });
    setThemeVariants([]);
    setVariantForm({ ...emptyVariantForm });
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
      style_tags_text: themeTagsToText(theme.style_tags),
      color_tags_text: themeTagsToText(theme.color_tags),
      mood_tags_text: themeTagsToText(theme.mood_tags),
      is_recommended: !!theme.is_recommended,
      display_priority: theme.display_priority ?? 0,
      images: sortThemeImages(theme.theme_images, theme.image_url),
    });
    setVariantForm({ ...emptyVariantForm });
    void fetchThemeVariants(theme.id);
    setShowForm(true);
  }

  async function closeForm() {
    const draftUploads = form.images.filter((image) => image.is_new && image.storage_path);
    if (draftUploads.length > 0) {
      try {
        await fetchJsonOrThrow('/api/admin/themes/images', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storage_paths: draftUploads.map((image) => image.storage_path),
          }),
        }, 'Gagal membersihkan draft foto tema.');
      } catch {
        // Best effort cleanup for unsaved draft uploads.
      }
    }

    setShowForm(false);
    setForm({ ...emptyForm });
    setThemeVariants([]);
    setVariantForm({ ...emptyVariantForm });
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (variantFileInputRef.current) variantFileInputRef.current.value = '';
  }

  async function fetchThemeVariants(themeId: string) {
    setLoadingVariants(true);
    try {
      const params = new URLSearchParams({ theme_id: themeId });
      const r = await fetch(`/api/admin/themes/character-variants?${params}`);
      const json = await readJsonResponse(r);
      if (!r.ok) throw new Error(json.error || 'Gagal memuat karakter tema.');
      setThemeVariants(json.data || []);
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Gagal memuat karakter tema.', type: 'error' });
      setThemeVariants([]);
    } finally {
      setLoadingVariants(false);
    }
  }

  function resetVariantForm() {
    setVariantForm({ ...emptyVariantForm });
    if (variantFileInputRef.current) variantFileInputRef.current.value = '';
  }

function editVariant(variant: ThemeCharacterVariant) {
    setVariantForm({
      id: variant.id,
      gender: variant.gender,
      hair_type_label: variant.hair_type_label,
      face_attribute_label: variant.face_attribute_label,
      variant_name: variant.variant_name || '',
      image_url: variant.image_url,
      storage_path: variant.storage_path,
      is_default: variant.is_default,
      is_recommended: variant.is_recommended,
      is_active: variant.is_active,
      display_order: variant.display_order,
    });
  }

  function buildSelectOptions(baseOptions: string[], currentValue: string) {
    const trimmed = currentValue.trim();
    return trimmed && !baseOptions.includes(trimmed)
      ? [trimmed, ...baseOptions]
      : baseOptions;
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

    const oversizedFile = files.find((file) => file.size > MAX_UPLOAD_BYTES);
    if (oversizedFile) {
      setToast({ msg: `File ${oversizedFile.name} terlalu besar. Maksimal 10 MB.`, type: 'error' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploadingImages(true);
    try {
      const formData = new FormData();
      formData.append('theme_code', form.theme_code.trim().toUpperCase());
      formData.append('existing_count', String(form.images.length));
      files.forEach((file) => formData.append('files', file));

      const json = await fetchJsonOrThrow<{ data: ThemeImage[] }>('/api/admin/themes/images', {
        method: 'POST',
        body: formData,
      }, 'Upload foto tema gagal.');

      const uploadedImages: ThemeFormImage[] = (json.data ?? []).map((image) => ({
        ...image,
        is_new: true,
      }));

      setForm((current) => ({
        ...current,
        images: [...current.images, ...uploadedImages],
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
        await fetchJsonOrThrow('/api/admin/themes/images', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storage_paths: [image.storage_path] }),
        }, 'Gagal menghapus foto draft.');
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

  async function handleVariantImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!form.id || !form.theme_code.trim()) {
      setToast({ msg: 'Simpan tema dulu sebelum upload karakter.', type: 'error' });
      if (variantFileInputRef.current) variantFileInputRef.current.value = '';
      return;
    }
    if (!variantForm.hair_type_label.trim() || !variantForm.face_attribute_label.trim()) {
      setToast({ msg: 'Isi Hair Type dan Face Attribute dulu sebelum upload.', type: 'error' });
      if (variantFileInputRef.current) variantFileInputRef.current.value = '';
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setToast({ msg: 'File terlalu besar. Kompres gambar dulu, maksimal 10 MB.', type: 'error' });
      if (variantFileInputRef.current) variantFileInputRef.current.value = '';
      return;
    }

    setUploadingVariantImage(true);
    try {
      const r = await fetch('/api/admin/themes/character-variants/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme_code: form.theme_code.trim().toUpperCase(),
          gender: variantForm.gender,
          hair_type_label: variantForm.hair_type_label,
          face_attribute_label: variantForm.face_attribute_label,
          file_name: file.name,
          content_type: file.type,
        }),
      });
      const json = await readJsonResponse(r);
      if (!r.ok) throw new Error(json.error || 'Upload karakter tema gagal.');

      const token = json.data?.token;
      const storagePath = json.data?.storage_path;
      if (!token || !storagePath) throw new Error('Signed upload URL gagal dibuat.');

      const { error: uploadError } = await supabaseBrowser.storage
        .from(THEME_CHARACTER_BUCKET)
        .uploadToSignedUrl(storagePath, token, file);

      if (uploadError) throw new Error(uploadError.message);

      setVariantForm((current) => ({
        ...current,
        image_url: json.data?.image_url ?? current.image_url,
        storage_path: storagePath,
      }));
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Upload karakter gagal.', type: 'error' });
    } finally {
      setUploadingVariantImage(false);
      if (variantFileInputRef.current) variantFileInputRef.current.value = '';
    }
  }

  async function saveVariant() {
    if (!form.id) {
      setToast({ msg: 'Simpan tema dulu sebelum tambah karakter.', type: 'error' });
      return;
    }
    if (!variantForm.hair_type_label.trim() || !variantForm.face_attribute_label.trim() || !variantForm.image_url) {
      setToast({ msg: 'Hair Type, Face Attribute, dan gambar karakter wajib diisi.', type: 'error' });
      return;
    }

    const hasDefaultForGender = themeVariants.some(
      (variant) =>
        variant.gender === variantForm.gender &&
        variant.is_default &&
        variant.id !== variantForm.id
    );

    setSavingVariant(true);
    try {
      const r = await fetch('/api/admin/themes/character-variants', {
        method: variantForm.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: variantForm.id,
          theme_id: form.id,
          gender: variantForm.gender,
          hair_type_label: variantForm.hair_type_label,
          face_attribute_label: variantForm.face_attribute_label,
          variant_name: variantForm.variant_name,
          image_url: variantForm.image_url,
          storage_path: variantForm.storage_path,
          is_default: variantForm.is_default || !hasDefaultForGender,
          is_recommended: variantForm.is_recommended,
          is_active: variantForm.is_active,
          display_order: Number(variantForm.display_order) || 0,
        }),
      });
      const json = await readJsonResponse(r);
      if (!r.ok) throw new Error(json.error || 'Gagal menyimpan karakter tema.');

      setToast({ msg: variantForm.id ? 'Karakter tema diupdate.' : 'Karakter tema ditambahkan.', type: 'success' });
      resetVariantForm();
      await fetchThemeVariants(form.id);
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Gagal menyimpan karakter tema.', type: 'error' });
    } finally {
      setSavingVariant(false);
    }
  }

  async function deleteVariant(variant: ThemeCharacterVariant) {
    setDeletingVariantId(variant.id);
    try {
      const r = await fetch('/api/admin/themes/character-variants', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: variant.id }),
      });
      const json = await readJsonResponse(r);
      if (!r.ok) throw new Error(json.error || 'Gagal menghapus karakter tema.');

      setToast({ msg: 'Karakter tema dihapus.', type: 'success' });
      if (variantForm.id === variant.id) resetVariantForm();
      if (form.id) await fetchThemeVariants(form.id);
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Gagal menghapus karakter tema.', type: 'error' });
    } finally {
      setDeletingVariantId(null);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    if (form.package_codes.length === 0) {
      setToast({ msg: 'Pilih minimal 1 package code.', type: 'error' });
      return;
    }
    if (form.images.length < MIN_THEME_IMAGES) {
      setToast({ msg: `Tema wajib punya minimal ${MIN_THEME_IMAGES} foto.`, type: 'error' });
      return;
    }

    setSaving(true);
    try {
      const url = form.id ? '/api/admin/themes/update' : '/api/admin/themes/create';
      await fetchJsonOrThrow(url, {
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
          style_tags: parseThemeTags(form.style_tags_text),
          color_tags: parseThemeTags(form.color_tags_text),
          mood_tags: parseThemeTags(form.mood_tags_text),
          is_recommended: form.is_recommended,
          display_priority: Number(form.display_priority) || 0,
          theme_images: form.images.map((image) => ({
            image_url: image.image_url,
            storage_path: image.storage_path,
          })),
        }),
      }, 'Gagal menyimpan tema');

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
      await fetchJsonOrThrow('/api/admin/themes/deactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: theme.id, is_active: true }),
      }, 'Gagal mengaktifkan tema');
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
      await fetchJsonOrThrow('/api/admin/themes/deactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: confirmDeactivate.id, is_active: false }),
      }, 'Gagal nonaktifkan tema');
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
            const styleTags = parseThemeTags(theme.style_tags);
            const colorTags = parseThemeTags(theme.color_tags);
            const moodTags = parseThemeTags(theme.mood_tags);
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
                        {theme.is_recommended && <span className="badge-purple text-[10px]">Recommended</span>}
                        {(theme.display_priority ?? 0) !== 0 && (
                          <span className="badge-gray text-[10px]">prio {theme.display_priority}</span>
                        )}
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
                      {images.slice(0, 3).map((image) => (
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

                  {(styleTags.length > 0 || colorTags.length > 0 || moodTags.length > 0) && (
                    <div className="space-y-1 mb-3 rounded-lg bg-ink-50 px-3 py-2 text-[11px] text-ink-600">
                      {styleTags.length > 0 && <div><span className="font-semibold text-ink-800">Style:</span> {styleTags.join(', ')}</div>}
                      {colorTags.length > 0 && <div><span className="font-semibold text-ink-800">Warna:</span> {colorTags.join(', ')}</div>}
                      {moodTags.length > 0 && <div><span className="font-semibold text-ink-800">Mood:</span> {moodTags.join(', ')}</div>}
                    </div>
                  )}

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/40 backdrop-blur-sm">
          <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-card">
            <div className="border-b border-ink-100 px-6 py-4">
              <h3 className="font-display text-xl font-semibold text-ink-900">
                {form.id ? 'Edit Tema' : 'Tambah Tema'}
              </h3>
            </div>

            <form onSubmit={handleSave} className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
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
                      value={form.requires_parents_nickname_video || form.requires_parents_nickname_print ? 'video' : 'none'}
                      onChange={(e) => {
                        const flags = usageToFlags(e.target.value as NicknameUsage);
                        setForm({
                          ...form,
                          ...flags,
                          requires_parents_nickname: flags.requires_parents_nickname_video || flags.requires_parents_nickname_print,
                        });
                      }}
                    >
                      {(['none', 'video'] as NicknameUsage[]).map((usage) => (
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

              <div className="rounded-xl border border-ink-100 p-4 bg-white">
                <div className="mb-4">
                  <label className="label mb-0">Filter Tema Customer</label>
                  <p className="text-xs text-ink-500 mt-1">
                    Isi tag pakai koma. Tag ini nanti dipakai customer untuk filter tema tanpa perlu ubah kode.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <label className="label">Style Tema</label>
                    <input
                      type="text"
                      value={form.style_tags_text}
                      onChange={(e) => setForm({ ...form, style_tags_text: e.target.value })}
                      placeholder="Cute, Princess, Sport"
                      className="input"
                      maxLength={240}
                    />
                  </div>
                  <div>
                    <label className="label">Warna Dominan</label>
                    <input
                      type="text"
                      value={form.color_tags_text}
                      onChange={(e) => setForm({ ...form, color_tags_text: e.target.value })}
                      placeholder="Pink, Blue, Pastel"
                      className="input"
                      maxLength={240}
                    />
                  </div>
                  <div>
                    <label className="label">Mood / Nuansa</label>
                    <input
                      type="text"
                      value={form.mood_tags_text}
                      onChange={(e) => setForm({ ...form, mood_tags_text: e.target.value })}
                      placeholder="Ceria, Kalem, Mewah"
                      className="input"
                      maxLength={240}
                    />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.is_recommended}
                      onChange={(e) => setForm({ ...form, is_recommended: e.target.checked })}
                    />
                    Tandai sebagai Recommended
                  </label>
                  <div>
                    <label className="label">Prioritas Tampil</label>
                    <input
                      type="number"
                      value={form.display_priority}
                      onChange={(e) => setForm({ ...form, display_priority: Number(e.target.value) })}
                      className="input"
                      min={-9999}
                      max={9999}
                    />
                    <p className="text-xs text-ink-500 mt-1">Angka lebih besar bisa dipakai untuk sort lebih atas.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-ink-100 p-4 bg-ink-50/50">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <label className="label mb-0">Foto Tema *</label>
                    <p className="text-xs text-ink-500 mt-1">
                      Minimal {MIN_THEME_IMAGES} foto. Tambahkan foto slideshow sebanyak yang dibutuhkan.
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
                      disabled={uploadingImages}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploadingImages ? 'Mengupload...' : 'Browse Foto'}
                    </button>
                    <span className="text-xs text-ink-500">{form.images.length} foto</span>
                  </div>
                </div>

                {form.images.length === 0 ? (
                  <div className="mt-4 rounded-lg border border-dashed border-ink-200 bg-white px-4 py-8 text-center text-sm text-ink-400">
                    Belum ada foto tema.
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
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

              <div className="rounded-xl border border-ink-100 p-4 bg-white">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <label className="label mb-0">Custom Character per Tema</label>
                    <p className="text-xs text-ink-500 mt-1">
                      Tambahkan kombinasi yang benar-benar tersedia. Tidak wajib lengkap 4x4.
                    </p>
                  </div>
                  {!form.id && (
                    <span className="rounded-lg bg-[#fff8e8] px-3 py-2 text-xs text-ink-600">
                      Simpan tema dulu sebelum tambah karakter.
                    </span>
                  )}
                </div>

                {form.id && (
                  <>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
                      <div className="rounded-lg border border-ink-100 bg-ink-50 p-3">
                        <div className="mb-3 overflow-hidden rounded-lg bg-white">
                          {variantForm.image_url ? (
                            <img
                              src={variantForm.image_url}
                              alt="Preview karakter tema"
                              className="h-52 w-full object-contain"
                            />
                          ) : (
                            <div className="flex h-52 items-center justify-center text-center text-xs text-ink-400">
                              Upload gambar kombinasi karakter.
                            </div>
                          )}
                        </div>
                        <input
                          ref={variantFileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          className="hidden"
                          onChange={handleVariantImageUpload}
                        />
                        <button
                          type="button"
                          className="btn-secondary w-full text-xs"
                          disabled={uploadingVariantImage}
                          onClick={() => variantFileInputRef.current?.click()}
                        >
                          {uploadingVariantImage ? 'Mengupload...' : variantForm.image_url ? 'Ganti Gambar' : 'Upload Gambar'}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                          <label className="label">Gender</label>
                          <select
                            className="input"
                            value={variantForm.gender}
                            onChange={(e) => setVariantForm({ ...variantForm, gender: e.target.value as Gender })}
                          >
                            {GENDERS.map((gender) => (
                              <option key={gender} value={gender}>{GENDER_LABELS[gender]}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label">Nama Varian (opsional)</label>
                          <input
                            type="text"
                            className="input"
                            value={variantForm.variant_name}
                            onChange={(e) => setVariantForm({ ...variantForm, variant_name: e.target.value })}
                            placeholder="cth: Ceria Pink"
                            maxLength={80}
                          />
                        </div>
                        <div>
                          <label className="label">Hair Type</label>
                          <select
                            className="input"
                            value={variantForm.hair_type_label}
                            onChange={(e) => setVariantForm({ ...variantForm, hair_type_label: e.target.value })}
                          >
                            {buildSelectOptions(HAIR_TYPE_OPTIONS, variantForm.hair_type_label).map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label">Face Attribute</label>
                          <select
                            className="input"
                            value={variantForm.face_attribute_label}
                            onChange={(e) => setVariantForm({ ...variantForm, face_attribute_label: e.target.value })}
                          >
                            {buildSelectOptions(FACE_ATTRIBUTE_OPTIONS, variantForm.face_attribute_label).map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label">Urutan</label>
                          <input
                            type="number"
                            className="input"
                            value={variantForm.display_order}
                            min={0}
                            max={9999}
                            onChange={(e) => setVariantForm({ ...variantForm, display_order: Number(e.target.value) })}
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-4 pt-6 text-sm">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={variantForm.is_default}
                              onChange={(e) => setVariantForm({ ...variantForm, is_default: e.target.checked })}
                            />
                            Default
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={variantForm.is_recommended}
                              onChange={(e) => setVariantForm({ ...variantForm, is_recommended: e.target.checked })}
                            />
                            Recommended
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={variantForm.is_active}
                              onChange={(e) => setVariantForm({ ...variantForm, is_active: e.target.checked })}
                            />
                            Aktif
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <button type="button" className="btn-secondary" onClick={resetVariantForm} disabled={savingVariant}>
                        Reset Form Karakter
                      </button>
                      <button type="button" className="btn-primary" onClick={saveVariant} disabled={savingVariant || uploadingVariantImage}>
                        {savingVariant ? 'Menyimpan...' : variantForm.id ? 'Update Kombinasi' : 'Tambah Kombinasi'}
                      </button>
                    </div>

                    <div className="mt-5 overflow-hidden rounded-lg border border-ink-100">
                      <div className="flex items-center justify-between border-b border-ink-100 bg-ink-50 px-3 py-2">
                        <div className="text-xs font-mono uppercase tracking-wider text-ink-500">
                          Kombinasi Aktif & Draft
                        </div>
                        <div className="text-xs text-ink-500">{themeVariants.length} kombinasi</div>
                      </div>
                      {loadingVariants ? (
                        <div className="px-4 py-8 text-center text-sm text-ink-400">Memuat karakter...</div>
                      ) : themeVariants.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-ink-400">
                          Belum ada kombinasi karakter untuk tema ini.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-white text-xs uppercase tracking-wide text-ink-500">
                              <tr>
                                <th className="px-3 py-2 text-left">Preview</th>
                                <th className="px-3 py-2 text-left">Gender</th>
                                <th className="px-3 py-2 text-left">Kombinasi</th>
                                <th className="px-3 py-2 text-left">Status</th>
                                <th className="px-3 py-2 text-right">Aksi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-ink-100">
                              {themeVariants.map((variant) => (
                                <tr key={variant.id}>
                                  <td className="px-3 py-2">
                                    <div className="h-16 w-12 overflow-hidden rounded bg-ink-50">
                                      <img src={variant.image_url} alt={variant.variant_name || variant.hair_type_label} className="h-full w-full object-contain" />
                                    </div>
                                  </td>
                                  <td className="px-3 py-2">{GENDER_LABELS[variant.gender]}</td>
                                  <td className="px-3 py-2">
                                    <div className="font-medium text-ink-800">{variant.variant_name || 'Tanpa nama varian'}</div>
                                    <div className="text-xs text-ink-500">
                                      {variant.hair_type_label} + {variant.face_attribute_label}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="flex flex-wrap gap-1">
                                      {variant.is_active ? <span className="badge-green text-[10px]">Aktif</span> : <span className="badge-red text-[10px]">Nonaktif</span>}
                                      {variant.is_default && <span className="badge-blue text-[10px]">Default</span>}
                                      {variant.is_recommended && <span className="badge-purple text-[10px]">Recommended</span>}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <div className="flex justify-end gap-2">
                                      <button type="button" className="text-xs text-accent-600 hover:underline" onClick={() => editVariant(variant)}>
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        className="text-xs text-red-600 hover:underline"
                                        disabled={deletingVariantId === variant.id}
                                        onClick={() => deleteVariant(variant)}
                                      >
                                        {deletingVariantId === variant.id ? 'Hapus...' : 'Hapus'}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="sticky bottom-0 -mx-6 mt-5 flex flex-col-reverse gap-2 border-t border-ink-100 bg-white px-6 py-4 shadow-[0_-12px_24px_rgba(15,23,42,0.06)] sm:flex-row sm:justify-end">
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
