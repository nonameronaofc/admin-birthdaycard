// Sanitasi input ringan tanpa dependency browser/DOM.
// File ini dipakai di API route Vercel, jadi harus aman untuk runtime serverless.

/**
 * Bersihkan string dari tag HTML sederhana, control char, dan trim whitespace.
 */
export function sanitizeText(input: unknown, maxLen = 500): string {
  if (typeof input !== 'string') return '';
  const cleaned = input
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();
  return cleaned.substring(0, maxLen);
}

export function sanitizeOptional(input: unknown, maxLen = 500): string | null {
  const s = sanitizeText(input, maxLen);
  return s.length > 0 ? s : null;
}

/**
 * Sanitasi input untuk pencarian PostgREST.
 * Hilangkan karakter yang bisa merusak syntax `.or(...)`,
 * lalu trim panjang input agar query tetap ringan.
 */
export function sanitizeSearchTerm(input: unknown, maxLen = 100): string {
  return sanitizeText(input, maxLen)
    .replace(/[,%()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Escape wildcard ILIKE agar `%` dan `_` dibaca sebagai teks biasa.
 */
export function escapeIlikePattern(input: string): string {
  return input.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function sanitizeEmail(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Validasi WhatsApp: digit-only, panjang 8-15.
 */
export function sanitizeWhatsApp(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const digits = input.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

export function sanitizeUUID(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function sanitizeDate(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;

  const [year, month, day] = trimmed.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return trimmed;
}

export function sanitizeInt(input: unknown, min: number, max: number): number | null {
  const n = typeof input === 'number' ? input : parseInt(String(input), 10);
  if (isNaN(n) || n < min || n > max) return null;
  return n;
}

export function sanitizeEnum<T extends string>(
  input: unknown,
  allowed: readonly T[]
): T | null {
  if (typeof input !== 'string') return null;
  if (!(allowed as readonly string[]).includes(input)) return null;
  return input as T;
}
