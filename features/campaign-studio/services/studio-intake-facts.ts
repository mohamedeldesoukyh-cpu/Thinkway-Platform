import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import { applyConfirmedCampaignFactsToCampaignObject } from "@/features/campaign-intelligence-profile/services/campaign-facts-spine";

import { patchCampaignFacts } from "./copilot/campaign-facts-mutations";

export type IntakeFactState = "confirmed" | "missing";

export type IntakeFactRow = {
  key: string;
  label: string;
  value: string | null;
  state: IntakeFactState;
  required: boolean;
};

export type IntakeFactsView = {
  rows: IntakeFactRow[];
  missing: IntakeFactRow[];
  canConfirm: boolean;
};

function present(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function formatDurationWeeks(weeks: number | undefined): string | null {
  if (weeks == null || !Number.isFinite(weeks) || weeks <= 0) return null;
  const rounded = Math.round(weeks);
  if (rounded === 4) return "1 month / 4 weeks";
  if (rounded % 4 === 0) {
    const months = rounded / 4;
    return `${months} month${months === 1 ? "" : "s"} / ${rounded} weeks`;
  }
  return `${rounded} week${rounded === 1 ? "" : "s"}`;
}

function formatBudget(facts: CampaignFacts | undefined): string | null {
  const amount = facts?.budget?.amount;
  const currency = facts?.budget?.currency?.trim();
  if (amount == null || !Number.isFinite(amount) || amount <= 0 || !currency) {
    return null;
  }
  return `${currency} ${Math.round(amount).toLocaleString("en-US")}`;
}

function joinList(values: string[] | undefined): string | null {
  const cleaned = (values ?? []).map((value) => value.trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned.join(", ") : null;
}

function row(
  key: string,
  label: string,
  value: string | null,
  required: boolean
): IntakeFactRow {
  return {
    key,
    label,
    value,
    state: value ? "confirmed" : "missing",
    required,
  };
}

function inventedAudience(value: string | null | undefined): boolean {
  return /brand-relevant consumers/i.test(value ?? "");
}

function presentAudience(facts: CampaignFacts | undefined): string | null {
  const source = facts?.sources?.audience;
  if (source === "inferred" || source === "default") return null;
  if (inventedAudience(facts?.audience)) return null;
  return present(facts?.audience);
}

function presentPlatforms(facts: CampaignFacts | undefined): string | null {
  const source = facts?.sources?.platforms;
  if (source === "inferred" || source === "default") return null;
  return joinList(facts?.platforms);
}

/**
 * "What Thinkway understood" — Campaign Facts only. Never invent missing values.
 */
export function requiredIntakeFacts(facts: CampaignFacts | undefined): IntakeFactsView {
  const rows: IntakeFactRow[] = [
    row("client", "Client", present(facts?.clientName), true),
    row("campaign", "Campaign", present(facts?.product), true),
    row("brand", "Brand", present(facts?.brandName) ?? present(facts?.clientName), true),
    row("country", "Country", joinList(facts?.geography), true),
    row("budget", "Budget", formatBudget(facts), true),
    row("duration", "Duration", formatDurationWeeks(facts?.durationWeeks), true),
    row("objective", "Objective", present(facts?.objective), true),
    row("audience", "Audience", presentAudience(facts), false),
    row("category", "Category", present(facts?.industry) ?? present(facts?.campaignType), false),
    row(
      "creatorCategories",
      "Creator categories",
      present(facts?.industry) ?? present(facts?.campaignType),
      false
    ),
    row("platforms", "Platforms", presentPlatforms(facts), false),
    row("deliverables", "Deliverables", joinList(facts?.deliverables), false),
    row("kpis", "Success measurement / KPIs", joinList(facts?.kpis), false),
  ];

  const missing = rows.filter((item) => item.required && item.state === "missing");
  return {
    rows,
    missing,
    canConfirm: missing.length === 0,
  };
}

export function confirmStudioIntakeOnCampaignObject(
  campaignObject: CampaignObject,
  facts?: CampaignFacts
): CampaignObject {
  const nextFacts = facts ?? getCampaignFacts(campaignObject);
  if (!nextFacts) return campaignObject;

  const withFacts = facts
    ? applyConfirmedCampaignFactsToCampaignObject(campaignObject, facts)
    : campaignObject;

  return {
    ...withFacts,
    meta: {
      ...withFacts.meta,
      factsConfirmedAt: new Date().toISOString(),
      clarificationQuestion: undefined,
    },
    updatedAt: new Date().toISOString(),
  };
}

/** Hide stale copilot questions that the operator already answered on Intake. */
export function shouldShowIntakeClarification(
  question: string | undefined,
  facts: CampaignFacts | undefined
): boolean {
  const text = question?.trim();
  if (!text) return false;
  if (/budget/i.test(text) && facts?.budget?.amount && facts.budget.amount > 0) {
    return false;
  }
  if (/(country|market|geograph)/i.test(text) && (facts?.geography?.length ?? 0) > 0) {
    return false;
  }
  return true;
}

function presentValue<T>(value: T | undefined | null): T | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return value.trim() ? value : undefined;
  if (Array.isArray(value)) return value.length > 0 ? value : undefined;
  return value;
}

/**
 * Show extracted CIP beside Campaign Facts without inventing values.
 * Confirmed object facts win when present; CIP fills empty slots.
 */
export function mergeIntakeDisplayFacts(
  objectFacts?: CampaignFacts,
  cipFacts?: CampaignFacts
): CampaignFacts | undefined {
  if (!objectFacts && !cipFacts) return undefined;
  if (!objectFacts) return cipFacts;
  if (!cipFacts) return objectFacts;

  const pick = <T>(fromObject: T | undefined, fromCip: T | undefined): T | undefined =>
    presentValue(fromObject) ?? presentValue(fromCip);

  return {
    ...cipFacts,
    ...objectFacts,
    clientName: pick(objectFacts.clientName, cipFacts.clientName),
    brandName: pick(objectFacts.brandName, cipFacts.brandName),
    product: pick(objectFacts.product, cipFacts.product),
    industry: pick(objectFacts.industry, cipFacts.industry),
    campaignType: pick(objectFacts.campaignType, cipFacts.campaignType),
    objective: pick(objectFacts.objective, cipFacts.objective),
    audience: pick(objectFacts.audience, cipFacts.audience),
    geography: pick(objectFacts.geography, cipFacts.geography),
    platforms: pick(objectFacts.platforms, cipFacts.platforms),
    deliverables: pick(objectFacts.deliverables, cipFacts.deliverables),
    kpis: pick(objectFacts.kpis, cipFacts.kpis),
    budget: objectFacts.budget?.amount ? objectFacts.budget : cipFacts.budget,
    durationWeeks: objectFacts.durationWeeks ?? cipFacts.durationWeeks,
    rawBriefExcerpt: pick(objectFacts.rawBriefExcerpt, cipFacts.rawBriefExcerpt),
    extractedAt: objectFacts.extractedAt ?? cipFacts.extractedAt,
    confidence: { ...cipFacts.confidence, ...objectFacts.confidence },
    sources: { ...cipFacts.sources, ...objectFacts.sources },
  };
}

export function campaignFactsFromIntakeEdit(
  edit: IntakeFactsEdit,
  base?: CampaignFacts
): CampaignFacts {
  const amount = edit.budgetAmount;
  const currency = edit.budgetCurrency?.trim();
  return {
    extractedAt: base?.extractedAt ?? new Date().toISOString(),
    confidence: { ...(base?.confidence ?? {}) },
    sources: { ...(base?.sources ?? {}) },
    clientName: edit.clientName?.trim() || base?.clientName,
    brandName: edit.brandName?.trim() || base?.brandName,
    product: edit.product?.trim() || base?.product,
    industry: edit.industry?.trim() || base?.industry,
    objective: edit.objective?.trim() || base?.objective,
    audience: edit.audience?.trim() || base?.audience,
    geography: edit.geography?.filter((value) => value.trim()) ?? base?.geography,
    platforms: edit.platforms?.filter((value) => value.trim()) ?? base?.platforms,
    deliverables: edit.deliverables?.filter((value) => value.trim()) ?? base?.deliverables,
    kpis: edit.kpis?.filter((value) => value.trim()) ?? base?.kpis,
    durationWeeks:
      edit.durationWeeks != null && Number.isFinite(edit.durationWeeks) && edit.durationWeeks > 0
        ? Math.round(edit.durationWeeks)
        : base?.durationWeeks,
    budget:
      amount != null && Number.isFinite(amount) && amount > 0 && currency
        ? { amount: Math.round(amount), currency }
        : base?.budget,
    rawBriefExcerpt: base?.rawBriefExcerpt,
  };
}

export function applyIntakeEditToProfile(
  profile: import("@/features/campaign-intelligence-profile/types/profile").CampaignIntelligenceProfile,
  edit: IntakeFactsEdit
): import("@/features/campaign-intelligence-profile/types/profile").CampaignIntelligenceProfile {
  const clientName = edit.clientName?.trim() || profile.clientName;
  const brandName = edit.brandName?.trim() || profile.brandName;
  const campaignName = edit.product?.trim() || profile.campaignName;
  const objective = edit.objective?.trim() || profile.objective;
  const audience = edit.audience?.trim() || profile.audience;
  const industry = edit.industry?.trim() || profile.industry;
  const geography =
    edit.geography && edit.geography.some((value) => value.trim())
      ? edit.geography.map((value) => value.trim()).filter(Boolean)
      : profile.geography;
  const platforms =
    edit.platforms && edit.platforms.some((value) => value.trim())
      ? edit.platforms.map((value) => value.trim()).filter(Boolean)
      : profile.platforms;
  const deliverables =
    edit.deliverables && edit.deliverables.some((value) => value.trim())
      ? edit.deliverables.map((value) => value.trim()).filter(Boolean)
      : profile.deliverables;
  const kpis =
    edit.kpis && edit.kpis.some((value) => value.trim())
      ? edit.kpis.map((value) => value.trim()).filter(Boolean)
      : profile.kpis;
  const durationWeeks =
    edit.durationWeeks != null && Number.isFinite(edit.durationWeeks) && edit.durationWeeks > 0
      ? Math.round(edit.durationWeeks)
      : profile.durationWeeks;
  const budget =
    edit.budgetAmount != null && Number.isFinite(edit.budgetAmount) && edit.budgetAmount > 0
      ? {
          amount: Math.round(edit.budgetAmount),
          currency: (edit.budgetCurrency ?? profile.budget?.currency ?? "EGP").trim(),
        }
      : profile.budget;

  return {
    ...profile,
    clientName,
    brandName,
    campaignName,
    products: campaignName ? [campaignName] : profile.products,
    industry,
    objective,
    objectives: objective ? [objective] : profile.objectives,
    audience,
    geography,
    market: geography?.[0] ?? profile.market,
    platforms,
    deliverables,
    kpis,
    durationWeeks,
    budget,
  };
}

export type IntakeFactsEdit = {
  clientName?: string;
  brandName?: string;
  product?: string;
  industry?: string;
  objective?: string;
  audience?: string;
  geography?: string[];
  platforms?: string[];
  deliverables?: string[];
  kpis?: string[];
  budgetAmount?: number;
  budgetCurrency?: string;
  durationWeeks?: number;
};

export function applyIntakeFactsEdit(
  campaignObject: CampaignObject,
  edit: IntakeFactsEdit
): CampaignObject {
  const facts = getCampaignFacts(campaignObject);
  if (!facts) return campaignObject;

  const geography = edit.geography?.map((value) => value.trim()).filter(Boolean);
  const platforms = edit.platforms?.map((value) => value.trim()).filter(Boolean);
  const deliverables = edit.deliverables?.map((value) => value.trim()).filter(Boolean);
  const kpis = edit.kpis?.map((value) => value.trim()).filter(Boolean);

  return patchCampaignFacts(campaignObject, {
    ...(edit.clientName !== undefined ? { clientName: edit.clientName.trim() || undefined } : {}),
    ...(edit.brandName !== undefined ? { brandName: edit.brandName.trim() || undefined } : {}),
    ...(edit.product !== undefined ? { product: edit.product.trim() || undefined } : {}),
    ...(edit.industry !== undefined ? { industry: edit.industry.trim() || undefined } : {}),
    ...(edit.objective !== undefined ? { objective: edit.objective.trim() || undefined } : {}),
    ...(edit.audience !== undefined ? { audience: edit.audience.trim() || undefined } : {}),
    ...(geography ? { geography } : {}),
    ...(platforms ? { platforms } : {}),
    ...(deliverables ? { deliverables } : {}),
    ...(kpis ? { kpis } : {}),
    ...(edit.durationWeeks != null && Number.isFinite(edit.durationWeeks)
      ? { durationWeeks: Math.round(edit.durationWeeks) }
      : {}),
    ...(edit.budgetAmount != null && Number.isFinite(edit.budgetAmount) && edit.budgetAmount > 0
      ? {
          budget: {
            amount: Math.round(edit.budgetAmount),
            currency: (edit.budgetCurrency ?? facts.budget?.currency ?? "EGP").trim(),
          },
        }
      : {}),
  });
}
