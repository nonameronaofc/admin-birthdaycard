import {
  ORDER_CODE_REGEX,
  HAIR_REGEX,
  EYE_REGEX,
  PACKAGE_CODES,
  GENDERS,
  PARENTS_CONTENTS,
} from './constants';
import type { Locale } from './i18n';

export type ValidationResult = {
  ok: boolean;
  error?: string;
  hint?: string;
  example?: string;
};

const ok = (): ValidationResult => ({ ok: true });
const fail = (error: string, hint?: string, example?: string): ValidationResult => ({
  ok: false,
  error,
  hint,
  example,
});

const HTML_TAG_REGEX = /[<>]/;

function en(locale: Locale) {
  return locale === 'en';
}

export function validateOrderCode(raw: string, locale: Locale = 'id'): ValidationResult {
  const code = (raw || '').trim().toUpperCase();
  if (!code) {
    return fail(
      en(locale) ? 'Order code is empty.' : 'Kode pesanan kosong.',
      en(locale)
        ? 'Enter the 10-character code you received from admin.'
        : 'Masukkan kode 10 karakter yang kamu terima dari admin.',
      'HM7A!9KQ2P'
    );
  }
  if (code.length !== 10) {
    return fail(
      en(locale)
        ? `The code must be 10 characters long (currently ${code.length}).`
        : `Panjang kode harus 10 karakter (saat ini ${code.length}).`,
      en(locale)
        ? 'The code starts with 2 package letters followed by 8 more characters.'
        : 'Kode terdiri dari 2 huruf paket di awal + 8 karakter setelahnya.',
      'HM7A!9KQ2P'
    );
  }
  const prefix = code.slice(0, 2);
  if (!PACKAGE_CODES.includes(prefix as any)) {
    return fail(
      en(locale) ? `Prefix "${prefix}" is not recognized.` : `Awalan "${prefix}" tidak dikenal.`,
      en(locale)
        ? 'The code must start with HM, RG, ST, RL, or SL.'
        : 'Kode harus diawali HM, RG, ST, RL, atau SL.',
      'HM7A!9KQ2P'
    );
  }
  if (!ORDER_CODE_REGEX.test(code)) {
    return fail(
      en(locale) ? 'Invalid code format.' : 'Format kode tidak valid.',
      en(locale)
        ? 'Only uppercase letters (A-Z), numbers (0-9), and + ! % & are allowed. The last character must be a letter or number.'
        : 'Hanya boleh huruf besar (A-Z), angka (0-9), dan simbol + ! % &. Karakter terakhir harus huruf atau angka.',
      'HM7A!9KQ2P'
    );
  }
  return ok();
}

export function validateCustomerName(raw: string, locale: Locale = 'id'): ValidationResult {
  const v = (raw || '').trim();
  if (!v) {
    return fail(
      en(locale) ? 'Customer name is required.' : 'Nama pemesan wajib diisi.',
      en(locale) ? 'Write your full name as the customer.' : 'Tulis nama lengkap kamu sebagai pemesan.',
      'Rina Lestari'
    );
  }
  if (v.length > 32) {
    return fail(
      en(locale)
        ? `Name is too long (${v.length} of max 32 characters).`
        : `Nama terlalu panjang (${v.length} dari maks 32 karakter).`,
      en(locale) ? 'Shorten the name if it is too long.' : 'Singkat nama jika terlalu panjang.',
      'Rina Lestari'
    );
  }
  if (HTML_TAG_REGEX.test(v)) {
    return fail(
      en(locale) ? 'Name cannot contain < or > characters.' : 'Nama tidak boleh mengandung karakter < atau >.',
      en(locale)
        ? 'Use letters, numbers, and normal punctuation only.'
        : 'Gunakan huruf, angka, dan tanda baca biasa saja.',
      'Rina Lestari'
    );
  }
  return ok();
}

export function validateCountryCode(raw: string, locale: Locale = 'id'): ValidationResult {
  if (!raw || !raw.startsWith('+')) {
    return fail(
      en(locale) ? 'Country code is required.' : 'Kode negara wajib dipilih.',
      en(locale) ? 'Choose one from the dropdown.' : 'Pilih dari dropdown.',
      '+62'
    );
  }
  return ok();
}

