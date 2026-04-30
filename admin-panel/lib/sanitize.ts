// Sanitasi input sesuai dokumentasi bagian 18.
// Pakai library established (DOMPurify + validator.js).

import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';

/**
 * Bersihkan string dari HTML/script tag, trim whitespace.
 */
export function sanitizeText(input: unknown, maxLen = 500): string {
  if (typeof input !== 'string') return '';
  const cleaned = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  }).trim();
  return cleaned.substring(0, maxLen);
}

export function sanitizeOptional(input: unknown, maxLen = 500): string | null {
  const s = sanitizeText(input, maxLen);
  return s.length > 0 ? s : null;
}

export function sanitizeEmail(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!validator.isEmail(trimmed)) return null;
  return validator.normalizeEmail(trimmed) || null;
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
  if (!validator.isUUID(input)) return null;
  return input;
}

export function sanitizeDate(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  if (!validator.isDate(input, { format: 'YYYY-MM-DD', strictMode: true })) return null;
  return input;
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
