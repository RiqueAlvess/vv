/** Map employee count to a size band used for anonymous benchmarking. */
export function getCompanySizeBand(employeeCount: number): string {
  if (employeeCount <= 50) return 'micro';
  if (employeeCount <= 200) return 'pequena';
  if (employeeCount <= 1000) return 'media';
  return 'grande';
}

export const COMPANY_SIZE_LABELS: Record<string, string> = {
  micro:    'Micro (1–50)',
  pequena:  'Pequena (51–200)',
  media:    'Média (201–1 000)',
  grande:   'Grande (1 000+)',
};
