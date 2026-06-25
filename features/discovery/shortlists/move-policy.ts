import type { ShortlistStatus } from "@/types/database";

import { canMoveToCampaign } from "./transitions";

/**
 * Canonical error message for the approval gate (spec §5/§7, review item 2).
 * Every move-to-campaign entry point MUST call {@link assertShortlistApprovedForMove}.
 */
export const SHORTLIST_NOT_APPROVED_MESSAGE =
  "Shortlist must be approved before campaign movement";

/**
 * Shared, reusable approval guard. Throws the canonical message when the
 * shortlist is not Approved. Called by UI guards, server actions, API routes and
 * any service-role helper that moves creators to a campaign — never UI-only.
 */
export function assertShortlistApprovedForMove(status: ShortlistStatus): void {
  if (status !== "approved") {
    throw new Error(SHORTLIST_NOT_APPROVED_MESSAGE);
  }
}

export type MoveTarget =
  | { mode: "existing"; campaignId: string; campaignName: string }
  | {
      mode: "new";
      name: string;
      brandId: string;
      country?: string | null;
      startDate?: string | null;
      endDate?: string | null;
      budget?: number | null;
    };

export type MoveValidationInput = {
  status: ShortlistStatus;
  selectedItemIds: string[];
  target: MoveTarget;
};

export type MoveValidationResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Pure pre-flight validation for Move To Campaign (spec §5, §7, §9).
 * Enforces: approved-only, at least one selected creator, and required target fields.
 */
export function validateMoveToCampaign(
  input: MoveValidationInput
): MoveValidationResult {
  if (!canMoveToCampaign(input.status)) {
    return {
      ok: false,
      message:
        "Only Approved shortlists can move creators to a campaign. Submit for review and approve first.",
    };
  }

  if (!input.selectedItemIds || input.selectedItemIds.length === 0) {
    return { ok: false, message: "Select at least one creator to move." };
  }

  if (input.target.mode === "existing") {
    if (!input.target.campaignId) {
      return { ok: false, message: "Select a campaign to move creators into." };
    }
    return { ok: true };
  }

  if (!input.target.name?.trim()) {
    return { ok: false, message: "Campaign name is required." };
  }
  if (!input.target.brandId) {
    return { ok: false, message: "Select a brand for the new campaign." };
  }
  return { ok: true };
}

/**
 * Spec §8: when moving into an EXISTING campaign whose name differs from the
 * shortlist name, the user must confirm that campaign naming rules win and the
 * shortlist name will NOT replace the campaign name.
 */
export function shouldWarnNameMismatch(
  shortlistName: string,
  campaignName: string
): boolean {
  return (
    normalizeName(shortlistName) !== normalizeName(campaignName)
  );
}

export function buildNameMismatchWarning(campaignDocumentNumber: string): string {
  return (
    `Selected creators will be moved to campaign ${campaignDocumentNumber}. ` +
    "Campaign naming rules will apply and the shortlist name will not replace the " +
    "campaign name. Do you want to continue?"
  );
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
