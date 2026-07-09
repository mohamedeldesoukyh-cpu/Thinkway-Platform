import type { CampaignFacts } from "./campaign-facts-types";

/** Compact JSON block for Director/specialist prompt injection — primary factual SSOT. */
export function formatCampaignFactsForSpecialist(facts: CampaignFacts): string {
  const payload = {
    _authority: "CAMPAIGN_FACTS_SSOT",
    _instruction:
      "Use ONLY these structured facts for budget, duration, currency, client, brand, geography, platforms, KPIs, and campaign type. Do NOT infer factual values from the raw brief.",
    extractedAt: facts.extractedAt,
    clientName: facts.clientName,
    brandName: facts.brandName,
    industry: facts.industry,
    campaignType: facts.campaignType,
    objective: facts.objective,
    budget: facts.budget,
    durationWeeks: facts.durationWeeks,
    geography: facts.geography,
    audience: facts.audience,
    platforms: facts.platforms,
    kpis: facts.kpis,
    constraints: facts.constraints,
    risks: facts.risks,
    confidence: facts.confidence,
    sources: facts.sources,
  };

  return [
    "=== CAMPAIGN FACTS (Structured SSOT — authoritative for all factual claims) ===",
    JSON.stringify(payload, null, 2),
  ].join("\n");
}

/** Field keys present in validated facts — for strategy document cross-reference. */
export function listPopulatedFactsFields(facts: CampaignFacts): string[] {
  const fields: string[] = [];
  if (facts.clientName) fields.push("clientName");
  if (facts.brandName) fields.push("brandName");
  if (facts.industry) fields.push("industry");
  if (facts.campaignType) fields.push("campaignType");
  if (facts.objective) fields.push("objective");
  if (facts.budget) fields.push("budget");
  if (facts.durationWeeks !== undefined) fields.push("durationWeeks");
  if (facts.geography?.length) fields.push("geography");
  if (facts.audience) fields.push("audience");
  if (facts.platforms?.length) fields.push("platforms");
  if (facts.kpis?.length) fields.push("kpis");
  if (facts.constraints?.length) fields.push("constraints");
  if (facts.risks?.length) fields.push("risks");
  return fields;
}
