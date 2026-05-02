'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { fetchJsonOrThrow } from '@/lib/client-api';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: 'O' },
  { href: '/orders', label: 'Pesanan', icon: 'P' },
  { href: '/codes', label: 'Kode Pesanan', icon: 'K' },
  { href: '/live-sessions', label: 'Live Sessions', icon: 'L' },
  { href: '/themes', label: 'Tema', icon: 'T' },
  { href: '/master-data', label: 'Master Data', icon: 'M' },
  { href: '/customer-style-options', label: 'Opsi Customer', icon: 'C' },
];

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetchJsonOrThrow('/api/admin/auth/logout', {
      method: 'POST',
    }, 'Logout gagal. Coba lagi.');
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="flex h-full min-h-screen w-64 flex-col border-r border-ink-100 bg-white">
      <div className="border-b border-ink-100 px-6 py-7">
        <div className="font-display text-xl font-semibold leading-tight text-ink-900">
          Admin<span className="text-accent-500">.</span>
        </div>
        <div className="mt-0.5 font-mono text-xs tracking-wide text-ink-500">
          BIRTHDAY VIDEO
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {NAV.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active ? 'bg-ink-900 text-white' : 'text-ink-700 hover:bg-ink-50'
              }`}
            >
              <span className={`font-mono text-xs ${active ? 'text-accent-300' : 'text-ink-400'}`}>
                {item.icon}
              </span>
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-ink-100 px-3 py-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-600 transition-colors hover:bg-ink-50"
        >
          <span className="font-mono text-xs text-ink-400">X</span>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
