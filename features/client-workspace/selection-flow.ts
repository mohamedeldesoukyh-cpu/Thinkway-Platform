import type { ClientCreatorSelectionState, ClientReviewSource } from "./constants";
import { isSelectedForCalculator } from "./status";
import type {
  ClientReviewSourceSnapshot,
  ClientReviewSourceSnapshotCreator,
} from "./types";

export const CLIENT_THINKWAY_STATUSES = [
  "not_reviewed",
  "recommended",
  "approved",
  "finalized",
] as const;
export type ClientThinkwayStatus = (typeof CLIENT_THINKWAY_STATUSES)[number];

export const CLIENT_SELECTION_STATUS_LABEL: Record<ClientCreatorSelectionState, string> = {
  in_review: "Not selected",
  accepted: "Selected",
  rejected: "Not selected",
};

export const THINKWAY_STATUS_LABEL: Record<ClientThinkwayStatus, string> = {
  not_reviewed: "",
  recommended: "Recommended by Thinkway",
  approved: "Thinkway Approved",
  finalized: "Thinkway Approved",
};

export const APPROVE_SELECTED_CREATORS_LABEL = "Approve Selected Creators";
/** Same freeze engine as Approve Selected Creators — not quotation approval. */
export const CONFIRM_CREATORS_LABEL = APPROVE_SELECTED_CREATORS_LABEL;
export const CONFIRM_CREATORS_SUPPORTING_TEXT =
  "Approve the creators you want included in the current quotation. This is not final quotation approval.";
export const APPROVE_FINAL_QUOTATION_LABEL = "Approve Final Quotation";
/** Header CTA only — navigates to Your Selection. Never freezes or approves. */
export const REVIEW_YOUR_SELECTION_LABEL = "Review Your Selection";
export const ADD_FROM_SHORTLIST_LABEL = "Add from Shortlist";
export const REMOVE_FROM_SELECTION_LABEL = "Remove";
/** After Approve Selected Creators, open Commercial. */
export const AFTER_CREATOR_APPROVAL_SECTION = "commercial" as const;
export const UNPRICED_APPROVAL_MESSAGE = "Your selection includes creators without confirmed pricing.";
export const UNPRICED_INCLUDED_MESSAGE =
  "Only creators with confirmed pricing will be included in the current quotation. Creators without confirmed pricing will remain in your selection and can be quoted later once pricing is available.";
export const UNPRICED_SELECTED_CODE = "unpriced_selected";
export const PRICE_PENDING_LABEL = "Pricing required";
export const PRICE_NOT_AVAILABLE_LABEL = "Pricing required";
export const CLIENT_APPROVED_LABEL = "Client Approved";

export type ClientSelectionFreeze = {
  confirmedAt: string;
  creatorIds: string[];
};

export type SelectionCalculator = {
  selectedCount: number;
  pricedSelectedCount: number;
  unpricedSelectedCount: number;
  /** Client-facing creator/service cost (quotation revenue), priced selected only. */
  pricedInvestment: number;
  agencyFees: number;
  totalInvestment: number;
  unpricedMessage: string | null;
};

export type ConsolidationContract = {
  eligible: boolean;
  approvedQuotationCount: number;
  actionLabel: string;
  helper: string;
};

const FORBIDDEN_CLIENT_KEYS = /\b(cost|vendorCost|vendor_cost|gp|grossProfit|gross_profit|margin|internalNote|internal_note)\b/i;

export function thinkwayStatusFromInternal(
  itemStatus: string | null | undefined
): ClientThinkwayStatus {
  if (itemStatus === "moved_to_campaign") return "finalized";
  if (itemStatus === "approved") return "approved";
  if (itemStatus === "under_review") return "recommended";
  return "not_reviewed";
}

export function parseThinkwayStatus(value: unknown): ClientThinkwayStatus | undefined {
  if (value === "not_reviewed" || value === "recommended" || value === "approved" || value === "finalized") {
    return value;
  }
  return undefined;
}

export function isPricedClientInvestment(amount: number | null | undefined): boolean {
  return amount != null && Number.isFinite(amount) && amount > 0;
}

export function thinkwayStatusLabel(status: ClientThinkwayStatus | undefined): string {
  if (!status) return "";
  return THINKWAY_STATUS_LABEL[status];
}

