const BANDS = [
  { name: 'micro',   min: 1,    max: 50 },
  { name: 'pequena', min: 51,   max: 200 },
  { name: 'media',   min: 201,  max: 1000 },
  { name: 'grande',  min: 1001, max: Infinity },
] as const;

/** Returns the single band that contains this employee count. */
export function getCompanySizeBand(employeeCount: number): string {
  for (const b of BANDS) {
    if (employeeCount >= b.min && employeeCount <= b.max) return b.name;
  }
  return 'grande';
}

/**
 * Returns all bands that overlap the ±30 % proportional range around
 * employeeCount. Two companies are considered "similar size" when their
 * headcount differs by ≤ 30 % relative to the larger one.
 */
export function getProportionalBands(employeeCount: number): string[] {
  const lower = employeeCount * 0.70;
  const upper = employeeCount * 1.30;
  return BANDS
    .filter(b => b.max >= lower && b.min <= upper)
    .map(b => b.name);
}

export const COMPANY_SIZE_LABELS: Record<string, string> = {
  micro:    'Micro (1–50)',
  pequena:  'Pequena (51–200)',
  media:    'Média (201–1.000)',
  grande:   'Grande (1.000+)',
};
