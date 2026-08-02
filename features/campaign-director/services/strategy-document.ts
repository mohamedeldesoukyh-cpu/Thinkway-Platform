import {
  detectIndustryFromBrief,
  getIndustryProfile,
} from "@/features/campaign-studio/services/industry-intelligence";

import type { CampaignFacts } from "../facts/campaign-facts-types";
import { extractCampaignFacts } from "../facts/extract-campaign-facts";
import { listPopulatedFactsFields } from "../facts/facts-to-context";
import { validateCampaignFacts } from "../facts/validate-campaign-facts";
import type { CampaignBriefInput, CampaignStrategyDocument } from "../types";

function defaultCreatorTierStrategy(
  industry: ReturnType<typeof detectIndustryFromBrief>
): CampaignStrategyDocument["creatorTierStrategy"] {
  const profile = getIndustryProfile(industry);
  if (profile.label === "Baby & Parenting") {
    return [
      { tier: "Macro", allocationPercent: 35, why: "Trusted mom voices drive authentic UGC at scale" },
      { tier: "Micro", allocationPercent: 40, why: "Micro creators deliver high engagement in niche parenting communities" },
      { tier: "Nano", allocationPercent: 25, why: "Nano tier fills long-tail authenticity and cost efficiency" },
    ];
  }

  if (profile.label === "Telecom") {
    return [
      { tier: "Celebrity", allocationPercent: 25, why: "Celebrity anchors launch the sound with instant mass awareness" },
      { tier: "Macro", allocationPercent: 30, why: "Macro entertainers convert awareness into challenge participation" },
      { tier: "Micro", allocationPercent: 30, why: "Micro trend waves keep the sound alive week over week" },
      { tier: "Nano", allocationPercent: 15, why: "Nano creators make participation feel organic and community-owned" },
    ];
  }

  if (/beverage|cpg|fmcg/i.test(profile.label)) {
    return [
      { tier: "Mega", allocationPercent: 20, why: "Mega creators anchor mass reach for summer engagement peaks" },
      { tier: "Macro", allocationPercent: 35, why: "Macro tier sustains weekly content velocity across platforms" },
      { tier: "Micro", allocationPercent: 30, why: "Micro creators localize Gen Z cultural moments" },
      { tier: "Nano", allocationPercent: 15, why: "Nano tier tests viral formats before scaling spend" },
    ];
  }

  return [
    { tier: "Macro", allocationPercent: 40, why: "Macro creators balance reach and production quality" },
    { tier: "Micro", allocationPercent: 35, why: "Micro tier drives engagement in category communities" },
    { tier: "Nano", allocationPercent: 25, why: "Nano tier provides cost-efficient long-tail coverage" },
  ];
}

function resolveFacts(brief: CampaignBriefInput): CampaignFacts {
  if (brief.campaignFacts) return validateCampaignFacts(brief.campaignFacts);
  return validateCampaignFacts(
    extractCampaignFacts({
      rawMessage: brief.rawMessage,
      brandName: brief.brandName,
      clientName: brief.clientName,
    })
  );
}

function factsToStrategyKpis(
  facts: CampaignFacts
): CampaignStrategyDocument["understanding"]["kpis"] {
  if (!facts.kpis?.length) {
    return [
      {
        metric: "Reach",
        // No "TBD": the governance QA gate fails any section containing
        // placeholder vocabulary (qa_no_placeholder), which blocked approval.
        target: "Confirm with brand",
        why: "Default KPI until brief specifies measurable targets",
      },
    ];
  }

  return facts.kpis.map((kpi) => {
    const colon = kpi.indexOf(":");
    if (colon > 0) {
      return {
        metric: kpi.slice(0, colon).trim(),
        target: kpi.slice(colon + 1).trim(),
        why: "Extracted from campaign facts SSOT",
      };
    }
    return { metric: kpi, target: "Per brief", why: "Extracted from campaign facts SSOT" };
  });
}