export function clientStatusDisplay(input: {
  selection: ClientCreatorSelectionState;
  selectionConfirmed: boolean;
  commerciallyApproved: boolean;
}): string {
  if (input.selection !== "accepted") return CLIENT_SELECTION_STATUS_LABEL[input.selection];
  if (input.commerciallyApproved) return "Commercially approved";
  if (input.selectionConfirmed) return CLIENT_APPROVED_LABEL;
  return CLIENT_SELECTION_STATUS_LABEL.accepted;
}

export function investmentDisplayLabel(amount: number | null | undefined): string {
  if (!isPricedClientInvestment(amount)) return PRICE_PENDING_LABEL;
  return "";
}

export function parseClientSelectionFreeze(value: unknown): ClientSelectionFreeze | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const row = value as Record<string, unknown>;
  const confirmedAt = typeof row.confirmedAt === "string" && row.confirmedAt.trim() ? row.confirmedAt : "";
  const creatorIds = Array.isArray(row.creatorIds)
    ? row.creatorIds.filter((id): id is string => typeof id === "string" && Boolean(id.trim()))
    : [];
  if (!confirmedAt || creatorIds.length === 0) return undefined;
  return { confirmedAt, creatorIds };
}

export function isSelectionConfirmed(
  snapshot: Pick<ClientReviewSourceSnapshot, "clientSelection"> | null | undefined
): boolean {
  return Boolean(snapshot?.clientSelection?.confirmedAt && snapshot.clientSelection.creatorIds.length > 0);
}

export function withClientSelectionFreeze(
  snapshot: ClientReviewSourceSnapshot,
  freeze: ClientSelectionFreeze
): ClientReviewSourceSnapshot {
  return { ...snapshot, clientSelection: freeze };
}

export function selectionCalculator(
  creators: Array<{ creatorId: string; investmentAmount?: number; agencyFeeAmount?: number }>,
  selection: Record<string, ClientCreatorSelectionState>
): SelectionCalculator {
  const selected = creators.filter((creator) => isSelectedForCalculator(selection[creator.creatorId]));
  const priced = selected.filter((creator) => isPricedClientInvestment(creator.investmentAmount));
  const unpricedSelectedCount = selected.length - priced.length;
  const pricedInvestment = priced.reduce((sum, creator) => sum + (creator.investmentAmount ?? 0), 0);
  const agencyFees = priced.reduce((sum, creator) => sum + (Number(creator.agencyFeeAmount) || 0), 0);
  return {
    selectedCount: selected.length,
    pricedSelectedCount: priced.length,
    unpricedSelectedCount,
    pricedInvestment,
    agencyFees,
    totalInvestment: pricedInvestment + agencyFees,
    unpricedMessage: unpricedSelectedCount > 0 ? UNPRICED_INCLUDED_MESSAGE : null,
  };
}

function overlayKeys(
  creator: Pick<
    ClientReviewSourceSnapshotCreator,
    "creatorId" | "influencerId" | "handle" | "shortlistItemId" | "profileId" | "unifiedId"
  >
): string[] {
  const keys: string[] = [];
  const push = (value?: string, prefix?: string) => {
    const trimmed = value?.trim();
    if (!trimmed) return;
    keys.push(trimmed);
    if (prefix) keys.push(`${prefix}${trimmed}`);
  };
  push(creator.creatorId);
  push(creator.unifiedId);
  push(creator.shortlistItemId, "sl:");
  push(creator.influencerId, "inf:");
  push(creator.profileId, "dis:");
  const handle = creator.handle?.replace(/^@/, "").trim().toLowerCase();
  if (handle) keys.push(`h:${handle}`);
  return [...new Set(keys.filter(Boolean))];
}

function indexCreators(
  creators: ClientReviewSourceSnapshotCreator[]
): Map<string, ClientReviewSourceSnapshotCreator> {
  const index = new Map<string, ClientReviewSourceSnapshotCreator>();
  for (const creator of creators) {
    for (const key of overlayKeys(creator)) {
      if (!index.has(key)) index.set(key, creator);
    }
  }
  return index;
}

function findOverlayMatch(
  creator: ClientReviewSourceSnapshotCreator,
  index: Map<string, ClientReviewSourceSnapshotCreator>
): ClientReviewSourceSnapshotCreator | undefined {
  for (const key of overlayKeys(creator)) {
    const match = index.get(key);
    if (match) return match;
  }
  return undefined;
}

