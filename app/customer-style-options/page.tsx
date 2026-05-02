'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminShell from '@/components/AdminShell';
import PageHeader from '@/components/PageHeader';
import { fetchJsonOrThrow } from '@/lib/client-api';
import Toast, { type ToastType } from '@/components/Toast';

type StyleOption = {
  code: string;
  is_visible: boolean;
};

const CODE_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const HAIR_CODES = CODE_LETTERS.map((letter) => `H${letter}`);
const EYEGLASSES_CODES = CODE_LETTERS.map((letter) => `E${letter}`);

function makeFallback(codes: string[]): StyleOption[] {
  return codes.map((code) => ({ code, is_visible: true }));
}

export default function CustomerStyleOptionsPage() {
  const [hairOptions, setHairOptions] = useState<StyleOption[]>(makeFallback(HAIR_CODES));
  const [eyeglassesOptions, setEyeglassesOptions] = useState<StyleOption[]>(makeFallback(EYEGLASSES_CODES));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [needsSchemaUpdate, setNeedsSchemaUpdate] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);

  const visibleHairCount = useMemo(
    () => hairOptions.filter((option) => option.is_visible).length,
    [hairOptions]
  );
  const visibleEyeglassesCount = useMemo(
    () => eyeglassesOptions.filter((option) => option.is_visible).length,
    [eyeglassesOptions]
  );

  const loadOptions = useCallback(async () => {
    setLoading(true);
    try {
      const json = await fetchJsonOrThrow<{
        hair?: StyleOption[];
        eyeglasses?: StyleOption[];
        needs_schema_update?: boolean;
      }>('/api/admin/customer-style-options', undefined, 'Gagal memuat visibilitas opsi.');
      setHairOptions(json.hair ?? makeFallback(HAIR_CODES));
      setEyeglassesOptions(json.eyeglasses ?? makeFallback(EYEGLASSES_CODES));
      setNeedsSchemaUpdate(!!json.needs_schema_update);
    } catch (error) {
      setToast({
        msg: error instanceof Error ? error.message : 'Gagal memuat visibilitas opsi.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  function toggleOption(type: 'hair' | 'eyeglasses', code: string) {
    const setter = type === 'hair' ? setHairOptions : setEyeglassesOptions;
    setter((current) =>
      current.map((option) =>
        option.code === code ? { ...option, is_visible: !option.is_visible } : option
      )
    );
  }

  function setAll(type: 'hair' | 'eyeglasses', visible: boolean) {
    const setter = type === 'hair' ? setHairOptions : setEyeglassesOptions;
    setter((current) => current.map((option) => ({ ...option, is_visible: visible })));
  }

  async function saveOptions() {
    if (needsSchemaUpdate) {
      setToast({
        msg: 'Jalankan migration customer_style_options dulu sebelum menyimpan.',
        type: 'error',
      });
      return;
    }

    const visibleHair = hairOptions.filter((option) => option.is_visible).map((option) => option.code);
    const visibleEyeglasses = eyeglassesOptions
      .filter((option) => option.is_visible)
      .map((option) => option.code);

    if (visibleHair.length === 0 || visibleEyeglasses.length === 0) {
      setToast({ msg: 'Minimal satu Hair Style dan satu Eyeglasses harus tampil.', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      await fetchJsonOrThrow('/api/admin/customer-style-options', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visible_hair_codes: visibleHair,
          visible_eyeglasses_codes: visibleEyeglasses,
        }),
      }, 'Gagal menyimpan visibilitas opsi.');
      setToast({ msg: 'Visibilitas opsi customer berhasil disimpan.', type: 'success' });
      await loadOptions();
    } catch (error) {
      setToast({
        msg: error instanceof Error ? error.message : 'Gagal menyimpan visibilitas opsi.',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell>
      <PageHeader
        title="Opsi Customer"
        subtitle="Atur hair style dan eyeglasses yang muncul di web customer"
      />

      {needsSchemaUpdate && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <p className="font-semibold">Database belum punya tabel customer_style_options.</p>
          <p className="mt-1">
            Jalankan update SQL dari <span className="font-mono">supabase/schema.sql</span> terbaru di
            Supabase SQL Editor, lalu refresh halaman ini.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <StyleVisibilityCard
          title="Hair Style"
          options={hairOptions}
          visibleCount={visibleHairCount}
          loading={loading}
          onToggle={(code) => toggleOption('hair', code)}
          onShowAll={() => setAll('hair', true)}
          onHideAll={() => setAll('hair', false)}
        />
        <StyleVisibilityCard
          title="Eyeglasses"
          options={eyeglassesOptions}
          visibleCount={visibleEyeglassesCount}
          loading={loading}
          onToggle={(code) => toggleOption('eyeglasses', code)}
          onShowAll={() => setAll('eyeglasses', true)}
          onHideAll={() => setAll('eyeglasses', false)}
        />
      </div>

      <div className="sticky bottom-0 mt-5 border-t border-ink-100 bg-ink-50/95 py-4 backdrop-blur">
        <div className="flex flex-col gap-3 rounded-xl border border-ink-100 bg-white p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-600">
            Tampil di customer: <strong>{visibleHairCount}</strong> hair style dan{' '}
            <strong>{visibleEyeglassesCount}</strong> eyeglasses.
          </p>
          <button type="button" className="btn-primary" disabled={saving || loading || needsSchemaUpdate} onClick={saveOptions}>
            {saving ? 'Menyimpan...' : 'Simpan Visibilitas'}
          </button>
        </div>
      </div>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </AdminShell>
  );
}

function StyleVisibilityCard({
  title,
  options,
  visibleCount,
  loading,
  onToggle,
  onShowAll,
  onHideAll,
}: {
  title: string;
  options: StyleOption[];
  visibleCount: number;
  loading: boolean;
  onToggle: (code: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-ink-100 px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink-900">{title}</h2>
            <p className="text-sm text-ink-500">{visibleCount} dari {options.length} opsi tampil</p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary text-xs" disabled={loading} onClick={onShowAll}>
              Tampilkan Semua
            </button>
            <button type="button" className="btn-secondary text-xs" disabled={loading} onClick={onHideAll}>
              Sembunyikan Semua
            </button>
          </div>
        </div>
      </div>

      <div className="grid max-h-[520px] grid-cols-1 gap-2 overflow-y-auto p-4 sm:grid-cols-2">
        {options.map((option) => {
          const label = option.code.slice(1);
          return (
            <button
              key={option.code}
              type="button"
              onClick={() => onToggle(option.code)}
              className={[
                'flex min-h-[48px] items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors',
                option.is_visible
                  ? 'border-ink-900 bg-ink-900 text-white'
                  : 'border-ink-200 bg-white text-ink-700 hover:bg-ink-50',
              ].join(' ')}
            >
              <span>
                <span className="block text-sm font-semibold">Style {label}</span>
                <span className={`block font-mono text-xs ${option.is_visible ? 'text-ink-200' : 'text-ink-400'}`}>
                  {option.code}
                </span>
              </span>
              <span className={option.is_visible ? 'badge-green' : 'badge-gray'}>
                {option.is_visible ? 'Tampil' : 'Hidden'}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
