/**
 * Campaign fixtures for CDI validation — reuses ERS-3 scenario builder pattern.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";
import { CampaignDirector } from "@/features/campaign-intelligence/services/campaign-director";
import { createEmptyCampaignObject } from "@/features/campaign-intelligence/services/section-updaters";
import type { WorkflowTaskResult } from "@/features/ai-workflows/types";

export type CampaignFixtureId = "babyjoy" | "cocacola" | "adidas" | "tourism" | "finance" | "luxury";

export type CampaignFixtureDefinition = {
  id: CampaignFixtureId;
  label: string;
  brandName: string;
  analyze: string;
  strategy: string;
  budget: string;
  timeline: string;
  clientCreatorIds: string[];
};

function mockTask(
  taskId: string,
  content: string,
  agentId: string,
  structured?: Record<string, unknown>
): WorkflowTaskResult {
  return {
    taskId,
    status: "completed",
    agentId,
    content,
    structured,
    completedAt: new Date().toISOString(),
  };
}

export const CAMPAIGN_FIXTURES: CampaignFixtureDefinition[] = [
  {
    id: "babyjoy",
    label: "BabyJoy",
    brandName: "BabyJoy",
    analyze:
      "Launch BabyJoy Premium Diapers in Egypt. Target mothers with babies 0–3 years. Budget EGP 2,000,000. Campaign duration 6 weeks. Objective: Awareness and UGC.",
    strategy:
      "## Campaign Strategy\nAuthentic mom UGC for BabyJoy premium diapers.\n- Reach: 3M impressions\n- Engagement rate: 5.5%",
    budget:
      "Total budget: EGP 2,000,000\nCreator fees: EGP 1,240,000\nContent production: EGP 360,000\nContingency reserve: 10%",
    timeline: "Week 1: Campaign Start\nWeek 2-4: Content Production\nWeek 5: Publishing Window\nWeek 6: Reporting",
    clientCreatorIds: ["client_mom_egypt_1", "client_mom_egypt_2"],
  },
  {
    id: "cocacola",
    label: "Coca-Cola",
    brandName: "Coca-Cola",
    analyze:
      "Strategize a Coca-Cola summer engagement campaign targeting Gen Z. Budget $500,000 across Instagram and TikTok for 8 weeks.",
    strategy:
      "## Campaign Strategy\nGen Z summer engagement for Coca-Cola across TikTok and Instagram.\n- Reach: 12M views\n- Engagement rate: 4.8%",
    budget:
      "Total budget: USD 500,000\nCreator fees: USD 225,000\nContent production: USD 75,000\nPaid amplification: USD 100,000\nContingency reserve: 10%",
    timeline:
      "Week 1: Campaign Start\nWeek 2-5: Content Production\nWeek 6: Publishing Window\nWeek 7: Optimization\nWeek 8: Reporting",
    clientCreatorIds: ["client_genz_creator_1", "client_genz_creator_2"],
  },
  {
    id: "adidas",
    label: "Adidas",
    brandName: "Adidas Egypt",
    analyze:
      "Adidas Egypt sportswear product launch for new running collection. Target active lifestyle 18–35 in Cairo and Alexandria. Budget EGP 4,500,000. Duration 6 weeks.",
    strategy:
      "## Campaign Strategy\nStreet-to-stadium launch for Adidas running collection.\n- Reach: 8M views\n- Conversion: 2.1%",
    budget:
      "Total budget: EGP 4,500,000\nCreator fees: EGP 2,790,000\nProduction: EGP 810,000\nContingency: 10%",
    timeline: "Week 1: Kickoff\nWeek 2: Creator outreach\nWeek 3-4: Production\nWeek 5: Launch",
    clientCreatorIds: ["client_athlete_cairo", "client_runner_alex"],
  },
  {
    id: "tourism",
    label: "Tourism",
    brandName: "Visit Egypt",
    analyze:
      "Visit Egypt tourism campaign promoting ancient wonders and Red Sea adventures. Target adventure travelers 25–40. Budget USD 1,200,000. Duration 8 weeks.",
    strategy:
      "## Campaign Strategy\nDestination inspiration across TikTok, Instagram, YouTube.\n- Reach: 10M views\n- Trip planning clicks: 45K",
    budget:
      "Total budget: USD 1,200,000\nCreator fees: USD 504,000\nProduction: USD 264,000\nContingency: 10%",
    timeline: "Week 1: Strategy approval\nWeek 2: Discovery\nWeek 3-6: Content\nWeek 7: Launch",
    clientCreatorIds: ["client_travel_blogger_1", "client_adventure_egypt"],
  },
  {
    id: "finance",
    label: "Finance",
    brandName: "Emirates NBD",
    analyze:
      "Emirates NBD credit card launch in UAE. Target young professionals interested in finance, banking, and wealth management. Budget AED 600,000. Duration 6 weeks.",
    strategy:
      "## Campaign Strategy\nTrust-building finance education campaign.\n- Qualified leads: 2,500\n- Application rate: 1.8%",
    budget:
      "Total budget: AED 600,000\nCreator fees: AED 180,000\nProduction: AED 90,000\nContingency: 12%",
    timeline: "Week 1: Compliance review\nWeek 2: Educator outreach\nWeek 3-4: Content\nWeek 5: Go-live",
    clientCreatorIds: ["client_finance_uae", "client_wealth_tips"],
  },
  {
    id: "luxury",
    label: "Luxury",
    brandName: "Rolex",
    analyze:
      "Rolex Middle East prestige campaign targeting affluent professionals in UAE and Saudi Arabia. Budget USD 850,000. Duration 8 weeks.",
    strategy:
      "## Campaign Strategy\nHeritage craftsmanship storytelling for Rolex.\n- Reach: 2.5M qualified impressions\n- Brand favorability: +12%",
    budget:
      "Total budget: USD 850,000\nCreator fees: USD 408,000\nProduction: USD 238,000\nContingency: 8%",
    timeline: "Week 1: Brief lock\nWeek 2: Creator curation\nWeek 3-6: Production\nWeek 7: Go-live",
    clientCreatorIds: ["client_luxury_lifestyle", "client_prestige_uae"],
  },
];

export function buildFixtureCampaignObject(fixture: CampaignFixtureDefinition): CampaignObject {
  const mockCreators = [
    {
      id: `cr_${fixture.id}_1`,
      handle: "creator_a",
      displayName: "Creator A",
      platform: "instagram",
      followers: 120000,
    },
    {
      id: `cr_${fixture.id}_2`,
      handle: "creator_b",
      displayName: "Creator B",
      platform: "tiktok",
      followers: 85000,
    },
  ];

  const director = new CampaignDirector(
    createEmptyCampaignObject({
      id: `camp_${fixture.id}`,
      conversationId: `conv_${fixture.id}`,
      workflowId: "create-campaign",
    })
  );

  const stateData = {
    brandName: fixture.brandName,
    currency: fixture.budget.match(/\b(EGP|AED|USD|SAR)\b/i)?.[1] ?? "USD",
    budgetTotal: parseInt(fixture.budget.replace(/[^\d]/g, "").slice(0, 7), 10) || undefined,
    searchResults: mockCreators,
    searchTotal: 12,
  };

  director.applyTaskResult(mockTask("analyze-request", fixture.analyze, "planner"), stateData);
  director.applyTaskResult(mockTask("build-strategy", fixture.strategy, "strategist"), stateData);
  director.applyTaskResult(mockTask("estimate-budget", fixture.budget, "analyst"), stateData);
  director.applyTaskResult(
    mockTask("search-creators", "12 creators found", "scout", {
      mode: "creator_search",
      creators: mockCreators,
      total: 12,
    }),
    stateData
  );
  director.applyTaskResult(
    mockTask("build-shortlist", "Top 2 ranked", "scout", {
      mode: "ranked_creators",
      creators: mockCreators,
    }),
    stateData
  );
  director.applyTaskResult(mockTask("generate-timeline", fixture.timeline, "planner"), stateData);
  director.applyTaskResult(
    mockTask("prepare-approval", `${fixture.brandName} campaign draft`, "strategist"),
    stateData
  );

  return director.getObject();
}

export function buildAllFixtureCampaignObjects(): Map<CampaignFixtureId, CampaignObject> {
  const map = new Map<CampaignFixtureId, CampaignObject>();
  for (const fixture of CAMPAIGN_FIXTURES) {
    map.set(fixture.id, buildFixtureCampaignObject(fixture));
  }
  return map;
}
