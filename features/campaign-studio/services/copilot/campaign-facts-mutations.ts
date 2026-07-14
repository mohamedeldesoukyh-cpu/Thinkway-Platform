import type { CampaignObject } from "@/features/campaign-intelligence";
import type { SummarySectionData } from "@/features/campaign-intelligence/types/section-schemas";
import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import {
  applyFactsToSummaryData,
  getCampaignFacts,
} from "@/features/campaign-director/facts/facts-display-bridge";

import { clampCampaignDurationWeeks } from "../timeline-duration";

/** Facts fields the Copilot can edit conversationally. */
export type EditableFactsPatch = Partial<
  Pick<
    CampaignFacts,
    | "budget"
    | "durationWeeks"
    | "campaignStartDate"
    | "platforms"
    | "objective"
    | "audience"
    | "geography"
  >
>;

/** Parse DD/MM/YYYY, DD-MM-YYYY, or YYYY-MM-DD into ISO YYYY-MM-DD. */
export function parseCampaignStartDateInput(raw: string): string | null {
  const text = raw.trim();
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = text.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/);
  if (dmy) {
    const day = dmy[1]!.padStart(2, "0");
    const month = dmy[2]!.padStart(2, "0");
    const year = dmy[3]!;
    return `${year}-${month}-${day}`;
  }
  return null;
}

function formatCampaignStartDateLabel(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

/**
 * Mutate the campaign facts SSOT and refresh the stored summary cards from the
 * new facts. Budget total, currency, duration, waves, and creator mix all
 * re-derive from facts at read time (see resolveBudgetData / buildActivationWaves
 * / buildCreatorMixFromFacts), so the studio and exports update automatically.
 */
export function patchCampaignFacts(
  campaignObject: CampaignObject,
  patch: EditableFactsPatch
): CampaignObject {
  const facts = getCampaignFacts(campaignObject);
  if (!facts) return campaignObject;

  const nextFacts: CampaignFacts = { ...facts, ...patch };

  const summarySection = campaignObject.sections.summary;
  const summaryData = (summarySection.data ?? {}) as Record<string, unknown>;
  const currentCards = (summaryData.summaryCards ?? {}) as SummarySectionData;
  const nextCards = applyFactsToSummaryData(currentCards, nextFacts);

  return {
    ...campaignObject,
    sections: {
      ...campaignObject.sections,
      summary: {
        ...summarySection,
        data: { ...summaryData, summaryCards: nextCards },
      },
    },
    meta: { ...campaignObject.meta, campaignFacts: nextFacts },
    updatedAt: new Date().toISOString(),
  };
}

export type FactsEditResult = {
  campaignObject: CampaignObject;
  /** Human summary line, or null when the edit was a no-op / invalid. */
  change: string | null;
};

export function applyBudgetChange(
  campaignObject: CampaignObject,
  input: { amount: number; currency?: string }
): FactsEditResult {
  const facts = getCampaignFacts(campaignObject);
  if (!facts || !Number.isFinite(input.amount) || input.amount <= 0) {
    return { campaignObject, change: null };
  }
  const currency = input.currency?.trim() || facts.budget?.currency || "USD";
  const next = patchCampaignFacts(campaignObject, {
    budget: { amount: Math.round(input.amount), currency },
  });
  return {
    campaignObject: next,
    change: `Updated budget to ${Math.round(input.amount).toLocaleString()} ${currency}.`,
  };
}

export function applyTimelineChange(
  campaignObject: CampaignObject,
  input: { durationWeeks?: number; startDate?: string }
): FactsEditResult {
  const facts = getCampaignFacts(campaignObject);
  if (!facts) return { campaignObject, change: null };

  const patch: EditableFactsPatch = {};
  const changes: string[] = [];

  if (input.durationWeeks != null && Number.isFinite(input.durationWeeks)) {
    patch.durationWeeks = clampCampaignDurationWeeks(Math.round(input.durationWeeks));
    changes.push(
      `set campaign duration to ${patch.durationWeeks} week${patch.durationWeeks === 1 ? "" : "s"}`
    );
  }

  const startIso = input.startDate ? parseCampaignStartDateInput(input.startDate) : null;
  if (startIso) {
    patch.campaignStartDate = startIso;
    changes.push(`set campaign start date to ${formatCampaignStartDateLabel(startIso)}`);
  }

  if (changes.length === 0) return { campaignObject, change: null };

  const next = patchCampaignFacts(campaignObject, patch);
  return {
    campaignObject: next,
    change: `Updated ${changes.join(" and ")}.`,
  };
}

export function applyPlatformsChange(
  campaignObject: CampaignObject,
  input: { platforms: string[] }
): FactsEditResult {
  const platforms = (input.platforms ?? []).map((p) => p.trim()).filter(Boolean);
  if (!getCampaignFacts(campaignObject) || platforms.length === 0) {
    return { campaignObject, change: null };
  }
  const next = patchCampaignFacts(campaignObject, { platforms });
  const primary = platforms[0]!;
  return {
    campaignObject: next,
    change:
      platforms.length > 1
        ? `Set platform focus to ${platforms.join(", ")} (${primary} primary).`
        : `Set platform focus to ${primary}.`,
  };
}

export function applyObjectiveChange(
  campaignObject: CampaignObject,
  input: { objective: string }
): FactsEditResult {
  const objective = input.objective?.trim();
  if (!getCampaignFacts(campaignObject) || !objective) {
    return { campaignObject, change: null };
  }
  const next = patchCampaignFacts(campaignObject, { objective });
  return { campaignObject: next, change: "Updated the campaign objective." };
}

export function applyAudienceChange(
  campaignObject: CampaignObject,
  input: { audience: string }
): FactsEditResult {
  const audience = input.audience?.trim();
  if (!getCampaignFacts(campaignObject) || !audience) {
    return { campaignObject, change: null };
  }
  const next = patchCampaignFacts(campaignObject, { audience });
  return { campaignObject: next, change: `Updated the target audience to "${audience}".` };
}

export function applyGeographyChange(
  campaignObject: CampaignObject,
  input: { geography: string[] }
): FactsEditResult {
  const geography = (input.geography ?? []).map((g) => g.trim()).filter(Boolean);
  if (!getCampaignFacts(campaignObject) || geography.length === 0) {
    return { campaignObject, change: null };
  }
  const next = patchCampaignFacts(campaignObject, { geography });
  return { campaignObject: next, change: `Updated the market to ${geography.join(", ")}.` };
}
