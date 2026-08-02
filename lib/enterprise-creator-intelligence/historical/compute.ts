/**
 * Pure historical metric computations — reusable by Planning / Client / Reporting / Mobile.
 */

export function computeMedian(values: Array<number | null | undefined>): number | null {
  const nums = values
    .map((v) => (v == null ? null : Number(v)))
    .filter((v): v is number => v != null && Number.isFinite(v))
    .sort((a, b) => a - b);
  if (nums.length === 0) return null;
  const mid = Math.floor(nums.length / 2);
  if (nums.length % 2 === 1) return nums[mid]!;
  return (nums[mid - 1]! + nums[mid]!) / 2;
}

export function computeAverage(values: Array<number | null | undefined>): number | null {
  const nums = values
    .map((v) => (v == null ? null : Number(v)))
    .filter((v): v is number => v != null && Number.isFinite(v));
  if (nums.length === 0) return null;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

/**
 * Posts per week from publication timestamps within a window.
 * Falls back to null when sample is empty.
 */
export function computePostingFrequencyPerWeek(
  postedAtValues: Array<string | null | undefined>,
  options?: { windowDays?: number }
): number | null {
  const windowDays = options?.windowDays ?? 30;
  const times = postedAtValues
    .map((v) => (v ? new Date(v).getTime() : NaN))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  if (times.length === 0) return null;
  if (times.length === 1) {
    return Number((1 / (windowDays / 7)).toFixed(3));
  }
  const spanMs = Math.max(times[times.length - 1]! - times[0]!, 1);
  const spanDays = Math.max(spanMs / (1000 * 60 * 60 * 24), 1);
  const weeks = spanDays / 7;
  return Number((times.length / weeks).toFixed(3));
}

export function computeFollowerDifference(
  currentFollowers: number | null,
  priorFollowers: number | null
): number | null {
  if (currentFollowers == null || priorFollowers == null) return null;
  return currentFollowers - priorFollowers;
}

export function computeMonthlyGrowthRate(
  currentFollowers: number | null,
  priorFollowers: number | null
): number | null {
  if (currentFollowers == null || priorFollowers == null) return null;
  if (priorFollowers <= 0) return null;
  return Number(((currentFollowers - priorFollowers) / priorFollowers).toFixed(6));
}

export function deriveGrowthTrend(
  months: Array<{ monthlyGrowthRate: number | null }>
): "up" | "down" | "flat" | "unknown" {
  const recent = months
    .map((m) => m.monthlyGrowthRate)
    .filter((v): v is number => v != null)
    .slice(-3);
  if (recent.length === 0) return "unknown";
  const avg = recent.reduce((s, n) => s + n, 0) / recent.length;
  if (avg > 0.01) return "up";
  if (avg < -0.01) return "down";
  return "flat";
}
