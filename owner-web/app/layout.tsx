import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Owner Panel - Birthday Video',
  description: 'Owner control panel untuk akses admin dan pendapatan.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
