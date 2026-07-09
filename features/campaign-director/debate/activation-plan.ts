import type { ActivationApproach, ActivationPlan, PostingIntensity } from "./debate-types";

/** Normalize week weights to sum to 100. */
function normalizeWeekWeights(weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum === 100) return weights;
  const factor = 100 / sum;
  const scaled = weights.map((w) => Math.round(w * factor));
  const diff = 100 - scaled.reduce((a, b) => a + b, 0);
  scaled[scaled.length - 1] += diff;
  return scaled;
}

function computeEvenWeights(weeks: number): number[] {
  const base = Math.floor(100 / weeks);
  const weights = Array.from({ length: weeks }, () => base);
  weights[weeks - 1] += 100 - base * weeks;
  return weights;
}

function computeBurstWeights(weeks: number): number[] {
  if (weeks === 1) return [100];
  const weights = Array.from({ length: weeks }, () => 0);
  weights[0] = 70;
  let allocated = 70;
  const restWeeks = weeks - 1;
  const perRest = Math.floor(30 / restWeeks);
  for (let i = 1; i < weeks; i++) {
    const w = i === weeks - 1 ? 100 - allocated : perRest;
    weights[i] = w;
    allocated += w;
  }
  return weights;
}

function computeRampWeights(weeks: number): number[] {
  const presets: Record<number, number[]> = {
    1: [100],
    2: [30, 70],
    3: [20, 30, 50],
    4: [15, 20, 35, 30],
    5: [12, 18, 22, 28, 20],
    6: [10, 15, 18, 22, 20, 15],
    7: [8, 12, 16, 22, 18, 14, 10],
    8: [8, 10, 14, 18, 20, 16, 10, 4],
  };
  if (presets[weeks]) return presets[weeks];

  const peak = Math.max(1, Math.ceil(weeks * 0.55));
  const raw = Array.from({ length: weeks }, (_, i) => {
    const dist = Math.abs(i + 1 - peak);
    return Math.max(1, weeks - dist);
  });
  return normalizeWeekWeights(raw);
}

export function computeWeekWeights(weeks: number, approach: ActivationApproach): number[] {
  switch (approach) {
    case "burst":
      return computeBurstWeights(weeks);
    case "even":
      return computeEvenWeights(weeks);
    case "ramp":
      return computeRampWeights(weeks);
  }
}

export function buildActivationPlan(
  durationWeeks: number,
  approach: ActivationApproach,
  postingIntensity: PostingIntensity,
  postsPerWeek: number,
  overlapStrategy: string
): ActivationPlan {
  return {
    approach,
    weekWeights: computeWeekWeights(durationWeeks, approach),
    postingIntensity,
    postsPerWeek,
    overlapStrategy,
  };
}

export function describeActivationOrder(plan: ActivationPlan): string {
  const weightSummary = plan.weekWeights
    .map((w, i) => `Week ${i + 1}: ${w}% creators`)
    .join(" → ");
  return `${plan.approach} activation — ${weightSummary}`;
}
