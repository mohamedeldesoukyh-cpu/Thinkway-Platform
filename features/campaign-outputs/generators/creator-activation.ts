/**
 * Creator Activation Plan generator — a per-creator activation brief: role in
 * the campaign and the recommended service type per platform. Derives from
 * creators + objective + platforms.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";

import type { CampaignOutputContent } from "../output-types";
import { resolveSlate } from "../output-inputs";
import { primaryService, tierRank } from "./generator-utils";

export const CREATOR_ACTIVATION_GENERATOR_VERSION = "1.0.0";

function roleForTier(tier: string | undefined): string {
  const rank = tierRank(tier);
  if (rank <= 0) return "Hero — headline reach & credibility";
  if (rank === 1) return "Amplifier — scale reach across the audience";
  if (rank === 2) return "Connector — depth and mid-funnel engagement";
  if (rank === 3) return "Advocate — frequency and authenticity";
  return "Grassroots — UGC and community proof";
}

export function generateCreatorActivation(campaignObject: CampaignObject): CampaignOutputContent {
  const facts = getCampaignFacts(campaignObject);
  const slate = resolveSlate(campaignObject);
  const objective = facts?.objective;
  const platforms = facts?.platforms?.length ? facts.platforms : ["Instagram"];
  const primaryPlatform = platforms[0]!;

  const ordered = [...slate].sort((a, b) => tierRank(a.tier) - tierRank(b.tier));
  const rows = ordered.map((c, i) => [
    String(i + 1),
    c.displayName,
    c.tier ?? "—",
    roleForTier(c.tier),
    primaryService(c.tier, primaryPlatform),
  ]);

  return {
    title: "Creator Activation Plan",
    summary: `Activation roles and recommended service types for ${slate.length} creator${slate.length === 1 ? "" : "s"}${objective ? ` toward "${objective}"` : ""}.`,
    sections: [
      {
        heading: "Activation Overview",
        body: objective
          ? `Each creator is activated to ladder up to the campaign objective: ${objective}. Publishing order leads with the highest-reach tiers, then sustains with frequency.`
          : "Each creator is activated by role; leads carry reach, the long tail carries frequency and authenticity.",
      },
      {
        heading: "Creator Roles & Services",
        table: {
          columns: ["Order", "Creator", "Tier", "Role", "Recommended service"],
          rows: rows.length ? rows : [["1", "—", "—", "Add creators", "—"]],
        },
      },
      {
        heading: "Recommendations",
        items: [
          "Brief lead creators first so their content sets the narrative for the rest",
          "Match service type to tier — premium video for leads, UGC/Stories for the tail",
          "Stagger activations to maintain momentum rather than clustering posts",
        ],
      },
    ],
    data: { primaryPlatform, roles: ordered.map((c) => ({ creator: c.displayName, tier: c.tier, role: roleForTier(c.tier), service: primaryService(c.tier, primaryPlatform) })) },
  };
}
