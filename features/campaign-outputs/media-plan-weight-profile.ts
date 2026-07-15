export type WeightProfile = "burst" | "ramp" | "sustain" | "close" | "mid_peak" | "custom";

export function detectWeightProfile(weekWeights: number[]): WeightProfile {
  if (weekWeights.length <= 1) return "burst";

  const first = weekWeights[0] ?? 0;
  const last = weekWeights[weekWeights.length - 1] ?? 0;
  const mid = weekWeights.slice(1, -1);
  const midAvg = mid.length ? mid.reduce((sum, weight) => sum + weight, 0) / mid.length : first;

  if (first >= midAvg + 8 && first >= last + 8) return "burst";
  if (last >= first + 8 && last >= midAvg + 8) return "close";
  if (mid.length && mid.some((weight) => weight >= first + 6 && weight >= last + 6)) {
    return "mid_peak";
  }

  const spread = Math.max(...weekWeights) - Math.min(...weekWeights);
  if (spread <= 6) return "sustain";

  const firstHalf = weekWeights.slice(0, Math.ceil(weekWeights.length / 2));
  const secondHalf = weekWeights.slice(Math.ceil(weekWeights.length / 2));
  const firstHalfAvg = firstHalf.reduce((sum, weight) => sum + weight, 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((sum, weight) => sum + weight, 0) / secondHalf.length;
  if (secondHalfAvg >= firstHalfAvg + 8) return "ramp";

  return "custom";
}
