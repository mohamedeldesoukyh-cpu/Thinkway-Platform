/**
 * Fill MISSING campaign facts from a follow-up user message — used when a
 * governance pause asked for business information (budget, brand, objective,
 * audience) and the workflow resumes with the user's answer appended to the
 * original brief. Existing facts are never overwritten: the SSOT stays stable
 * and only gaps the user was explicitly asked about get filled.
 */
import type { CampaignFacts, CampaignFactsField } from "./campaign-facts-types";
import { extractCampaignFacts } from "./extract-campaign-facts";
import { validateCampaignFacts } from "./validate-campaign-facts";

export type MergeMissingFactsResult = {
  facts: CampaignFacts;
  filledFields: CampaignFactsField[];
};

export function mergeMissingCampaignFacts(
  existing: CampaignFacts,
  message: string
): MergeMissingFactsResult {
  const fresh = validateCampaignFacts(
    extractCampaignFacts({
      rawMessage: message,
      brandName: existing.brandName,
      clientName: existing.clientName,
    })
  );

  const facts: CampaignFacts = {
    ...existing,
    confidence: { ...existing.confidence },
    sources: { ...existing.sources },
  };
  const filledFields: CampaignFactsField[] = [];
  const markFilled = (field: CampaignFactsField) => {
    facts.confidence[field] = fresh.confidence[field];
    facts.sources[field] = fresh.sources[field];
    filledFields.push(field);
  };

  if (!existing.budget?.amount && fresh.budget?.amount) {
    facts.budget = fresh.budget;
    markFilled("budget");
  }
  if (!existing.brandName?.trim() && fresh.brandName?.trim()) {
    facts.brandName = fresh.brandName;
    markFilled("brandName");
  }
  if (!existing.clientName?.trim() && fresh.clientName?.trim()) {
    facts.clientName = fresh.clientName;
    markFilled("clientName");
  }
  if (!existing.objective?.trim() && fresh.objective?.trim()) {
    facts.objective = fresh.objective;
    markFilled("objective");
  }
  if (existing.durationWeeks == null && fresh.durationWeeks != null) {
    facts.durationWeeks = fresh.durationWeeks;
    markFilled("durationWeeks");
  }
  if ((existing.geography?.length ?? 0) === 0 && (fresh.geography?.length ?? 0) > 0) {
    facts.geography = fresh.geography;
    markFilled("geography");
  }
  if (!existing.audience?.trim() && fresh.audience?.trim()) {
    facts.audience = fresh.audience;
    markFilled("audience");
  }
  if ((existing.platforms?.length ?? 0) === 0 && (fresh.platforms?.length ?? 0) > 0) {
    facts.platforms = fresh.platforms;
    markFilled("platforms");
  }
  if ((existing.kpis?.length ?? 0) === 0 && (fresh.kpis?.length ?? 0) > 0) {
    facts.kpis = fresh.kpis;
    markFilled("kpis");
  }

  return { facts, filledFields };
}
