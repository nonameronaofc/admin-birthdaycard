import type { PackageCode } from './constants';

/**
 * Format public_order_id sesuai dokumentasi bagian 7:
 * {PACKAGE_PREFIX}-{YYYYMMDD}-{HHMMSS}-{RANDOM5}
 */
export function generatePublicOrderId(packageCode: PackageCode): string {
  const now = new Date();
  const yyyy = now.getFullYear().toString();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const HH = String(now.getHours()).padStart(2, '0');
  const MM = String(now.getMinutes()).padStart(2, '0');
  const SS = String(now.getSeconds()).padStart(2, '0');

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let random5 = '';
  for (let i = 0; i < 5; i++) {
    random5 += chars[Math.floor(Math.random() * chars.length)];
  }

  return `${packageCode}-${yyyy}${mm}${dd}-${HH}${MM}${SS}-${random5}`;
}
