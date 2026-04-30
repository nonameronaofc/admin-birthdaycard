// Single source of truth — harus tetap sinkron dengan admin lib/constants.ts
// Lihat ADMIN_CUSTOMER_SYNC_SPEC.md §15 (Data Yang Harus Sinkron)

export const PACKAGE_CODES = ['HM', 'RG', 'ST', 'RL', 'SL'] as const;
export type PackageCode = (typeof PACKAGE_CODES)[number];

export const PACKAGE_LABELS: Record<PackageCode, string> = {
  HM: 'Hemat',
  RG: 'Reguler',
  ST: 'Sultan',
  RL: 'Reguler Live',
  SL: 'Sultan Live',
};

export const LIVE_PACKAGES: PackageCode[] = ['RL', 'SL'];

export const ORDER_CODE_REGEX = /^(HM|RG|ST|RL|SL)[A-Z0-9+!%&]{7}[A-Z0-9]$/;

export const GENDERS = ['boy', 'girl'] as const;
export type Gender = (typeof GENDERS)[number];

export const PARENTS_CONTENTS = [
  'none',
  'single_mom',
  'single_father',
  'mom_and_dad',
] as const;
export type ParentsContent = (typeof PARENTS_CONTENTS)[number];

export const PARENTS_LABELS: Record<ParentsContent, string> = {
  none: 'Tanpa orang tua',
  single_mom: 'Single Mom',
  single_father: 'Single Father',
  mom_and_dad: 'Mom & Dad',
};

// Hair: HA - HZ
export const HAIR_CODES = Array.from({ length: 26 }, (_, i) =>
  `H${String.fromCharCode(65 + i)}`
);

// Eyeglasses: EA - EZ
export const EYE_CODES = Array.from({ length: 26 }, (_, i) =>
  `E${String.fromCharCode(65 + i)}`
);

export const HAIR_REGEX = /^H[A-Z]$/;
export const EYE_REGEX = /^E[A-Z]$/;

export const DEFAULT_HAIR = 'HA';
export const DEFAULT_EYE = 'EA';

export function buildAssetCode(
  gender: Gender,
  hair: string,
  eye: string
): string {
  return `${gender.toUpperCase()}-${hair}-${eye}`;
}

export const DEFAULT_BOY_ASSET = buildAssetCode('boy', DEFAULT_HAIR, DEFAULT_EYE);
export const DEFAULT_GIRL_ASSET = buildAssetCode('girl', DEFAULT_HAIR, DEFAULT_EYE);

export const ATTEMPT_LIMIT = 3;
export const BLOCK_DURATION_MIN = 30;
