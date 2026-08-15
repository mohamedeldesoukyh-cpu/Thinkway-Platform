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

function formatDurationWeeks(weeks: number | undefined): string | null {
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
    row("audience", "Audience", present(facts?.audience), false),
    row("category", "Category", present(facts?.industry) ?? present(facts?.campaignType), false),
    row(
      "creatorCategories",
      "Creator categories",
      present(facts?.industry) ?? present(facts?.campaignType),
      false
    ),
    row("platforms", "Platforms", joinList(facts?.platforms), false),
    row("deliverables", "Deliverables", joinList(facts?.deliverables), false),
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
    },
    updatedAt: new Date().toISOString(),
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