export function validateWhatsapp(raw: string, locale: Locale = 'id'): ValidationResult {
  const v = (raw || '').trim();
  if (!v) {
    return fail(
      en(locale) ? 'WhatsApp number is required.' : 'Nomor WhatsApp wajib diisi.',
      en(locale)
        ? 'Enter it without the country code and without a leading 0.'
        : 'Masukkan tanpa kode negara dan tanpa angka 0 di depan.',
      '8956182162'
    );
  }
  if (!/^\d+$/.test(v)) {
    return fail(
      en(locale) ? 'The number may contain digits only.' : 'Nomor hanya boleh berisi angka.',
      en(locale)
        ? 'Remove spaces, dashes, or other characters.'
        : 'Hapus spasi, tanda hubung, atau karakter lain.',
      '8956182162'
    );
  }
  if (v.startsWith('0')) {
    return fail(
      en(locale) ? 'Remove the leading 0.' : 'Hapus angka 0 di depan.',
      en(locale) ? 'Example: write 089561... as 89561...' : 'Contoh: 089561... ditulis 89561...',
      '8956182162'
    );
  }
  if (v.length < 7) {
    return fail(
      en(locale)
        ? `Number is too short (${v.length} digits, min 7).`
        : `Nomor terlalu pendek (${v.length} digit, min 7).`,
      en(locale) ? 'Double-check your WhatsApp number.' : 'Cek ulang nomor WhatsApp kamu.',
      '8956182162'
    );
  }
  if (v.length > 15) {
    return fail(
      en(locale)
        ? `Number is too long (${v.length} digits, max 15).`
        : `Nomor terlalu panjang (${v.length} digit, maks 15).`,
      en(locale) ? 'Double-check your WhatsApp number.' : 'Cek ulang nomor WhatsApp kamu.',
      '8956182162'
    );
  }
  return ok();
}

