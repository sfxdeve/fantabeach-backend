const DURATION_REGEX = /^(\d+)([smhd])$/i;

const UNIT_TO_MS = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
} as const;

export function parseDurationToMs(value: string): number {
  const [, amountStr, unitStr] = DURATION_REGEX.exec(value)!;
  const unit = unitStr.toLowerCase() as keyof typeof UNIT_TO_MS;

  return Number.parseInt(amountStr, 10) * UNIT_TO_MS[unit];
}