export function applyQuotationCurrency(
  creator: ClientReviewSourceSnapshotCreator,
  currency: string | undefined
): ClientReviewSourceSnapshotCreator {
  if (!currency?.trim()) return creator;
  return { ...creator, investmentCurrency: currency };
}

function overlayQuotedCreator(
  creator: ClientReviewSourceSnapshotCreator,
  quoted: ClientReviewSourceSnapshotCreator,
  currency: string | undefined
): ClientReviewSourceSnapshotCreator {
  const deliverables = quoted.deliverables?.trim() || undefined;
  const deliverableItems = quoted.deliverableItems?.length ? quoted.deliverableItems : undefined;
  return applyQuotationCurrency(
    {
      ...creator,
      quotationEligible: true,
      deliverables,
      deliverableItems,
      serviceDescription: quoted.serviceDescription?.trim() || undefined,
      investmentAmount: isPricedClientInvestment(quoted.investmentAmount)
        ? quoted.investmentAmount
        : undefined,
      agencyFeeAmount: isPricedClientInvestment(quoted.investmentAmount)
        ? quoted.agencyFeeAmount ?? 0
        : undefined,
      originalInvestmentAmount: quoted.originalInvestmentAmount,
      originalInvestmentCurrency: quoted.originalInvestmentCurrency,
      thinkwayStatus: quoted.thinkwayStatus ?? creator.thinkwayStatus,
      shortlistItemId: quoted.shortlistItemId ?? creator.shortlistItemId,
      profileId: quoted.profileId ?? creator.profileId,
      unifiedId: quoted.unifiedId ?? creator.unifiedId,
      influencerId: quoted.influencerId ?? creator.influencerId,
    },
    currency || quoted.investmentCurrency
  );
}

/** Keep the shortlist pool; layer quotation client-facing price/deliverables onto matching cards. */
export function overlayQuotationOnShortlistCreators(
  shortlist: ClientReviewSourceSnapshotCreator[],
  quotation: ClientReviewSourceSnapshotCreator[] | undefined,
  options?: { currency?: string }
): ClientReviewSourceSnapshotCreator[] {
  const quoteIndex = indexCreators(quotation ?? []);
  const usedQuoteIds = new Set<string>();
  const currency = options?.currency;
  const merged = shortlist.map((creator) => {
    const quoted = findOverlayMatch(creator, quoteIndex);
    if (!quoted) {
      return applyQuotationCurrency(
        {
          ...creator,
          quotationEligible: false,
          investmentAmount: undefined,
          agencyFeeAmount: undefined,
          originalInvestmentAmount: undefined,
          originalInvestmentCurrency: undefined,
          serviceDescription: undefined,
        },
        currency
      );
    }
    usedQuoteIds.add(quoted.creatorId);
    return overlayQuotedCreator(creator, quoted, currency);
  });
  const extras = (quotation ?? []).filter((creator) => !usedQuoteIds.has(creator.creatorId));
  return [
    ...merged,
    ...extras.map((creator) =>
      applyQuotationCurrency(
        {
          ...creator,
          quotationEligible: true,
          investmentAmount: isPricedClientInvestment(creator.investmentAmount)
            ? creator.investmentAmount
            : undefined,
          agencyFeeAmount: isPricedClientInvestment(creator.investmentAmount)
            ? creator.agencyFeeAmount ?? 0
            : undefined,
        },
        currency || creator.investmentCurrency
      )
    ),
  ];
}