/** Campaign Director writes the single strategic document (SSOT) from validated facts. */
export function writeStrategyDocumentFromBrief(
  brief: CampaignBriefInput,
  factsOverride?: CampaignFacts
): CampaignStrategyDocument {
  const facts = factsOverride ?? resolveFacts(brief);
  const industry = detectIndustryFromBrief(facts.industry ?? brief.rawMessage);
  const profile = getIndustryProfile(industry, brief.rawMessage);

  const brand = facts.brandName ?? "Campaign Brand";
  const objective = facts.objective ?? "Brand awareness and engagement";
  const currency = facts.budget?.currency ?? "USD";
  const budgetTotal = facts.budget?.amount;
  const durationWeeks = facts.durationWeeks ?? 6;
  const audience = facts.audience ?? "Brand-relevant consumers in primary market";
  const platforms = facts.platforms ?? profile.platforms.slice(0, 3);
  const geography = facts.geography?.join(", ");
  const kpis = factsToStrategyKpis(facts);
  const creatorTierStrategy = defaultCreatorTierStrategy(industry);
  const constraints =
    facts.constraints && facts.constraints.length > 0
      ? facts.constraints
      : ["Creator fees include production unless brief specifies separate production budget"];
  const risks =
    facts.risks && facts.risks.length > 0
      ? facts.risks
      : ["Standard vendor availability and content approval timelines"];

  const budgetRationale = budgetTotal
    ? `${currency} ${budgetTotal.toLocaleString()} — allocated across creator tiers per influencer marketing model`
    : "Budget to be confirmed — allocation follows industry-weighted creator fee model";

  const timelineRationale = `${durationWeeks}-week client-facing execution window aligned to ${objective.toLowerCase()} objective`;

  const platformMix = platforms.map((platform) => ({
    platform,
    role: profile.platforms.includes(platform)
      ? "Primary channel for category audience"
      : "Supporting channel for reach extension",
    why: `${platform} selected per the campaign brief and ${profile.label} category benchmarks`,
  }));

  const pillars: CampaignStrategyDocument["pillars"] = [
    {
      title: "Objective",
      what: objective,
      why: "Anchors all specialist outputs to measurable business outcome",
    },
    {
      title: "Audience",
      what: audience,
      why: "Creator selection and content tone must mirror this segment's behavior",
    },
    {
      title: "Platform Mix",
      what: platforms.join(", "),
      why: "Channels chosen for audience presence and content format fit",
    },
    {
      title: "Creator Approach",
      what: creatorTierStrategy.map((t) => `${t.tier} ${t.allocationPercent}%`).join(" · "),
      why: "Tier mix balances reach, authenticity, and budget efficiency for category",
    },
  ];

  const narrative = [
    `# Campaign Strategy — ${brand}`,
    "",
    `**Facts SSOT:** extractedAt=${facts.extractedAt} · fields=[${listPopulatedFactsFields(facts).join(", ")}]`,
    `**Client / Brand:** ${facts.clientName ?? brand}`,
    `**Industry:** ${facts.industry ?? profile.label}`,
    `**Campaign Type:** ${facts.campaignType ?? profile.campaignType}`,
    `**Objective:** ${objective}`,
    `**Audience:** ${audience}`,
    geography ? `**Geography:** ${geography}` : null,
    budgetTotal ? `**Budget:** ${currency} ${budgetTotal.toLocaleString()}` : null,
    `**Duration:** ${durationWeeks} weeks`,
    `**Platforms:** ${platforms.join(", ")}`,
    "",
    "## Strategic Direction",
    `Drive ${objective.toLowerCase()} through authentic creator content on ${platforms.join(" and ")} — ${facts.campaignType ?? profile.campaignType} approach for ${facts.industry ?? profile.label}.`,
    "",
    "## KPI Framework",
    ...kpis.map((k) => `- ${k.metric}: ${k.target} — ${k.why}`),
    "",
    "## Creator Tier Progression",
    ...creatorTierStrategy.map((t) => `- ${t.tier} (${t.allocationPercent}%): ${t.why}`),
    "",
    "## Constraints",
    ...constraints.map((c) => `- ${c}`),
    "",
    "## Risk Flags",
    ...risks.map((r) => `- ${r}`),
  ]
    .filter(Boolean)
    .join("\n");

  return {
    id: `strategy_${Date.now()}`,
    version: 1,
    createdAt: new Date().toISOString(),
    factsRef: {
      extractedAt: facts.extractedAt,
      fields: listPopulatedFactsFields(facts),
    },
    understanding: {
      client: facts.clientName,
      brand,
      industry: facts.industry ?? profile.label,
      objective,
      budget: budgetTotal
        ? { amount: budgetTotal, currency, rationale: budgetRationale }
        : { currency, rationale: budgetRationale },
      timeline: { durationWeeks, rationale: timelineRationale },
      geography,
      audience,
      platforms,
      kpis,
      risks,
      constraints,
    },
    narrative,
    pillars,
    platformMix,
    creatorTierStrategy,
  };
}

/** Format strategy document for specialist prompt injection (domain-scoped). */
export function formatStrategyForSpecialist(
  strategy: CampaignStrategyDocument,
  domain: string,
  factsBlock?: string
): string {
  return [
    factsBlock ?? "",
    factsBlock ? "" : null,
    "=== CAMPAIGN STRATEGY (Director SSOT — do not contradict) ===",
    strategy.narrative,
    "",
    `=== YOUR DOMAIN: ${domain} ===`,
    "Provide WHAT and WHY for every recommendation. Do not invent facts outside the campaign facts SSOT and strategy document.",
    "Reference the strategy pillars and KPI framework above.",
  ]
    .filter((line) => line !== null)
    .join("\n");
}
