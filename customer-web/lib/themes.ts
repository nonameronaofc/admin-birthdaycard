import type { Gender, ParentsContent, PackageCode } from './constants';

export type ThemeImage = {
  id: string;
  image_url: string;
  position: number;
};

export type Theme = {
  id: string;
  theme_code: string;
  name: string;
  gender: Gender;
  parents_content: ParentsContent;
  requires_parents_nickname: boolean;
  requires_parents_nickname_video?: boolean;
  requires_parents_nickname_print?: boolean;
  requires_parents_sweetname: boolean;
  image_url: string;
  is_active: boolean;
  images: ThemeImage[];
};

// Fetch tema yang lolos 4 filter sesuai sync spec §13:
// - is_active = true
// - gender match
// - parents_content match
// - package code match (lewat tabel theme_package_codes)
export async function fetchEligibleThemes(opts: {
  gender: Gender;
  parents_content: ParentsContent;
  package_code: PackageCode;
}): Promise<Theme[]> {
  const params = new URLSearchParams({
    gender: opts.gender,
    parents_content: opts.parents_content,
    package_code: opts.package_code,
  });
  const res = await fetch(`/api/customer/themes?${params.toString()}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Gagal memuat tema.');
  return data.themes || [];
}

// Untuk preview asset character — pakai admin asset API yg dishare via storage bucket
export async function fetchCharacterAssetUrl(opts: {
  gender: Gender;
  hair_style_code: string;
  eyeglasses_code: string;
}): Promise<string | null> {
  const params = new URLSearchParams({
    gender: opts.gender,
    hair_style_code: opts.hair_style_code,
    eyeglasses_code: opts.eyeglasses_code,
  });
  const res = await fetch(`/api/customer/character-asset?${params.toString()}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.image_url || null;
}

export async function fetchCustomerStyleOptions(): Promise<{
  hair_codes: string[];
  eyeglasses_codes: string[];
}> {
  const res = await fetch('/api/customer/style-options');
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Gagal memuat opsi karakter.');
  return {
    hair_codes: Array.isArray(data.hair_codes) ? data.hair_codes : [],
    eyeglasses_codes: Array.isArray(data.eyeglasses_codes) ? data.eyeglasses_codes : [],
  };
}