export function mergeSnapshotsForClientView(input: {
  active: ClientReviewSourceSnapshot;
  shortlist?: ClientReviewSourceSnapshot | null;
  quotation?: ClientReviewSourceSnapshot | null;
  historical: boolean;
}): ClientReviewSourceSnapshot {
  if (input.historical) return input.active;
  const shortlistCreators = input.shortlist?.creators ?? [];
  const quotationCreators =
    input.quotation?.creators ??
    (input.active.source === "quotation" ? input.active.creators : []);
  const quotationSnap = input.quotation ?? (input.active.source === "quotation" ? input.active : null);
  const currency = quotationSnap?.commercial.currency || input.active.commercial.currency;
  if (shortlistCreators.length === 0) {
    return {
      ...input.active,
      creators: input.active.creators.map((creator) => applyQuotationCurrency(creator, currency)),
      commercial: { ...input.active.commercial, currency },
    };
  }
  const creators = overlayQuotationOnShortlistCreators(shortlistCreators, quotationCreators, { currency });
  return {
    ...input.active,
    creators,
    creatorIds: creators.map((creator) => creator.creatorId),
    commercial: { ...(quotationSnap?.commercial ?? input.active.commercial), currency },
    quotation: quotationSnap?.quotation ?? input.active.quotation,
    clientSelection:
      input.active.clientSelection ??
      quotationSnap?.clientSelection ??
      input.shortlist?.clientSelection,
  };
}

export function canConfirmCreators(input: {
  historical: boolean;
  interactive: boolean;
  selectedCount: number;
  selectionConfirmed: boolean;
}): boolean {
  return (
    !input.historical &&
    input.interactive &&
    input.selectedCount > 0 &&
    !input.selectionConfirmed
  );
}

export function canEnableApproveSelectedCreators(input: {
  historical: boolean;
  interactive: boolean;
  selectedCount: number;
  unpricedSelectedCount: number;
  selectionConfirmed: boolean;
}): boolean {
  void input.unpricedSelectedCount;
  return canConfirmCreators(input);
}

export function canApproveFinalQuotation(input: {
  historical: boolean;
  quotationInteractive: boolean;
  selectionConfirmed: boolean;
  selectedCount: number;
  unpricedSelectedCount: number;
}): boolean {
  const pricedSelectedCount = input.selectedCount - input.unpricedSelectedCount;
  return (
    !input.historical &&
    input.quotationInteractive &&
    input.selectionConfirmed &&
    pricedSelectedCount > 0
  );
}

export function confirmCreatorsDoesNotApproveQuotation(): {
  lockCommercial: false;
  setQuotationStatusApproved: false;
} {
  return { lockCommercial: false, setQuotationStatusApproved: false };
}

export function shortlistCreatorSelectEnabled(input: {
  canDecide: boolean;
  selectionConfirmed: boolean;
}): boolean {
  return input.canDecide && !input.selectionConfirmed;
}

export function canOpenCommercialWorkspace(input: {
  selectionConfirmed?: boolean;
  historical?: boolean;
  quotationStage?: string;
}): boolean {
  if (input.historical) return true;
  if (input.quotationStage === "approved") return true;
  return Boolean(input.selectionConfirmed);
}

export function selectionChangeAllowed(input: {
  selectionConfirmed: boolean;
  commerciallyApproved: boolean;
  current: ClientCreatorSelectionState;
  next: ClientCreatorSelectionState;
  priced: boolean;
}): { ok: boolean; message?: string } {
  if (input.commerciallyApproved) {
    return { ok: false, message: "This quotation is approved and can no longer be changed." };
  }
  if (!input.selectionConfirmed) return { ok: true };
  return {
    ok: false,
    message: "Your creator selection is confirmed. Request changes if you need to update it.",
  };
}

export function creatorsForClientCommercial<T extends { creatorId: string }>(
  creators: T[],
  selection: Record<string, ClientCreatorSelectionState>,
  approvedIds?: string[] | null
): T[] {
  if (approvedIds && approvedIds.length > 0) {
    const ids = new Set(approvedIds);
    return creators.filter((creator) => ids.has(creator.creatorId));
  }
  return creators.filter((creator) => isSelectedForCalculator(selection[creator.creatorId]));
}

export function unpricedSelectedIds(
  creators: Array<{ creatorId: string; investmentAmount?: number }>,
  selection: Record<string, ClientCreatorSelectionState>
): string[] {
  return creators
    .filter(
      (creator) =>
        isSelectedForCalculator(selection[creator.creatorId]) &&
        !isPricedClientInvestment(creator.investmentAmount)
    )
    .map((creator) => creator.creatorId);
}

export function excludeUnpricedFromSelection(
  creators: Array<{ creatorId: string; investmentAmount?: number }>,
  selection: Record<string, ClientCreatorSelectionState>
): Record<string, ClientCreatorSelectionState> {
  const next = { ...selection };
  for (const id of unpricedSelectedIds(creators, selection)) {
    next[id] = "in_review";
  }
  return next;
}

