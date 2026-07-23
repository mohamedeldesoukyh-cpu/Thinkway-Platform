/**
 * Campaign journey moments — the strategic sequence agencies plan before weeks.
 */

export type CampaignMoment =
  | "launch"
  | "amplification"
  | "momentum"
  | "community"
  | "ugc"
  | "wrap_up";

export const CAMPAIGN_MOMENT_ORDER: CampaignMoment[] = [
  "launch",
  "amplification",
  "momentum",
  "community",
  "ugc",
  "wrap_up",
];

export const CAMPAIGN_MOMENT_LABELS: Record<CampaignMoment, string> = {
  launch: "Launch",
  amplification: "Amplification",
  momentum: "Momentum",
  community: "Community",
  ugc: "UGC",
  wrap_up: "Wrap-up",
};

/** Eligible campaign weeks (1-based) for each moment given flight length. */
export function eligibleWeeksForMoment(
  moment: CampaignMoment,
  durationWeeks: number,
  ugcEarliestWeek = 1
): number[] {
  const w = Math.max(1, durationWeeks);
  switch (moment) {
    case "launch":
      return w === 1 ? [1] : [1, ...(w >= 3 ? [2] : [])].filter((week) => week <= w);
    case "amplification": {
      const end = Math.min(w, Math.max(2, Math.ceil(w * 0.45)));
      return range(1, end);
    }
    case "momentum": {
      const start = Math.min(w, 2);
      const end = Math.min(w, Math.max(start, Math.ceil(w * 0.75)));
      return range(start, end);
    }
    case "community": {
      const start = Math.max(2, Math.ceil(w * 0.45));
      const end = Math.max(start, w - 1);
      return range(start, end);
    }
    case "ugc": {
      const start = Math.max(1, Math.min(ugcEarliestWeek, w));
      return range(start, w);
    }
    case "wrap_up":
      return [w];
    default:
      return range(1, w);
  }
}

function range(start: number, end: number): number[] {
  const weeks: number[] = [];
  for (let week = start; week <= end; week += 1) weeks.push(week);
  return weeks;
}

export function dominantMomentForWeek(week: number, durationWeeks: number): CampaignMoment {
  const w = Math.max(1, durationWeeks);
  if (week === 1) return "launch";
  if (week === w) return "wrap_up";
  if (week === w - 1 && w >= 3) return "ugc";
  if (week === 2 && w >= 3) return "amplification";
  if (week <= Math.ceil(w * 0.55)) return "momentum";
  return "community";
}
