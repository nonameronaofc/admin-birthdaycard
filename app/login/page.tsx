'use client';

import { useEffect, useState } from 'react';
import { fetchJsonOrThrow } from '@/lib/client-api';

function clearSupabaseCookies() {
  if (typeof document === 'undefined') return;
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/^https:\/\/([^.]+)\./)?.[1];
  if (!projectRef) return;

  const baseName = `sb-${projectRef}-auth-token`;
  const candidates = [baseName, `${baseName}.0`, `${baseName}.1`, `${baseName}.2`, `${baseName}.3`, `${baseName}.4`];
  candidates.forEach((name) => {
    document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
  });
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextPath, setNextPath] = useState('/dashboard');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'not_admin') {
      setError('Akun ini belum diberi akses admin.');
    }
    if (params.get('error') === 'supabase_config') {
      setError('Supabase config belum diisi di .env.local.');
    }
    if (params.get('error') === 'session_expired') {
      setError('Sesi login berubah setelah update panel. Silakan masuk lagi untuk melanjutkan.');
      clearSupabaseCookies();
    }

    const next = params.get('next');
    if (next && next.startsWith('/')) {
      setNextPath(next);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await fetchJsonOrThrow('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      }, 'Login gagal. Periksa email dan password.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Konfigurasi login belum siap.');
      setLoading(false);
      return;
    }

    window.location.assign(nextPath);
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel: branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-ink-900 text-white p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]"
             style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        <div className="relative z-10">
          <div className="font-display text-2xl font-semibold">
            Admin<span className="text-accent-400">.</span>
          </div>
          <div className="text-xs text-ink-400 mt-1 font-mono tracking-wider">
            BIRTHDAY VIDEO ADMIN PANEL
          </div>
        </div>
        <div className="relative z-10 max-w-sm">
          <h1 className="font-display text-4xl font-semibold leading-tight mb-3">
            Kelola pesanan video ulang tahun custom dari satu tempat.
          </h1>
          <p className="text-ink-400 text-sm leading-relaxed">
            Login pakai akun admin yang sudah dibuat di Supabase Auth.
          </p>
        </div>
        <div className="relative z-10 text-xs text-ink-500 font-mono">
          v1.0 — sesuai dokumentasi v3
        </div>
      </div>

      {/* Right panel: form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-ink-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <div className="font-display text-2xl font-semibold text-ink-900">
              Admin<span className="text-accent-500">.</span>
            </div>
          </div>

          <h2 className="font-display text-2xl font-semibold text-ink-900 mb-1">
            Selamat datang kembali
          </h2>
          <p className="text-sm text-ink-500 mb-8">
            Masuk untuk mengakses panel admin.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="label">Email</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="label">Password</label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? 'Memproses...' : 'Masuk'}
            </button>
          </form>

          <p className="text-xs text-ink-500 mt-8 leading-relaxed">
            Belum punya akun? Buat user di{' '}
            <span className="font-mono text-ink-700">Supabase Dashboard → Authentication → Users</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
