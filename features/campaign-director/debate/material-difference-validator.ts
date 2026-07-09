import type { CampaignOption } from "./debate-types";

export type MaterialDimension =
  | "creatorTierAllocation"
  | "postingCadence"
  | "objectiveEmphasis"
  | "kpiPriorities"
  | "budgetAllocation"
  | "riskProfile"
  | "audienceStrategy"
  | "creatorMix"
  | "activationApproach";

export const MATERIAL_DIMENSIONS: MaterialDimension[] = [
  "creatorTierAllocation",
  "postingCadence",
  "objectiveEmphasis",
  "kpiPriorities",
  "budgetAllocation",
  "riskProfile",
  "audienceStrategy",
  "creatorMix",
  "activationApproach",
];

export const MIN_MATERIAL_DIMENSIONS = 4;

export type MaterialDifferenceValidation = {
  valid: boolean;
  errors: string[];
  dimensionsFound: MaterialDimension[];
  dimensionDetails: Record<MaterialDimension, boolean>;
  requiredMinimum: number;
};

function getOptionById(options: CampaignOption[], id: CampaignOption["id"]): CampaignOption {
  const opt = options.find((o) => o.id === id);
  if (!opt) throw new Error(`Missing option ${id}`);
  return opt;
}

function tierSignature(option: CampaignOption): string {
  return option.creatorTierStrategy
    .map((t) => `${t.tier}:${t.allocationPercent}`)
    .sort()
    .join("|");
}

function tierMaxSpread(options: CampaignOption[]): number {
  const tiers = new Set<string>();
  for (const opt of options) {
    for (const t of opt.creatorTierStrategy) tiers.add(t.tier);
  }
  let maxSpread = 0;
  for (const tier of tiers) {
    const pcts = options.map(
      (o) => o.creatorTierStrategy.find((t) => t.tier === tier)?.allocationPercent ?? 0
    );
    maxSpread = Math.max(maxSpread, Math.max(...pcts) - Math.min(...pcts));
  }
  return maxSpread;
}

function macroMegaPct(option: CampaignOption): number {
  return option.creatorTierStrategy
    .filter((t) => /macro|mega/i.test(t.tier))
    .reduce((s, t) => s + t.allocationPercent, 0);
}

function microNanoPct(option: CampaignOption): number {
  return option.creatorTierStrategy
    .filter((t) => /micro|nano/i.test(t.tier))
    .reduce((s, t) => s + t.allocationPercent, 0);
}

function distinctCount(values: unknown[]): number {
  return new Set(values.map((v) => JSON.stringify(v))).size;
}

function dimensionDiffers(options: CampaignOption[], dimension: MaterialDimension): boolean {
  switch (dimension) {
    case "creatorTierAllocation":
      return tierMaxSpread(options) >= 15;
    case "postingCadence":
      return distinctCount(options.map((o) => o.postingCadence)) >= 2;
    case "objectiveEmphasis":
      return distinctCount(options.map((o) => o.objectiveEmphasis)) >= 2;
    case "kpiPriorities":
      return distinctCount(options.map((o) => o.kpiPriorities.join(">"))) >= 2;
    case "budgetAllocation":
      return distinctCount(options.map((o) => o.budget.creatorFeePercent)) >= 2;
    case "riskProfile":
      return distinctCount(options.map((o) => o.riskProfile)) >= 2;
    case "audienceStrategy":
      return distinctCount(options.map((o) => o.audienceStrategy)) >= 2;
    case "creatorMix":
      return distinctCount(options.map((o) => tierSignature(o))) >= 2;
    case "activationApproach":
      return distinctCount(options.map((o) => o.timeline.activationPlan.approach)) >= 2;
    default:
      return false;
  }
}

export function analyzeMaterialDimensions(
  options: CampaignOption[]
): Pick<MaterialDifferenceValidation, "dimensionsFound" | "dimensionDetails"> {
  const dimensionDetails = {} as Record<MaterialDimension, boolean>;
  const dimensionsFound: MaterialDimension[] = [];

  for (const dimension of MATERIAL_DIMENSIONS) {
    const differs = dimensionDiffers(options, dimension);
    dimensionDetails[dimension] = differs;
    if (differs) dimensionsFound.push(dimension);
  }

  return { dimensionsFound, dimensionDetails };
}

