export const PACKAGE_CODES = ['HM', 'RG', 'ST', 'RL', 'SL'] as const;
export type PackageCode = (typeof PACKAGE_CODES)[number];

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

export const INTERNAL_ROLES = ['owner', 'admin'] as const;
export const INTERNAL_STATUSES = ['active', 'disabled', 'pending'] as const;

export type InternalRole = (typeof INTERNAL_ROLES)[number];
export type InternalStatus = (typeof INTERNAL_STATUSES)[number];
