/** Per-creator negotiated currency pair. The original commercial amount never changes. */
export type CreatorFxOverride = {
  from: string;
  to: string;
  rate: number;
  targetRateToEgp: number;
};

export function readCreatorFx(value: unknown): CreatorFxOverride | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const v = JSON.parse(value) as CreatorFxOverride;
    if (!/^[A-Z]{3}$/.test(v.from) || !/^[A-Z]{3}$/.test(v.to) || v.from === v.to ||
      !Number.isFinite(v.rate) || v.rate <= 0 || v.rate > 1e9 ||
      !Number.isFinite(v.targetRateToEgp) || v.targetRateToEgp <= 0 || v.targetRateToEgp > 1e9) return null;
    if (v.to === "EGP" && v.targetRateToEgp !== 1) return null;
    return { from: v.from, to: v.to, rate: v.rate, targetRateToEgp: v.targetRateToEgp };
  } catch { return null; }
}

export function makeCreatorFx(from: string, to: string, rate: number, targetRateToEgp: number): string {
  const value = JSON.stringify({ from, to, rate, targetRateToEgp: to === "EGP" ? 1 : targetRateToEgp });
  if (!readCreatorFx(value)) throw new Error("Enter a valid positive exchange rate for different currencies.");
  return value;
}

export function creatorFxRate(input: {
  from: string; to: string; sourceRateToEgp: number; targetRateToEgp: number; override?: string | null;
}): number {
  if (input.from === input.to) return 1;
  const custom = readCreatorFx(input.override);
  if (custom?.from === input.from) {
    if (custom.to === input.to) return custom.rate;
    // Keep the negotiated pair and its reporting snapshot; never rebase it on a new system rate.
    const target = input.to === "EGP" ? 1 : input.targetRateToEgp;
    if (!Number.isFinite(target) || target <= 0) throw new Error(`Missing FX rate: ${input.from} to ${input.to}`);
    return custom.rate * custom.targetRateToEgp / target;
  }
  const source = input.from === "EGP" ? 1 : input.sourceRateToEgp;
  const target = input.to === "EGP" ? 1 : input.targetRateToEgp;
  if (!Number.isFinite(source) || source <= 0 || !Number.isFinite(target) || target <= 0)
    throw new Error(`Missing FX rate: ${input.from} to ${input.to}`);
  return source / target;
}

export function creatorFxAmount(amount: number, input: Parameters<typeof creatorFxRate>[0]): number {
  return Math.round((amount * creatorFxRate(input) + Number.EPSILON) * 100) / 100;
}
