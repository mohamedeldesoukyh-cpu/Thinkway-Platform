/**
 * Test-only fixture builder for the Deliverables Engine. Produces a minimal but
 * realistic Campaign Object with facts + a creator slate, so generators and the
 * dependency graph can be exercised without the full pipeline.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type {
  CreatorsSectionData,
  VendorSelectedReasoning,
} from "@/features/campaign-intelligence/types/section-schemas";

export type FixtureCreator = { id: string; name: string; tier: string };

const DEFAULT_CREATORS: FixtureCreator[] = [
  { id: "cr_star", name: "Nour Star", tier: "Celebrity" },
  { id: "cr_macro1", name: "Layla Macro", tier: "Macro" },
  { id: "cr_macro2", name: "Omar Macro", tier: "Macro" },
  { id: "cr_micro1", name: "Sara Micro", tier: "Micro" },
];

function emptySection() {
  return { content: "", status: "complete" as const };
}

export function buildCampaignObjectFixture(overrides?: {
  facts?: Partial<CampaignFacts>;
  creators?: FixtureCreator[];
  strategyContent?: string;
}): CampaignObject {
  const creators = overrides?.creators ?? DEFAULT_CREATORS;
  const selectedReasoning: VendorSelectedReasoning[] = creators.map((c) => ({
    creatorId: c.id,
    displayName: c.name,
    whySelected: "fit",
    expectedRole: c.tier,
    audienceMatch: "match",
    risk: "low",
    alternative: "n/a",
    confidence: 0.8,
    evidence: "e",
    tradeoff: "t",
  }));

  const creatorsData: CreatorsSectionData = {
    recommendations: {
      creatorIds: creators.map((c) => c.id),
      selectedReasoning,
    },
  };

  const facts: CampaignFacts = {
    clientName: "Acme Co",
    brandName: "Acme",
    objective: "Drive awareness for the summer launch",
    audience: "Women 18–34 in urban Egypt",
    geography: ["Egypt"],
    platforms: ["Instagram", "TikTok"],
    budget: { amount: 2_000_000, currency: "EGP" },
    durationWeeks: 6,
    kpis: ["10M reach", "4% engagement"],
    deliverables: ["12 Reels", "20 Stories"],
    risks: ["Creator availability in launch week"],
    extractedAt: new Date("2026-01-01").toISOString(),
    confidence: {},
    sources: {},
    ...overrides?.facts,
  };

  return {
    id: "camp_test",
    conversationId: "conv_test",
    updatedAt: new Date("2026-01-01").toISOString(),
    sections: {
      summary: emptySection(),
      audience: emptySection(),
      strategy: {
        content: overrides?.strategyContent ?? "The strategy leads with Celebrity reach, then sustains with Macro and Micro creators.",
        status: "complete",
      },
      creators: { content: "", data: creatorsData as unknown as Record<string, unknown>, status: "complete" },
      budget: emptySection(),
      timeline: emptySection(),
      performance: emptySection(),
      presentation: emptySection(),
      operations: emptySection(),
    },
    meta: {
      status: "complete",
      specialistProgress: [],
      campaignFacts: facts,
    },
  };
}
