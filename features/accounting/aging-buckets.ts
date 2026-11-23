export const defaultAgingBounds = [30, 60, 90];

export function parseAgingBounds(value: string): number[] {
  const parts = value.split(',').map(s => s.trim());
  const bounds = parts.map(Number);
  if (!parts.length || parts.length > 8 || parts.some(s => !/^\d+$/.test(s)) ||
      bounds.some((n, i) => n < 1 || n > 3650 || (i > 0 && n <= bounds[i - 1]))) {
    throw new Error('Enter up to eight increasing day limits, such as 30, 60, 90.');
  }
  return bounds;
}

export function agingLabels(bounds: number[]) {
  return ['Current', ...bounds.map((n, i) => `${i ? bounds[i - 1] + 1 : 1}–${n}`), `${bounds.at(-1)}+`, 'No date'];
}

export function configuredAgingBucket(date: string | null, today: string, bounds: number[]) {
  const labels = agingLabels(bounds);
  if (!date) return 'No date';
  const days = Math.floor((Date.parse(today + 'T00:00:00Z') - Date.parse(date + 'T00:00:00Z')) / 86400000);
  if (!Number.isFinite(days)) return 'No date';
  if (days <= 0) return 'Current';
  const index = bounds.findIndex(n => days <= n);
  return index < 0 ? labels[labels.length - 2] : labels[index + 1];
}
