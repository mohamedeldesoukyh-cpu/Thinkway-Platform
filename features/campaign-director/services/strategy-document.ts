import {
  detectIndustryFromBrief,
  getIndustryProfile,
} from "@/features/campaign-studio/services/industry-intelligence";

import type { CampaignFacts } from "../facts/campaign-facts-types";
import { listPopulatedFactsFields } from "../facts/facts-to-context";
import { resolveCreatorTierMixFromFacts } from "../facts/facts-display-bridge";
import { validateCampaignFacts } from "../facts/validate-campaign-facts";
import type { CampaignBriefInput, CampaignStrategyDocument } from "../types";
import type { StrategyContext } from "@/features/campaign-intelligence-profile/services/campaign-understanding/build-strategy-context";

/**
 * The Strategy document's creator tier allocation.
 *
 * This used to be a second copy of the industry ladder, ending in a universal
 * `Macro 40 / Micro 35 / Nano 25` for every industry without a branch. It now
 * reads the same resolution the rest of the platform reads, so the brief's
 * stated tiers reach the generated Strategy — and the Strategy allocation the
 * slate consumes is that same mix, not a parallel default.
 */
function defaultCreatorTierStrategy(
  facts: CampaignFacts,
  context?: StrategyContext
): CampaignStrategyDocument["creatorTierStrategy"] {
  const semanticTiers = context?.creatorRequirements
    .filter((fact) => /creator_strategy|creator_tier/i.test(fact.concept) && fact.status === "confirmed")
    .flatMap((fact) => {
      if (Array.isArray(fact.value)) return fact.value;
      if (fact.value && typeof fact.value === "object") {
        return Object.entries(fact.value).map(([tier, count]) => ({ tier, count }));
      }
      return [];
    })
    .flatMap((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
      const value = entry as Record<string, unknown>;
      return typeof value.tier === "string"
        ? [{ tier: value.tier, ...(typeof value.percent === "number" ? { percent: value.percent } : {}) }]
        : [];
    });
  const contextFacts = semanticTiers?.length
    ? { ...facts, creatorTiers: semanticTiers }
    : facts;
  return resolveCreatorTierMixFromFacts(contextFacts)
    .mix.filter((tier) => tier.percent > 0)
    .map((tier) => ({
      tier: tier.tier,
      allocationPercent: tier.percent,
      why: tier.reasoning,
      basis: {
        origin: semanticTiers?.length ? "SOURCE_STATED" : "HEURISTIC_DEFAULT",
        confidence: context ? 0.7 : 0.42,
        factIds: context?.creatorRequirements.filter((fact) => /tier|creator_strategy/i.test(fact.concept)).map((fact) => fact.id) ?? [],
        disclosure: semanticTiers?.length ? undefined : "Industry mix recommendation; the brief did not specify an allocation.",
      },
    }));
}

function resolveFacts(brief: CampaignBriefInput): CampaignFacts {
  if (brief.campaignFacts) return validateCampaignFacts(brief.campaignFacts);
  return validateCampaignFacts({
    extractedAt: new Date().toISOString(),
    confidence: {},
    sources: {},
    brandName: brief.brandName,
    clientName: brief.clientName,
    rawBriefExcerpt: brief.rawMessage.slice(0, 1500),
  });
}

function blockedStrategyDocument(facts: CampaignFacts, context: StrategyContext): CampaignStrategyDocument {
  const reasons = [...context.readiness.strategy.assessments
    .filter((assessment) => assessment.status === "blocked")
    .map((assessment) => assessment.reason),
    ...context.openConflicts.filter((conflict) => conflict.appliesToStages?.includes("strategy")).map((conflict) => conflict.summary)];
  return {
    id: `strategy_blocked_${Date.now()}`, version: 1, createdAt: new Date().toISOString(), status: "blocked",
    factsRef: { extractedAt: facts.extractedAt, fields: listPopulatedFactsFields(facts) },
    strategyContext: context, campaignUnderstandingRef: context.campaignUnderstandingRef,
    readiness: context.readiness, scopedRecommendations: context.scopedRequirements,
    decisionBasis: {},
    understanding: { brand: facts.brandName ?? "Campaign Brand", objective: "", audience: "", platforms: [], kpis: [], risks: [], constraints: reasons },
    narrative: ["# Campaign Strategy — blocked", "", "Strategy cannot be generated until the confirmed Campaign Understanding blockers are resolved.", ...reasons.map((reason) => `- ${reason}`)].join("\n"),
    pillars: [], platformMix: [], creatorTierStrategy: [],
  };
}