export function selectAllCreatorStates(
  creatorIds: string[]
): Record<string, ClientCreatorSelectionState> {
  return Object.fromEntries(creatorIds.map((id) => [id, "accepted" as const]));
}

export function clearCreatorSelectionStates(
  creatorIds: string[]
): Record<string, ClientCreatorSelectionState> {
  return Object.fromEntries(creatorIds.map((id) => [id, "in_review" as const]));
}

export type CreatorApprovalConfirmationRow = {
  creatorId: string;
  displayName: string;
  deliverables: string;
  price?: number;
};

export type CreatorApprovalConfirmation = {
  priced: CreatorApprovalConfirmationRow[];
  unpriced: CreatorApprovalConfirmationRow[];
  selectedCount: number;
  pricedCount: number;
  unpricedCount: number;
  clientCost: number;
  agencyFees: number;
  totalInvestment: number;
  helper: string;
};

export function buildCreatorApprovalConfirmation(
  creators: Array<{
    creatorId: string;
    displayName: string;
    deliverables?: string;
    investmentAmount?: number;
    agencyFeeAmount?: number;
  }>,
  selection: Record<string, ClientCreatorSelectionState>
): CreatorApprovalConfirmation {
  const calc = selectionCalculator(creators, selection);
  const selected = creators.filter((creator) => isSelectedForCalculator(selection[creator.creatorId]));
  const priced = selected
    .filter((creator) => isPricedClientInvestment(creator.investmentAmount))
    .map((creator) => ({
      creatorId: creator.creatorId,
      displayName: creator.displayName,
      deliverables: creator.deliverables?.trim() || "To be confirmed",
      price: creator.investmentAmount,
    }));
  const unpriced = selected
    .filter((creator) => !isPricedClientInvestment(creator.investmentAmount))
    .map((creator) => ({
      creatorId: creator.creatorId,
      displayName: creator.displayName,
      deliverables: creator.deliverables?.trim() || "To be confirmed",
    }));
  return {
    priced,
    unpriced,
    selectedCount: calc.selectedCount,
    pricedCount: calc.pricedSelectedCount,
    unpricedCount: calc.unpricedSelectedCount,
    clientCost: calc.pricedInvestment,
    agencyFees: calc.agencyFees,
    totalInvestment: calc.totalInvestment,
    helper: UNPRICED_INCLUDED_MESSAGE,
  };
}

export function consolidationContract(approvedQuotationCount: number): ConsolidationContract {
  return {
    eligible: approvedQuotationCount >= 2,
    approvedQuotationCount,
    actionLabel: "Consolidate selections",
    helper:
      "Creates a new quotation version from approved selections. Previous quotations remain historical. The consolidated quotation requires its own final client approval.",
  };
}

export function clientFacingObjectIsSafe(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return !FORBIDDEN_CLIENT_KEYS.test(value) && !/\b(ECI|Apify|DNA)\b/.test(value);
  if (typeof value !== "object") return true;
  if (Array.isArray(value)) return value.every((item) => clientFacingObjectIsSafe(item));
  return Object.entries(value as Record<string, unknown>).every(([key, nested]) => {
    if (FORBIDDEN_CLIENT_KEYS.test(key)) return false;
    return clientFacingObjectIsSafe(nested);
  });
}

export function primaryActionForJourney(input: {
  canConfirmCreators: boolean;
  canApproveFinalQuotation: boolean;
}): { label: string; kind: "confirm" | "approve" | null } {
  if (input.canApproveFinalQuotation) {
    return { label: APPROVE_FINAL_QUOTATION_LABEL, kind: "approve" };
  }
  if (input.canConfirmCreators) {
    return { label: CONFIRM_CREATORS_LABEL, kind: "confirm" };
  }
  return { label: "", kind: null };
}

/**
 * Shell header CTA. Navigation only — never writes clientSelection, never approves
 * creators, and never changes quotation status. Calculator remains the only
 * Approve Selected Creators action.
 */
export function headerSelectionNavigation(): {
  label: typeof REVIEW_YOUR_SELECTION_LABEL;
  section: "creators";
  writesClientSelection: false;
  freezesSelection: false;
  approvesCreators: false;
  approvesQuotation: false;
} {
  return {
    label: REVIEW_YOUR_SELECTION_LABEL,
    section: "creators",
    writesClientSelection: false,
    freezesSelection: false,
    approvesCreators: false,
    approvesQuotation: false,
  };
}