/** Fail pipeline if options differ only by wording — strategy dimensions must differ substantively. */
export function validateOptionMaterialDifference(options: CampaignOption[]): MaterialDifferenceValidation {
  const errors: string[] = [];

  if (options.length !== 3) {
    errors.push(`Expected 3 options, got ${options.length}`);
    return {
      valid: false,
      errors,
      dimensionsFound: [],
      dimensionDetails: Object.fromEntries(
        MATERIAL_DIMENSIONS.map((d) => [d, false])
      ) as Record<MaterialDimension, boolean>,
      requiredMinimum: MIN_MATERIAL_DIMENSIONS,
    };
  }

  const a = getOptionById(options, "A");
  const b = getOptionById(options, "B");
  const c = getOptionById(options, "C");

  const durations = new Set(options.map((o) => o.timeline.durationWeeks));
  if (durations.size !== 1) {
    errors.push(
      `All options must share the same durationWeeks from CampaignFacts; got ${[...durations].join(", ")}`
    );
  }

  const macroPct = (opt: CampaignOption) =>
    opt.creatorTierStrategy.find((t) => /macro/i.test(t.tier))?.allocationPercent ?? 0;
  const nanoPct = (opt: CampaignOption) =>
    opt.creatorTierStrategy.find((t) => /nano/i.test(t.tier))?.allocationPercent ?? 0;
  const megaPct = (opt: CampaignOption) =>
    opt.creatorTierStrategy.find((t) => /mega/i.test(t.tier))?.allocationPercent ?? 0;

  const aMacro = macroPct(a);
  const cMacro = macroPct(c);
  const aNano = nanoPct(a);
  const cNano = nanoPct(c);

  if (Math.abs(aMacro - cMacro) < 20 && Math.abs(aNano - cNano) < 15) {
    errors.push(
      `Creator mix not materially different: A Macro ${aMacro}% vs C Macro ${cMacro}%; A Nano ${aNano}% vs C Nano ${cNano}%`
    );
  }

  if (macroMegaPct(a) < 50 && a.archetype === "max_reach") {
    errors.push(
      `Option A (Max Reach) should have heavy Macro/Mega mix, got Macro ${aMacro}% Mega ${megaPct(a)}%`
    );
  }

  if (cNano < 25 && c.archetype === "max_engagement") {
    errors.push(`Option C (Max Engagement) should have heavy Nano mix, got Nano ${cNano}%`);
  }

  if (a.budget.creatorFeePercent <= c.budget.creatorFeePercent) {
    errors.push("Option A should have higher creator fee % than Option C (premium tier fees)");
  }

  const aHasReachKpi = a.kpis.some((k) => /impression|reach/i.test(k.metric));
  const cHasEngagementKpi = c.kpis.some((k) => /engagement|ugc|er/i.test(k.metric));
  if (!aHasReachKpi) errors.push("Option A missing reach/impressions KPI");
  if (!cHasEngagementKpi) errors.push("Option C missing engagement/UGC KPI");

  const slices = new Set(options.map((o) => o.strategySlice));
  if (slices.size < 3) {
    errors.push("Strategy slices must be materially different, not wording-only variants");
  }

  const activationApproaches = new Set(options.map((o) => o.timeline.activationPlan.approach));
  if (activationApproaches.size < 3) {
    errors.push("Activation approach must differ across all 3 options (burst, even, ramp)");
  }

  const weekWeightSets = options.map((o) => o.timeline.activationPlan.weekWeights.join(","));
  if (new Set(weekWeightSets).size < 3) {
    errors.push("Week activation weights must differ across options");
  }

  const { dimensionsFound, dimensionDetails } = analyzeMaterialDimensions(options);
  if (dimensionsFound.length < MIN_MATERIAL_DIMENSIONS) {
    errors.push(
      `Options must differ in at least ${MIN_MATERIAL_DIMENSIONS} material dimensions; found ${dimensionsFound.length}: ${dimensionsFound.join(", ") || "none"}`
    );
  }

  if (b.archetype !== "balanced") {
    errors.push("Option B must be the balanced archetype");
  }

  return {
    valid: errors.length === 0,
    errors,
    dimensionsFound,
    dimensionDetails,
    requiredMinimum: MIN_MATERIAL_DIMENSIONS,
  };
}

export function summarizeOptionStrategy(option: CampaignOption): string {
  const tiers = option.creatorTierStrategy.map((t) => `${t.tier} ${t.allocationPercent}%`).join(" · ");
  const weights = option.timeline.activationPlan.weekWeights.join("/");
  return `${option.label}: ${tiers}; ${option.timeline.activationPlan.approach} (${weights}); ${option.objectiveEmphasis.slice(0, 60)}…`;
}
