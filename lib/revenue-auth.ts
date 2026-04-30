import { createHash, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

const REVENUE_COOKIE = 'revenue_admin';

function getPassword() {
  return process.env.ADMIN_REVENUE_PASSWORD || '';
}

function sha256Hex(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function tokenForPassword(password: string) {
  return sha256Hex(`revenue:${password}`);
}

export function hasRevenuePasswordConfigured() {
  return getPassword().length > 0;
}

export function verifyRevenuePassword(password: string) {
  const expected = getPassword();
  if (!expected || !password) return false;

  const a = Buffer.from(sha256Hex(password));
  const b = Buffer.from(sha256Hex(expected));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function setRevenueCookie() {
  const password = getPassword();
  if (!password) throw new Error('ADMIN_REVENUE_PASSWORD belum diatur.');
  cookies().set(REVENUE_COOKIE, tokenForPassword(password), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
}

export function clearRevenueCookie() {
  cookies().set(REVENUE_COOKIE, '', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

export function isRevenueAuthed() {
  const password = getPassword();
  if (!password) return false;

  const current = cookies().get(REVENUE_COOKIE)?.value || '';
  const expected = tokenForPassword(password);
  if (!current) return false;

  const a = Buffer.from(current);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