function factsToStrategyKpis(
  facts: CampaignFacts
): CampaignStrategyDocument["understanding"]["kpis"] {
  if (!facts.kpis?.length) {
    return [];
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
  factsOverride?: CampaignFacts,
  context?: StrategyContext
): CampaignStrategyDocument {
  const facts = factsOverride ?? resolveFacts(brief);
  if (context?.readiness.strategy.status === "blocked") return blockedStrategyDocument(facts, context);
  const industry = detectIndustryFromBrief(facts.industry ?? brief.rawMessage);
  const profile = getIndustryProfile(industry, brief.rawMessage);

  const brand = facts.brandName ?? "Campaign Brand";
  const objective = facts.objective ?? "";
  const currency = facts.budget?.currency ?? "USD";
  const budgetTotal = facts.budget?.amount;
  const durationWeeks = facts.durationWeeks;
  const audience = facts.audience ?? "";
  const primaryContextPlatforms = context?.platformDirectives.filter((directive) => directive.priority === "primary" && !directive.basis.scope && !directive.basis.condition) ?? [];
  const platforms = primaryContextPlatforms.length > 0 ? primaryContextPlatforms.map((directive) => directive.platform) : (facts.platforms ?? profile.platforms.slice(0, 3));
  const geography = facts.geography?.join(", ");
  const kpis = factsToStrategyKpis(facts);
  const creatorTierStrategy = defaultCreatorTierStrategy(facts, context);
  const constraints =
    facts.constraints && facts.constraints.length > 0
      ? facts.constraints
      : [];
  const risks =
    facts.risks && facts.risks.length > 0
      ? facts.risks
      : [];

  const budgetRationale = budgetTotal
    ? `${currency} ${budgetTotal.toLocaleString()} — allocated across creator tiers per influencer marketing model`
    : "Budget to be confirmed — allocation follows industry-weighted creator fee model";

  const timelineRationale =
    durationWeeks != null
      ? `${durationWeeks}-week client-facing execution window${objective ? ` aligned to ${objective.toLowerCase()} objective` : ""}`
      : "Campaign duration to be confirmed — do not invent a default window";

  const platformMix = platforms.map((platform) => ({
    platform,
    role: facts.platforms?.includes(platform) ? "Brief-stated platform" : "Recommended channel",
    why: facts.platforms?.includes(platform) ? `${platform} is stated in Campaign Facts.` : `${platform} is an industry recommendation, not a brief-stated requirement.`,
    priority: facts.platforms?.includes(platform) ? ("primary" as const) : ("optional" as const),
    basis: { origin: facts.platforms?.includes(platform) ? "SOURCE_STATED" : "HEURISTIC_DEFAULT", confidence: facts.platforms?.includes(platform) ? facts.confidence.platforms : 0.42, factIds: [], disclosure: facts.platforms?.includes(platform) ? undefined : "Industry platform recommendation; confirm before treating as required." },
  }));

  const pillars: CampaignStrategyDocument["pillars"] = [
    {
      title: "Objective",
      what: objective || "Objective is open — confirm before approval.",
      why: "Anchors all specialist outputs to measurable business outcome",
    },
    {
      title: "Audience",
      what: audience || "Audience is open — confirm before approval.",
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
    `**Objective:** ${objective || "Open — confirm campaign objective"}`,
    `**Audience:** ${audience || "Open — confirm audience"}`,
    geography ? `**Geography:** ${geography}` : null,
    budgetTotal ? `**Budget:** ${currency} ${budgetTotal.toLocaleString()}` : null,
    durationWeeks != null ? `**Duration:** ${durationWeeks} weeks` : null,
    `**Platforms:** ${platforms.join(", ") || "Open — confirm platform strategy"}`,
    "",
    "## Strategic Direction",
    objective ? `Drive ${objective.toLowerCase()} through authentic creator content on ${platforms.join(" and ")} — ${facts.campaignType ?? profile.campaignType} approach for ${facts.industry ?? profile.label}.` : "Campaign objective is open; Strategy cannot claim a campaign-specific direction yet.",
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
    status: "ready",
    version: 1,
    createdAt: new Date().toISOString(),
    factsRef: {
      extractedAt: facts.extractedAt,
      fields: listPopulatedFactsFields(facts),
    },
    strategyContext: context,
    campaignUnderstandingRef: context?.campaignUnderstandingRef,
    readiness: context?.readiness,
    scopedRecommendations: context?.scopedRequirements,
    decisionBasis: {
      objective: { origin: facts.objective ? "SOURCE_STATED" : "LEGACY_UNVERIFIED", confidence: facts.confidence.objective, factIds: context?.coreFacts.filter((fact) => fact.concept === "campaign_objective").map((fact) => fact.id) ?? [] },
      audience: { origin: facts.audience ? "SOURCE_STATED" : "LEGACY_UNVERIFIED", confidence: facts.confidence.audience, factIds: context?.coreFacts.filter((fact) => fact.concept === "audience").map((fact) => fact.id) ?? [] },
    },
    understanding: {
      client: facts.clientName,
      brand,
      industry: facts.industry ?? profile.label,
      objective,
      budget: budgetTotal
        ? { amount: budgetTotal, currency, rationale: budgetRationale }
        : { currency, rationale: budgetRationale },
      timeline:
        durationWeeks != null
          ? { durationWeeks, rationale: timelineRationale }
          : undefined,
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
