/**
 * Quotation activation contract — the commercial agreement is immutable.
 */

import type { SlateCreator } from "./output-inputs";
import type { DeliverableRole } from "./media-plan-deliverable-classification";
import type { CampaignMoment } from "./media-plan-moments";
import { CAMPAIGN_MOMENT_ORDER } from "./media-plan-moments";

export type ImmutableQuotationActivation = {
  activationId: string;
  creator: SlateCreator;
  primaryServiceType: string;
  platform: string;
  tierRank: number;
  role: DeliverableRole;
  creatorRound: number;
  deliverableIndex: number;
  deliverableTotal: number;
  companionServiceTypes: string[];
  mirrorServiceTypes: string[];
  influenceScore: number;
  preferredMoments: CampaignMoment[];
};

export function resolvePreferredMoments(input: {
  role: DeliverableRole;
  creatorRound: number;
  tierRank: number;
  tier?: string;
  weekOneWeight?: number;
  campaignObjective?: string;
}): CampaignMoment[] {
  if (input.role === "ugc") return ["ugc", "wrap_up"];
  if (input.creatorRound > 0) return ["momentum", "community"];

  const tier = input.tier?.trim().toLowerCase() ?? "";
  const heavyLaunch = (input.weekOneWeight ?? 25) >= 55;
  const objective = (input.campaignObjective ?? "").toLowerCase();

  if (tier === "celebrity" || tier === "mega") return ["launch", "amplification"];
  if (tier === "macro") {
    return heavyLaunch || /\bawareness|launch|reach\b/i.test(objective)
      ? ["launch", "amplification"]
      : ["amplification", "momentum"];
  }
  if (tier === "mid" || tier === "mid-tier") return ["amplification", "momentum"];
  if (tier === "micro") return ["momentum", "community"];
  return ["momentum", "community"];
}

function flattenServiceLines(slate: SlateCreator[]): string[] {
  const lines: string[] = [];
  for (const creator of slate) {
    const types = creator.serviceTypes?.length
      ? creator.serviceTypes
      : creator.serviceLabel
        ? creator.serviceLabel.split(/\s*(?:\+|·)\s*/).map((part) => part.trim()).filter(Boolean)
        : [];
    lines.push(...types);
  }
  return lines;
}

function collectContractLines(activations: ImmutableQuotationActivation[]): string[] {
  const lines: string[] = [];
  for (const activation of activations) {
    lines.push(activation.primaryServiceType);
    lines.push(...activation.companionServiceTypes);
    lines.push(...activation.mirrorServiceTypes);
  }
  return lines;
}

export function validateQuotationActivationContract(
  slate: SlateCreator[],
  activations: ImmutableQuotationActivation[]
): { ok: boolean; expected: number; accounted: number } {
  const expected = flattenServiceLines(slate).length;
  const accounted = collectContractLines(activations).length;
  return { ok: expected === accounted, expected, accounted };
}

export function sortActivationsByInfluence(
  activations: ImmutableQuotationActivation[]
): ImmutableQuotationActivation[] {
  return [...activations].sort((a, b) => {
    const momentDelta =
      CAMPAIGN_MOMENT_ORDER.indexOf(a.preferredMoments[0]!) -
      CAMPAIGN_MOMENT_ORDER.indexOf(b.preferredMoments[0]!);
    if (momentDelta !== 0) return momentDelta;
    if (b.influenceScore !== a.influenceScore) return b.influenceScore - a.influenceScore;
    return a.tierRank - b.tierRank;
  });
}

export function influenceScoreForActivation(input: {
  role: DeliverableRole;
  creatorRound: number;
  tier?: string;
}): number {
  const tier = input.tier?.trim().toLowerCase() ?? "";
  if (input.role === "ugc") return 40;
  if (tier === "celebrity" || tier === "mega") return 100;
  if (tier === "macro") return 85;
  if (tier === "mid" || tier === "mid-tier") return 70;
  if (tier === "micro") return 55;
  if (tier === "nano") return 40;
  if (input.creatorRound > 0) return 50;
  return 60;
}
