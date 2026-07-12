/**
 * Generate-From-Anywhere planning — hydrate a source into a Campaign Object and
 * report which outputs are immediately generatable and what is still missing.
 * A source page uses this to render a "Generate Campaign Outputs" action without
 * duplicating any hydration or output logic.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";

import type { CampaignOutputKind } from "../output-types";
import { OUTPUT_CATALOG } from "../output-catalog";
import type { CampaignSeed, HydrationResult } from "./hydration-types";
import { hydrateCampaignObject } from "./hydrate";
import { readinessForOutput, type OutputReadiness } from "./missing-info";

export type GenerateFromSourcePlan = {
  result: HydrationResult;
  /** Readiness of every generatable output against the hydrated Campaign Object. */
  readiness: OutputReadiness[];
  /** Outputs that can be generated right now. */
  readyKinds: CampaignOutputKind[];
};

export function planGenerateFromSource(
  seed: CampaignSeed,
  existing?: CampaignObject,
  options?: { now?: string }
): GenerateFromSourcePlan {
  const result = hydrateCampaignObject(seed, existing, options);
  const readiness = OUTPUT_CATALOG.filter((d) => typeof d.generate === "function").map((d) =>
    readinessForOutput(result.campaignObject, d.kind)
  );
  return {
    result,
    readiness,
    readyKinds: readiness.filter((r) => r.ready).map((r) => r.kind),
  };
}
