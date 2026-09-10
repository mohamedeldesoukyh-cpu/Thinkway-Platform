/**
 * The one per-industry creator tier mix.
 *
 * This table already existed inside `presentation-intelligence`, reached through
 * `getIndustryCreatorMix`, and it covers every `CampaignIndustry` with a real
 * mix. Two other copies of "the industry mix" had grown alongside it — one in
 * `facts-display-bridge.buildCreatorMixFromFacts` and one in
 * `strategy-document.defaultCreatorTierStrategy` — each with four industry
 * branches and the same universal `Macro 40 / Micro 35 / Nano 25` fallback for
 * everything else, which is how unrelated campaigns all ended up with 40/35/25.
 *
 * Moved here so all three read this table instead of keeping their own. It is
 * the same data and the same function; nothing new was invented.
 */

import { isMassAwarenessCreatorBrief } from "./derive-creator-categories";
import type { CampaignIndustry } from "./industry-intelligence";
import type { CreatorMixTier } from "@/features/campaign-intelligence/types/section-schemas";

export const MIX_BY_INDUSTRY: Record<CampaignIndustry, CreatorMixTier[]> = {
  luxury: [
    { tier: "Celebrity", count: 1, percent: 15, reasoning: "Brand ambassador credibility" },
    { tier: "Macro", count: 2, percent: 35, reasoning: "Premium reach with editorial quality" },
    { tier: "Mid", count: 3, percent: 30, reasoning: "Lifestyle aspiration content" },
    { tier: "Micro", count: 2, percent: 15, reasoning: "Niche luxury communities" },
    { tier: "Nano", count: 0, percent: 5, reasoning: "Reserved for event coverage" },
  ],
  beauty: [
    { tier: "Macro", count: 1, percent: 20, reasoning: "Category authority and campaign scale" },
    { tier: "Mid", count: 3, percent: 30, reasoning: "Routine and demonstration content depth" },
    { tier: "Micro", count: 4, percent: 35, reasoning: "Trusted haircare and skincare communities" },
    { tier: "Nano", count: 3, percent: 15, reasoning: "Authentic before/after proof at volume" },
    { tier: "Celebrity", count: 0, percent: 0, reasoning: "Not required for consideration-led beauty" },
  ],
  tourism: [
    { tier: "Macro", count: 2, percent: 25, reasoning: "Travel storytellers with global reach" },
    { tier: "Mid", count: 4, percent: 35, reasoning: "Destination content specialists" },
    { tier: "Micro", count: 6, percent: 30, reasoning: "Local guides & experience creators" },
    { tier: "Nano", count: 4, percent: 10, reasoning: "Authentic traveler UGC" },
    { tier: "Celebrity", count: 0, percent: 0, reasoning: "Not required for destination campaigns" },
  ],
  baby: [
    { tier: "Mid", count: 3, percent: 25, reasoning: "Established mom influencers" },
    { tier: "Micro", count: 8, percent: 45, reasoning: "Relatable mom creators with engaged communities" },
    { tier: "Nano", count: 6, percent: 25, reasoning: "Authentic UGC from real parents" },
    { tier: "Macro", count: 1, percent: 5, reasoning: "Category authority figure" },
    { tier: "Celebrity", count: 0, percent: 0, reasoning: "Authenticity over celebrity for baby category" },
  ],
  retail: [
    { tier: "Macro", count: 1, percent: 20, reasoning: "Launch hero & hype driver" },
    { tier: "Mid", count: 4, percent: 30, reasoning: "Fitness & lifestyle creators" },
    { tier: "Micro", count: 8, percent: 35, reasoning: "Product try-on & fit content" },
    { tier: "Nano", count: 10, percent: 15, reasoning: "Street style UGC volume" },
    { tier: "Celebrity", count: 0, percent: 0, reasoning: "Performance over celebrity endorsement" },
  ],
  finance: [
    { tier: "Mid", count: 3, percent: 30, reasoning: "Verified finance educators" },
    { tier: "Micro", count: 5, percent: 35, reasoning: "Niche personal finance communities" },
    { tier: "Macro", count: 1, percent: 20, reasoning: "Trust anchor & reach driver" },
    { tier: "Nano", count: 3, percent: 10, reasoning: "Customer testimonial style UGC" },
    { tier: "Celebrity", count: 0, percent: 5, reasoning: "Credibility over fame in finance" },
  ],
  telecom: [
    { tier: "Celebrity", count: 2, percent: 25, reasoning: "Celebrity anchors launch the sound with instant mass awareness" },
    { tier: "Macro", count: 4, percent: 30, reasoning: "Macro entertainers convert awareness into challenge participation" },
    { tier: "Micro", count: 12, percent: 30, reasoning: "Micro trend waves keep the sound alive week over week" },
    { tier: "Nano", count: 15, percent: 15, reasoning: "Nano creators make participation feel organic and community-owned" },
  ],
  general: [
    { tier: "Mid", count: 3, percent: 30, reasoning: "Core campaign creators" },
    { tier: "Micro", count: 5, percent: 40, reasoning: "Engagement-focused content" },
    { tier: "Nano", count: 4, percent: 20, reasoning: "Volume UGC" },
    { tier: "Macro", count: 1, percent: 10, reasoning: "Reach amplification" },
    { tier: "Celebrity", count: 0, percent: 0, reasoning: "Not required" },
  ],
};

/** Strategy tier mix per industry — the SSOT the creator slate must track. */
export function getIndustryCreatorMix(
  industry: CampaignIndustry,
  contextText?: string
): CreatorMixTier[] {
  if (industry === "finance" && contextText && isMassAwarenessCreatorBrief(contextText)) {
    return MIX_BY_INDUSTRY.telecom.filter((tier) => tier.percent > 0 || tier.count > 0);
  }
  return MIX_BY_INDUSTRY[industry] ?? MIX_BY_INDUSTRY.general;
}