export function validateEmail(raw: string, required = false, locale: Locale = 'id'): ValidationResult {
  const v = (raw || '').trim();
  if (!v) {
    if (required) {
      return fail(
        en(locale) ? 'Email is required.' : 'Email wajib diisi.',
        en(locale) ? 'Format: name@domain.com' : 'Format: nama@domain.com',
        'rina@gmail.com'
      );
    }
    return ok();
  }
  if (v.length > 120) {
    return fail(
      en(locale)
        ? `Email is too long (${v.length} of max 120 characters).`
        : `Email terlalu panjang (${v.length} dari maks 120 karakter).`,
      undefined,
      'rina@gmail.com'
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
    return fail(
      en(locale) ? 'Invalid email format.' : 'Format email tidak valid.',
      en(locale) ? 'Make sure it has @ and a domain, such as .com.' : 'Pastikan ada @ dan domain (misal .com).',
      'rina@gmail.com'
    );
  }
  return ok();
}

export function validateChildNickname(raw: string, locale: Locale = 'id'): ValidationResult {
  const v = (raw || '').trim();
  if (!v) {
    return fail(
      en(locale) ? 'Child nickname is required.' : 'Nickname anak wajib diisi.',
      en(locale) ? 'A short nickname for the child.' : 'Nama panggilan singkat untuk anak.',
      'Kenzie'
    );
  }
  if (/\s/.test(v)) {
    return fail(
      en(locale) ? 'Nickname cannot contain spaces.' : 'Nickname tidak boleh mengandung spasi.',
      en(locale) ? 'Use one word only.' : 'Gunakan satu kata saja.',
      'Kenzie'
    );
  }
  if (/\d/.test(v)) {
    return fail(
      en(locale) ? 'Nickname cannot contain numbers.' : 'Nickname tidak boleh mengandung angka.',
      en(locale) ? 'Letters A-Z only.' : 'Hanya huruf A-Z.',
      'Kenzie'
    );
  }
  if (/[^A-Za-z]/.test(v)) {
    return fail(
      en(locale) ? 'Nickname may contain letters A-Z only, no symbols.' : 'Nickname hanya boleh huruf A-Z (tanpa simbol).',
      en(locale) ? 'Remove any non-letter characters.' : 'Hapus karakter selain huruf.',
      'Kenzie'
    );
  }
  if (v.length < 3) {
    return fail(
      en(locale)
        ? `Nickname is too short (${v.length} letters, min 3).`
        : `Nickname terlalu pendek (${v.length} huruf, min 3).`,
      undefined,
      'Kenzie'
    );
  }
  if (v.length > 10) {
    return fail(
      en(locale)
        ? `Nickname is too long (${v.length} letters, max 10).`
        : `Nickname terlalu panjang (${v.length} huruf, maks 10).`,
      undefined,
      'Kenzie'
    );
  }
  return ok();
}

export function validateChildFullName(raw: string, locale: Locale = 'id'): ValidationResult {
  const v = raw || '';
  if (!v.trim()) {
    return fail(
      en(locale) ? 'Child full name is required.' : 'Nama lengkap anak wajib diisi.',
      en(locale)
        ? 'It can be the same as the nickname if the child only has one name.'
        : 'Boleh sama dengan nickname jika anak hanya satu nama.',
      'Kenzie Alfarezi'
    );
  }
  if (v.length > 34) {
    return fail(
      en(locale)
        ? `Name is too long (${v.length} of max 34 characters).`
        : `Nama terlalu panjang (${v.length} dari maks 34 karakter).`,
      en(locale) ? 'Shorten the name if it is too long.' : 'Singkat nama jika terlalu panjang.',
      'Kenzie Alfarezi'
    );
  }
  if (v.startsWith(' ') || v.endsWith(' ')) {
    return fail(
      en(locale)
        ? 'Name cannot start or end with a space.'
        : 'Nama tidak boleh diawali atau diakhiri spasi.',
      en(locale) ? 'Remove the space at the beginning/end.' : 'Hapus spasi di awal/akhir.',
      'Kenzie Alfarezi'
    );
  }
  if (/ {2,}/.test(v)) {
    return fail(
      en(locale) ? 'Name contains double spaces.' : 'Nama mengandung spasi ganda.',
      en(locale) ? 'Use only one space between words.' : 'Gunakan hanya satu spasi antar kata.',
      'Kenzie Alfarezi'
    );
  }
  const spaces = (v.match(/ /g) || []).length;
  if (spaces > 2) {
    return fail(
      en(locale) ? `Too many spaces (${spaces}, max 2).` : `Terlalu banyak spasi (${spaces}, maks 2).`,
      en(locale) ? 'Use a maximum of 3 words.' : 'Gunakan maksimal 3 kata.',
      'Kenzie Alfarezi'
    );
  }
  if (HTML_TAG_REGEX.test(v)) {
    return fail(
      en(locale) ? 'Name cannot contain < or > characters.' : 'Nama tidak boleh mengandung karakter < atau >.',
      undefined,
      'Kenzie Alfarezi'
    );
  }
  return ok();
}

export function validateBirthdayNumber(raw: string | number, locale: Locale = 'id'): ValidationResult {
  if (raw === '' || raw === null || raw === undefined) {
    return fail(
      en(locale) ? 'Choose the birthday number.' : 'Pilih ulang tahun ke berapa.',
      en(locale) ? 'Dropdown from 1 to 10.' : 'Dropdown 1 sampai 10.'
    );
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 10) {
    return fail(
      en(locale) ? 'Choice must be a number from 1 to 10.' : 'Pilihan harus angka 1 sampai 10.',
      en(locale) ? 'Use the dropdown.' : 'Gunakan dropdown.'
    );
  }
  return ok();
}

export function validateGender(raw: string, locale: Locale = 'id'): ValidationResult {
  if (!GENDERS.includes(raw as any)) {
    return fail(en(locale) ? 'Choose the character gender.' : 'Pilih gender karakter.', 'Boy atau Girl.');
  }
  return ok();
}

export function validateHair(raw: string, locale: Locale = 'id'): ValidationResult {
  if (!HAIR_REGEX.test(raw)) {
    return fail(
      en(locale) ? 'Hair style must be HA-HZ.' : 'Hair style harus HA-HZ.',
      en(locale) ? 'Choose from Style A to Style Z.' : 'Pilih dari grid Style A sampai Style Z.'
    );
  }
  return ok();
}

export function validateEye(raw: string, locale: Locale = 'id'): ValidationResult {
  if (!EYE_REGEX.test(raw)) {
    return fail(
      en(locale) ? 'Eyeglasses must be EA-EZ.' : 'Eyeglasses harus EA-EZ.',
      en(locale) ? 'Choose from Style A to Style Z.' : 'Pilih dari grid Style A sampai Style Z.'
    );
  }
  return ok();
}

export function validateParentsContent(raw: string, locale: Locale = 'id'): ValidationResult {
  if (!PARENTS_CONTENTS.includes(raw as any)) {
    return fail(
      en(locale) ? 'Choose the family structure.' : 'Pilih struktur keluarga.',
      en(locale)
        ? 'No parents / Single Mom / Single Father / Mom & Dad.'
        : 'Tanpa orang tua / Single Mom / Single Father / Mom & Dad.'
    );
  }
  return ok();
}

export function validateParentNickname(raw: string, who: 'mom' | 'dad', locale: Locale = 'id'): ValidationResult {
  const label = who === 'mom'
    ? en(locale) ? 'Mom Nickname' : 'Nickname Ibu'
    : en(locale) ? 'Dad Nickname' : 'Nickname Ayah';
  const example = who === 'mom' ? 'Bunda Rina' : 'Ayah Budi';
  const v = raw || '';
  if (!v.trim()) {
    return fail(
      en(locale) ? `${label} is required for this theme.` : `${label} wajib diisi untuk tema ini.`,
      en(locale) ? 'Write the parent name to show in the theme.' : 'Tulis panggilan untuk orang tua.',
      example
    );
  }
  if (v.length > 16) {
    return fail(
      en(locale)
        ? `${label} is too long (${v.length} of max 16 characters).`
        : `${label} terlalu panjang (${v.length} dari maks 16 karakter).`,
      undefined,
      example
    );
  }
  if (v.startsWith(' ') || v.endsWith(' ')) {
    return fail(
      en(locale) ? `${label} cannot start or end with a space.` : `${label} tidak boleh diawali/diakhiri spasi.`,
      undefined,
      example
    );
  }
  if (/ {2,}/.test(v)) {
    return fail(
      en(locale) ? `${label} contains double spaces.` : `${label} mengandung spasi ganda.`,
      en(locale) ? 'Use one space only.' : 'Gunakan satu spasi saja.',
      example
    );
  }
  const spaces = (v.match(/ /g) || []).length;
  if (spaces > 1) {
    return fail(
      en(locale) ? `${label} has too many spaces (${spaces}, max 1).` : `${label} terlalu banyak spasi (${spaces}, maks 1).`,
      undefined,
      example
    );
  }
  if (HTML_TAG_REGEX.test(v)) {
    return fail(en(locale) ? `${label} cannot contain < or >.` : `${label} tidak boleh mengandung < atau >.`);
  }
  return ok();
}

export function validateParentSweetname(raw: string, who: 'mom' | 'dad', locale: Locale = 'id'): ValidationResult {
  const label = who === 'mom'
    ? en(locale) ? 'Mom Sweetname' : 'Sweetname Ibu'
    : en(locale) ? 'Dad Sweetname' : 'Sweetname Ayah';
  const example = who === 'mom' ? 'Bunda' : 'Ayah';
  const v = raw || '';
  if (!v.trim()) {
    return fail(
      en(locale) ? `${label} is required for this theme.` : `${label} wajib diisi untuk tema ini.`,
      en(locale) ? 'A short affectionate name.' : 'Panggilan sayang singkat.',
      example
    );
  }
  if (/\s/.test(v)) {
    return fail(
      en(locale) ? `${label} cannot contain spaces.` : `${label} tidak boleh mengandung spasi.`,
      en(locale) ? 'Use one word only.' : 'Gunakan satu kata saja.',
      example
    );
  }
  if (!/^[A-Za-z]+$/.test(v)) {
    return fail(
      en(locale) ? `${label} may contain letters A-Z only.` : `${label} hanya boleh huruf A-Z.`,
      en(locale) ? 'No numbers or symbols.' : 'Tanpa angka atau simbol.',
      example
    );
  }
  if (v.length > 7) {
    return fail(
      en(locale)
        ? `${label} is too long (${v.length} letters, max 7).`
        : `${label} terlalu panjang (${v.length} huruf, maks 7).`,
      undefined,
      example
    );
  }
  return ok();
}