export function selectionStageCopy(input: {
  selectedCount: number;
  selectionConfirmed: boolean;
  commerciallyApproved: boolean;
}): { label: string; tone: "idle" | "active" | "attention" | "ok" } {
  if (input.commerciallyApproved) {
    return { label: "Commercially approved", tone: "ok" };
  }
  if (input.selectionConfirmed) {
    return { label: CLIENT_APPROVED_LABEL, tone: "ok" };
  }
  if (input.selectedCount > 0) {
    return { label: `${input.selectedCount} selected`, tone: "active" };
  }
  return { label: "Waiting for approval", tone: "idle" };
}

export function isValidClientCommercialApproval(input: {
  quotationStage: string;
  selectedCount: number;
}): boolean {
  return input.quotationStage === "approved" && input.selectedCount > 0;
}

export const INVALID_ZERO_SELECTION_APPROVAL_MESSAGE =
  "This quotation has no client-selected creators. Thinkway needs to send an updated quotation.";

export function commercialStageCopy(input: {
  quotationStage: string;
  selectedCount: number;
  pricedSelectedCount: number;
  pricedInvestment: number;
  currency: string;
  selectionConfirmed: boolean;
  hasAnyPrice: boolean;
}): { label: string; tone: "idle" | "active" | "attention" | "ok" | "bad" } {
  if (input.quotationStage === "approved") {
    if (input.selectedCount === 0) return { label: "Selection required", tone: "attention" };
    return { label: "Approved", tone: "ok" };
  }
  if (input.quotationStage === "updated") return { label: "Updated — Approval Required", tone: "attention" };
  if (input.quotationStage === "rejected") return { label: "Rejected", tone: "bad" };
  if (input.quotationStage === "superseded") return { label: "Historical / Superseded", tone: "idle" };
  if (input.selectionConfirmed) return { label: "Approval Required", tone: "attention" };
  if (input.hasAnyPrice) {
    if (input.pricedSelectedCount > 0 && input.pricedInvestment > 0) {
      return { label: "Pricing available", tone: "active" };
    }
    return { label: "Pricing available", tone: "active" };
  }
  return { label: "Not ready", tone: "idle" };
}

export function campaignStageCopy(input: {
  campaignStarted: boolean;
  commerciallyApproved: boolean;
}): { label: string; tone: "idle" | "active" | "ok" } {
  if (input.campaignStarted) return { label: "In campaign", tone: "ok" };
  if (input.commerciallyApproved) return { label: "Ready to start", tone: "active" };
  return { label: "Not started", tone: "idle" };
}

export function shortlistStageCopy(input: { available: boolean }): {
  label: string;
  tone: "idle" | "ok";
} {
  return input.available ? { label: "Available", tone: "ok" } : { label: "Not sent", tone: "idle" };
}

export type SelectionJourneyFlags = {
  selectionConfirmed: boolean;
  canConfirmCreators: boolean;
  canApproveFinalQuotation: boolean;
  approvedQuotationCount: number;
  clientApprovedCreatorIds?: string[];
};

export function selectionJourneyFlags(input: {
  historical: boolean;
  interactive: boolean;
  quotationInteractive: boolean;
  selectionConfirmed: boolean;
  selectedCount: number;
  unpricedSelectedCount: number;
  approvedQuotationCount: number;
  clientApprovedCreatorIds?: string[];
}): SelectionJourneyFlags {
  return {
    selectionConfirmed: input.selectionConfirmed,
    canConfirmCreators: canConfirmCreators(input),
    canApproveFinalQuotation: canApproveFinalQuotation({
      historical: input.historical,
      quotationInteractive: input.quotationInteractive,
      selectionConfirmed: input.selectionConfirmed,
      selectedCount: input.selectedCount,
      unpricedSelectedCount: input.unpricedSelectedCount,
    }),
    approvedQuotationCount: input.approvedQuotationCount,
    clientApprovedCreatorIds: input.clientApprovedCreatorIds,
  };
}

export function sourceForConfirm(source: ClientReviewSource): ClientReviewSource {
  return source;
}
