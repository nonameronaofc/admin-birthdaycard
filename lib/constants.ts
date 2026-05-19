// Konstanta paket sesuai dokumentasi (bagian 1, 8)

export const PACKAGE_CODES = ['HM', 'RG', 'ST', 'RL', 'SL'] as const;
export type PackageCode = typeof PACKAGE_CODES[number];

export const PACKAGE_LABELS: Record<PackageCode, string> = {
  HM: 'Hemat',
  RG: 'Reguler',
  ST: 'Sultan',
  RL: 'Reguler Live',
  SL: 'Sultan Live',
};

export const PACKAGE_PRICES: Record<PackageCode, number> = {
  HM: 75000,
  RG: 155000,
  ST: 285000,
  RL: 72000,
  SL: 142000,
};

export const LIVE_PACKAGE_CODES: PackageCode[] = ['RL', 'SL'];
export const NORMAL_PACKAGE_CODES: PackageCode[] = ['HM', 'RG', 'ST'];

// Format kode regex final dari dokumentasi bagian 1
export const ORDER_CODE_REGEX = /^(HM|RG|ST|RL|SL)[A-Z0-9+!%&]{7}[A-Z0-9]$/;
export const TRIAL_CODE_REGEX = /^[A-Z0-9][A-Z0-9_-]{2,31}$/;

export const ORDER_STATUSES = ['pending', 'processing', 'completed', 'cancelled'] as const;
export const CODE_STATUSES = ['unused', 'used', 'expired'] as const;
export const SESSION_STATUSES = ['active', 'closed', 'cancelled'] as const;
export const GENDERS = ['boy', 'girl'] as const;
export const PARENTS_CONTENTS = ['none', 'single_mom', 'single_father', 'mom_and_dad'] as const;

export type OrderStatus = typeof ORDER_STATUSES[number];
export type CodeStatus = typeof CODE_STATUSES[number];
export type SessionStatus = typeof SESSION_STATUSES[number];
export type Gender = typeof GENDERS[number];
export type ParentsContent = typeof PARENTS_CONTENTS[number];

export const GENDER_LABELS: Record<Gender, string> = {
  boy: 'Boy',
  girl: 'Girl',
};

export function isLivePackage(code: PackageCode): boolean {
  return code === 'RL' || code === 'SL';
}

export function getPackageCodeFromOrderCode(orderCode: string): PackageCode | null {
  const prefix = orderCode.substring(0, 2);
  if (PACKAGE_CODES.includes(prefix as PackageCode)) {
    return prefix as PackageCode;
  }
  return null;
}
