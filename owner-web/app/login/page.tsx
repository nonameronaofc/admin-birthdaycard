'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const routeError = searchParams.get('error');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <main className="grid min-h-screen place-items-center bg-ink-50 px-4 py-10">
      <section className="w-full max-w-md">
        <div className="mb-6">
          <div className="font-display text-3xl font-semibold text-ink-900">
            Owner<span className="text-accent-500">.</span>
          </div>
          <p className="mt-1 text-sm text-ink-500">
            Kontrol akses admin, audit, dan pendapatan.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6">
          <div className="space-y-4">
            <div>
              <label className="label">Email owner</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="label">Password</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          {(error || routeError) && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error ||
                (routeError === 'not_owner'
                  ? 'Akun ini belum punya akses owner.'
                  : 'Konfigurasi Supabase belum lengkap.')}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary mt-6 w-full"
            disabled={loading || !email.trim() || !password.trim()}
          >
            {loading ? 'Masuk...' : 'Masuk Owner Panel'}
          </button>
        </form>
      </section>
    </main>
  );
}
