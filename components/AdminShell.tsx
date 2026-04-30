'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-ink-50 lg:flex">
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-ink-100 bg-white px-4 py-3 lg:hidden">
        <div>
          <div className="font-display text-lg font-semibold text-ink-900">
            Admin<span className="text-accent-500">.</span>
          </div>
          <div className="text-[10px] font-mono tracking-wide text-ink-500">
            BIRTHDAY VIDEO
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="btn-secondary px-3 py-1.5 text-xs"
          aria-label="Buka menu"
        >
          Menu
        </button>
      </div>

      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-ink-900/40 lg:hidden"
          aria-label="Tutup menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform lg:static lg:z-auto lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar onNavigate={() => setSidebarOpen(false)} />
      </div>

      <main className="min-w-0 flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
