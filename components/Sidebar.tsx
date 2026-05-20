'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

const NAV_GROUPS = [
  {
    label: 'Operasional',
    items: [
      { href: '/orders', label: 'Pesanan', hint: 'Order masuk' },
      { href: '/codes', label: 'Kode Pesanan', hint: 'Import & trial' },
      { href: '/live-sessions', label: 'Live Sessions', hint: 'Paket live' },
    ],
  },
  {
    label: 'Konten Customer',
    items: [
      { href: '/themes', label: 'Tema', hint: 'Preview & karakter' },
    ],
  },
  {
    label: 'Laporan',
    items: [
      { href: '/dashboard', label: 'Dashboard', hint: 'Ringkasan' },
    ],
  },
];

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="flex h-full min-h-screen w-64 flex-col border-r border-ink-200 bg-white">
      <div className="border-b border-ink-200 px-5 py-5">
        <div className="text-lg font-semibold leading-tight text-ink-900">
          Admin<span className="text-accent-500">.</span>
        </div>
        <div className="mt-0.5 font-mono text-[11px] tracking-wide text-ink-500">
          BIRTHDAY VIDEO
        </div>
      </div>

      <nav className="flex-1 space-y-5 px-3 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
              {group.label}
            </div>
            <div className="space-y-1">
              {group.items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={`block rounded-md border px-3 py-2 transition-colors ${
                      active
                        ? 'border-ink-900 bg-ink-900 text-white'
                        : 'border-transparent text-ink-700 hover:border-ink-200 hover:bg-ink-50'
                    }`}
                  >
                    <span className="block text-sm font-medium leading-tight">{item.label}</span>
                    <span className={`mt-0.5 block text-[11px] leading-tight ${active ? 'text-ink-200' : 'text-ink-400'}`}>
                      {item.hint}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-ink-200 px-3 py-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-ink-600 transition-colors hover:bg-ink-50"
        >
          <span>Logout</span>
          <span className="font-mono text-xs text-ink-400">X</span>
        </button>
      </div>
    </aside>
  );
}
