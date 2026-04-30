'use client';

import { useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type, onClose, duration = 3500 }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [onClose, duration]);

  const colors = {
    success: 'bg-green-600 text-white',
    error: 'bg-red-600 text-white',
    info: 'bg-ink-900 text-white',
  };

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 animate-in fade-in slide-in-from-bottom-2 sm:inset-x-auto sm:right-6 sm:bottom-6">
      <div className={`${colors[type]} w-full max-w-sm px-4 py-3 rounded-lg shadow-card text-sm font-medium`}>
        {message}
      </div>
    </div>
  );
}
