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
export const FINAL_QUOTATION_APPROVAL_REQUIRED_LABEL = "Final quotation approval required";
export const CAMPAIGN_SETTING_UP_LABEL = "Setting up";
export const CAMPAIGN_SETTING_UP_COPY =
  "The quotation is approved. Thinkway is setting up your campaign. Schedule and live status appear here once the campaign is created.";
/** Header CTA only — navigates to Your Selection. Never freezes or approves. */
export const REVIEW_YOUR_SELECTION_LABEL = "Review Your Selection";
export const ADD_FROM_SHORTLIST_LABEL = "Add from Shortlist";
export const REMOVE_FROM_SELECTION_LABEL = "Remove";
export const CONTINUE_TO_YOUR_SELECTION_LABEL = "Continue to Your Selection";
/** Shortlist continue is navigation only — it does not freeze or approve the quotation. */
export const AFTER_SHORTLIST_CONTINUE_SECTION = "creators" as const;
/** After Approve Selected Creators on Your Selection, open Commercial. */
export const AFTER_CREATOR_APPROVAL_SECTION = "commercial" as const;
/** After Approve Final Quotation, open the Campaign execution tab. */
export const AFTER_FINAL_QUOTATION_SECTION = "approval" as const;
export const UNPRICED_APPROVAL_MESSAGE = "Your selection includes creators without confirmed pricing.";
export const UNPRICED_INCLUDED_MESSAGE =
  "Only creators with confirmed pricing will be included in the current quotation. Creators without confirmed pricing will remain in your selection and can be quoted later once pricing is available.";
export const UNPRICED_SELECTED_CODE = "unpriced_selected";
export const PRICE_PENDING_LABEL = "Pricing required";
export const PRICE_NOT_AVAILABLE_LABEL = "Pricing required";
export const CLIENT_APPROVED_LABEL = "Client Approved";

export const PRICING_CONFIRMED_PENDING_LABEL = "Pricing confirmed — select to include";
export const QUOTATION_EXTENSION_LABEL = (n: number) => `Quotation extension ${n}`;
export const ORIGINAL_QUOTATION_TOTAL_LABEL = "Original total";

export type ClientSelectionWave = {
  number: number;
  confirmedAt: string;
  creatorIds: string[];
};

export type ClientSelectionFreeze = {
  confirmedAt: string;
  creatorIds: string[];
  /** Priced creators locked into the original commercial. Unpriced freeze members are omitted. */
  commerciallyIncludedCreatorIds?: string[];
  /** Priced creators approved after the original quotation was commercially approved. */
  extensions?: ClientSelectionWave[];
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

/** Display-only: priced creators first, then unpriced. Relative order inside each group is kept. */
export function sortCreatorsPricedFirst<T extends { investmentAmount?: number | null }>(
  creators: T[]
): T[] {
  return [...creators].sort((left, right) => {
    const leftRank = isPricedClientInvestment(left.investmentAmount) ? 0 : 1;
    const rightRank = isPricedClientInvestment(right.investmentAmount) ? 0 : 1;
    return leftRank - rightRank;
  });
}

export function thinkwayStatusLabel(status: ClientThinkwayStatus | undefined): string {
  if (!status) return "";
  return THINKWAY_STATUS_LABEL[status];
}

export function clientStatusDisplay(input: {
  selection: ClientCreatorSelectionState;
  selectionConfirmed: boolean;
  commerciallyApproved: boolean;
  pendingCommercialApproval?: boolean;
}): string {
  if (input.pendingCommercialApproval) {
    return input.selection === "accepted" ? "Selected" : PRICING_CONFIRMED_PENDING_LABEL;
  }
  if (input.selection !== "accepted") return CLIENT_SELECTION_STATUS_LABEL[input.selection];
  if (input.commerciallyApproved) return "Commercially approved";
  if (input.selectionConfirmed) return CLIENT_APPROVED_LABEL;
  return CLIENT_SELECTION_STATUS_LABEL.accepted;
}

export function investmentDisplayLabel(amount: number | null | undefined): string {
  if (!isPricedClientInvestment(amount)) return PRICE_PENDING_LABEL;
  return "";
}

function parseSelectionWaves(value: unknown): ClientSelectionWave[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const waves: ClientSelectionWave[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const confirmedAt = typeof row.confirmedAt === "string" && row.confirmedAt.trim() ? row.confirmedAt : "";
    const creatorIds = Array.isArray(row.creatorIds)
      ? row.creatorIds.filter((id): id is string => typeof id === "string" && Boolean(id.trim()))
      : [];
    const number = typeof row.number === "number" && Number.isFinite(row.number) ? Math.trunc(row.number) : waves.length + 1;
    if (!confirmedAt || creatorIds.length === 0) continue;
    waves.push({ number, confirmedAt, creatorIds });
  }
  return waves.length > 0 ? waves : undefined;
}

export function parseClientSelectionFreeze(value: unknown): ClientSelectionFreeze | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const row = value as Record<string, unknown>;
  const confirmedAt = typeof row.confirmedAt === "string" && row.confirmedAt.trim() ? row.confirmedAt : "";
  const creatorIds = Array.isArray(row.creatorIds)
    ? row.creatorIds.filter((id): id is string => typeof id === "string" && Boolean(id.trim()))
    : [];
  if (!confirmedAt || creatorIds.length === 0) return undefined;
  const commerciallyIncludedCreatorIds = Array.isArray(row.commerciallyIncludedCreatorIds)
    ? row.commerciallyIncludedCreatorIds.filter((id): id is string => typeof id === "string" && Boolean(id.trim()))
    : undefined;
  return {
    confirmedAt,
    creatorIds,
    commerciallyIncludedCreatorIds,
    extensions: parseSelectionWaves(row.extensions),
  };
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

export type PricedIdentityCreator = ClientCreatorIdentityFields & {
  investmentAmount?: number;
  agencyFeeAmount?: number;
};

export type ResolvedClientSelectionFreeze = {
  freeze: ClientSelectionFreeze;
  didUpgrade: boolean;
  commerciallyIncludedCreatorIds: string[];
  extensionWaves: ClientSelectionWave[];
  pendingCommercialApprovalIds: string[];
  unpricedApprovedIds: string[];
  lockedSelectionIds: string[];
};

function unionIds(values: Array<string[] | undefined>): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const list of values) {
    for (const id of list ?? []) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      next.push(id);
    }
  }
  return next;
}

export function matchingCreatorIds(
  creators: ClientCreatorIdentityFields[],
  freezeIds?: string[] | null
): string[] {
  if (!freezeIds?.length) return [];
  const frozen = new Set(freezeIds);
  return creators
    .filter((creator) => creatorMatchesApprovedIds(creator, frozen))
    .map((creator) => creator.creatorId);
}

export function buildClientSelectionFreeze(input: {
  now: string;
  acceptedIds: string[];
  creators: PricedIdentityCreator[];
}): ClientSelectionFreeze {
  const commerciallyIncludedCreatorIds = input.acceptedIds.filter((id) => {
    const creator = input.creators.find((item) => item.creatorId === id);
    return isPricedClientInvestment(creator?.investmentAmount);
  });
  return {
    confirmedAt: input.now,
    creatorIds: input.acceptedIds,
    commerciallyIncludedCreatorIds,
    extensions: [],
  };
}

export function appendClientSelectionWave(input: {
  previous: ClientSelectionFreeze;
  addedIds: string[];
  commerciallyApproved: boolean;
  now: string;
}): ClientSelectionFreeze {
  const added = input.addedIds.filter(Boolean);
  const creatorIds = unionIds([input.previous.creatorIds, added]);
  const included = input.previous.commerciallyIncludedCreatorIds ?? [];
  if (!input.commerciallyApproved) {
    return {
      ...input.previous,
      creatorIds,
      commerciallyIncludedCreatorIds: unionIds([included, added]),
      extensions: input.previous.extensions ?? [],
    };
  }
  const extensions = [...(input.previous.extensions ?? [])];
  if (added.length > 0) {
    extensions.push({
      number: extensions.length + 1,
      confirmedAt: input.now,
      creatorIds: added,
    });
  }
  return {
    ...input.previous,
    creatorIds,
    commerciallyIncludedCreatorIds: included,
    extensions,
  };
}

export function resolveClientSelectionFreeze(
  freeze: ClientSelectionFreeze | undefined,
  creators: PricedIdentityCreator[]
): ResolvedClientSelectionFreeze | null {
  if (!freeze) return null;
  let next = freeze;
  let didUpgrade = false;
  if (freeze.commerciallyIncludedCreatorIds == null) {
    const included = creators
      .filter(
        (creator) =>
          creatorMatchesApprovedIds(creator, new Set(freeze.creatorIds)) &&
          isPricedClientInvestment(creator.investmentAmount)
      )
      .map((creator) => creator.creatorId);
    next = { ...freeze, commerciallyIncludedCreatorIds: included, extensions: freeze.extensions ?? [] };
    didUpgrade = true;
  }
  const commerciallyIncludedCreatorIds = matchingCreatorIds(
    creators,
    next.commerciallyIncludedCreatorIds
  );
  const extensionWaves = (next.extensions ?? []).map((wave, index) => ({
    ...wave,
    number: wave.number || index + 1,
    creatorIds: matchingCreatorIds(creators, wave.creatorIds),
  }));
  const extensionIds = new Set(extensionWaves.flatMap((wave) => wave.creatorIds));
  const includedSet = new Set(commerciallyIncludedCreatorIds);
  const freezeMembers = matchingCreatorIds(creators, next.creatorIds);
  const pendingCommercialApprovalIds = freezeMembers.filter((id) => {
    const creator = creators.find((item) => item.creatorId === id);
    return (
      isPricedClientInvestment(creator?.investmentAmount) &&
      !includedSet.has(id) &&
      !extensionIds.has(id)
    );
  });
  const unpricedApprovedIds = freezeMembers.filter((id) => {
    const creator = creators.find((item) => item.creatorId === id);
    return !isPricedClientInvestment(creator?.investmentAmount);
  });
  return {
    freeze: next,
    didUpgrade,
    commerciallyIncludedCreatorIds,
    extensionWaves,
    pendingCommercialApprovalIds,
    unpricedApprovedIds,
    lockedSelectionIds: unionIds([
      commerciallyIncludedCreatorIds,
      extensionWaves.flatMap((wave) => wave.creatorIds),
      unpricedApprovedIds,
    ]),
  };
}

export function quotationExtensionTitle(n: number): string {
  return QUOTATION_EXTENSION_LABEL(n);
}

export type ClientQuotationCommercialSection = {
  kind: "original" | "extension";
  title: string;
  creatorIds: string[];
  cost: number;
  agencyFees: number;
  total: number;
};

function sectionTotals(
  creators: PricedIdentityCreator[],
  creatorIds: string[]
): Pick<ClientQuotationCommercialSection, "cost" | "agencyFees" | "total"> {
  const rows = creators.filter(
    (creator) => creatorIds.includes(creator.creatorId) && isPricedClientInvestment(creator.investmentAmount)
  );
  const cost = rows.reduce((sum, creator) => sum + (creator.investmentAmount ?? 0), 0);
  const agencyFees = rows.reduce((sum, creator) => sum + (Number(creator.agencyFeeAmount) || 0), 0);
  return { cost, agencyFees, total: cost + agencyFees };
}

export function clientQuotationCommercialView(
  creators: PricedIdentityCreator[],
  freeze: ClientSelectionFreeze | undefined
): {
  original: ClientQuotationCommercialSection;
  extensions: ClientQuotationCommercialSection[];
  pricingRequiredIds: string[];
  pendingCommercialApprovalIds: string[];
  originalTotal: number;
  totalInvestment: number;
} {
  const resolved = resolveClientSelectionFreeze(freeze, creators);
  const originalIds = resolved?.commerciallyIncludedCreatorIds ?? [];
  const originalTotals = sectionTotals(creators, originalIds);
  const original: ClientQuotationCommercialSection = {
    kind: "original",
    title: "Included in current quotation",
    creatorIds: originalIds,
    ...originalTotals,
  };
  const extensions = (resolved?.extensionWaves ?? []).map((wave) => {
    const totals = sectionTotals(creators, wave.creatorIds);
    return {
      kind: "extension" as const,
      title: quotationExtensionTitle(wave.number),
      creatorIds: wave.creatorIds,
      ...totals,
    };
  });
  const totalInvestment =
    original.total + extensions.reduce((sum, section) => sum + section.total, 0);
  return {
    original,
    extensions,
    pricingRequiredIds: resolved?.unpricedApprovedIds ?? [],
    pendingCommercialApprovalIds: resolved?.pendingCommercialApprovalIds ?? [],
    originalTotal: original.total,
    totalInvestment,
  };
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

export type ClientCreatorIdentityFields = Pick<
  ClientReviewSourceSnapshotCreator,
  "creatorId" | "influencerId" | "handle" | "shortlistItemId" | "profileId" | "unifiedId"
>;

function overlayKeys(creator: ClientCreatorIdentityFields): string[] {
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

function creatorMatchesApprovedIds(
  creator: ClientCreatorIdentityFields,
  approvedIds: ReadonlySet<string>
): boolean {
  return overlayKeys(creator).some((key) => approvedIds.has(key));
}

/**
 * Map stored selection_state onto the current roster when quotation sync
 * changes creatorId while unified / influencer / handle identity is the same.
 */
export function remapClientSelectionOntoCreators(
  creators: ClientCreatorIdentityFields[],
  previous: Record<string, ClientCreatorSelectionState>
): Record<string, ClientCreatorSelectionState> {
  const next: Record<string, ClientCreatorSelectionState> = {};
  for (const creator of creators) {
    let state: ClientCreatorSelectionState = "in_review";
    for (const key of overlayKeys(creator)) {
      const hit = previous[key];
      if (hit === "accepted") {
        state = "accepted";
        break;
      }
      if (hit === "rejected") state = "rejected";
    }
    next[creator.creatorId] = state;
  }
  return next;
}

/** After Approve Selected Creators, frozen IDs are accepted even if live selection_state was reset. */
export function applyFrozenClientSelection(
  creators: ClientCreatorIdentityFields[],
  selection: Record<string, ClientCreatorSelectionState>,
  approvedIds?: string[] | null
): Record<string, ClientCreatorSelectionState> {
  const next: Record<string, ClientCreatorSelectionState> = { ...selection };
  for (const creator of creators) {
    if (!next[creator.creatorId]) next[creator.creatorId] = "in_review";
  }
  if (!approvedIds?.length) return next;
  const frozen = new Set(approvedIds);
  for (const creator of creators) {
    if (creatorMatchesApprovedIds(creator, frozen)) {
      next[creator.creatorId] = "accepted";
    }
  }
  return next;
}

export function hydrateClientSelection(
  creators: ClientCreatorIdentityFields[],
  live: Record<string, ClientCreatorSelectionState>,
  approvedIds?: string[] | null,
  pendingIds?: string[] | null
): Record<string, ClientCreatorSelectionState> {
  const next = applyFrozenClientSelection(
    creators,
    remapClientSelectionOntoCreators(creators, live),
    approvedIds
  );
  if (!pendingIds?.length) return next;
  const pending = new Set(pendingIds);
  for (const creator of creators) {
    if (creatorMatchesApprovedIds(creator, pending)) {
      next[creator.creatorId] = "in_review";
    }
  }
  return next;
}

export function applyQuotationCurrency(
  creator: ClientReviewSourceSnapshotCreator,
  currency: string | undefined
): ClientReviewSourceSnapshotCreator {
  if (!currency?.trim()) return creator;
  return { ...creator, investmentCurrency: currency };
}

function overlayAvatarUrl(
  creator: ClientReviewSourceSnapshotCreator,
  quoted: ClientReviewSourceSnapshotCreator
): string | undefined {
  const live = quoted.avatarUrl?.trim();
  const existing = creator.avatarUrl?.trim();
  if (!live) return existing;
  if (!existing) return live;
  const liveRank = live.toLowerCase().includes("/creator-avatars/enrichment/")
    ? 3
    : live.toLowerCase().includes("/creator-avatars/imports/")
      ? 1
      : live.toLowerCase().includes("/creator-avatars/")
        ? 2
        : 2;
  const existingRank = existing.toLowerCase().includes("/creator-avatars/enrichment/")
    ? 3
    : existing.toLowerCase().includes("/creator-avatars/imports/")
      ? 1
      : existing.toLowerCase().includes("/creator-avatars/")
        ? 2
        : 2;
  return liveRank >= existingRank ? live : existing;
}

function overlayQuotedCreator(
  creator: ClientReviewSourceSnapshotCreator,
  quoted: ClientReviewSourceSnapshotCreator,
  currency: string | undefined
): ClientReviewSourceSnapshotCreator {
  const deliverables = quoted.deliverables?.trim() || undefined;
  const deliverableItems = quoted.deliverableItems?.length ? quoted.deliverableItems : undefined;
  const liveAccounts = quoted.platformAccounts?.length ? quoted.platformAccounts : undefined;
  const primary = liveAccounts?.find((row) => row.platform === "instagram") ?? liveAccounts?.[0];
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
      usageRightsAmount: isPricedClientInvestment(quoted.investmentAmount)
        ? quoted.usageRightsAmount ?? 0
        : undefined,
      originalInvestmentAmount: quoted.originalInvestmentAmount,
      originalInvestmentCurrency: quoted.originalInvestmentCurrency,
      thinkwayStatus: quoted.thinkwayStatus ?? creator.thinkwayStatus,
      shortlistItemId: quoted.shortlistItemId ?? creator.shortlistItemId,
      profileId: quoted.profileId ?? creator.profileId,
      unifiedId: quoted.unifiedId ?? creator.unifiedId,
      influencerId: quoted.influencerId ?? creator.influencerId,
      avatarUrl: overlayAvatarUrl(creator, quoted),
      ...(liveAccounts
        ? {
            platformAccounts: liveAccounts,
            followers: primary?.followers ?? quoted.followers ?? creator.followers,
            engagementRate: primary?.engagementRate ?? quoted.engagementRate ?? creator.engagementRate,
            avgLikes: primary?.avgLikes ?? quoted.avgLikes ?? creator.avgLikes,
            avgComments: primary?.avgComments ?? quoted.avgComments ?? creator.avgComments,
            avgViews: primary?.avgViews ?? quoted.avgViews ?? creator.avgViews,
            handle: primary?.handle ?? quoted.handle ?? creator.handle,
          }
        : {}),
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
          usageRightsAmount: undefined,
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
          usageRightsAmount: isPricedClientInvestment(creator.investmentAmount)
            ? creator.usageRightsAmount ?? 0
            : undefined,
        },
        currency || creator.investmentCurrency
      )
    ),
  ];
}

/** Replace a frozen snapshot roster with live shortlist ∪ quotation membership. */
export function applyLiveCreatorRoster(
  snapshot: ClientReviewSourceSnapshot,
  liveShortlistCreators: ClientReviewSourceSnapshotCreator[],
  liveQuotationCreators: ClientReviewSourceSnapshotCreator[] = []
): ClientReviewSourceSnapshot {
  const creators = overlayQuotationOnShortlistCreators(liveShortlistCreators, liveQuotationCreators, {
    currency: snapshot.commercial.currency,
  });
  const ids = new Set(creators.map((creator) => creator.creatorId));
  const priced = creators.filter((creator) => isPricedClientInvestment(creator.investmentAmount));
  const creatorInvestment = priced.reduce((sum, creator) => sum + (creator.investmentAmount ?? 0), 0);
  const freeze = snapshot.clientSelection
    ? {
        ...snapshot.clientSelection,
        creatorIds: snapshot.clientSelection.creatorIds.filter((id) => ids.has(id)),
        commerciallyIncludedCreatorIds: snapshot.clientSelection.commerciallyIncludedCreatorIds?.filter((id) =>
          ids.has(id)
        ),
        extensions: snapshot.clientSelection.extensions?.map((wave) => ({
          ...wave,
          creatorIds: wave.creatorIds.filter((id) => ids.has(id)),
        })),
      }
    : snapshot.clientSelection;
  return {
    ...snapshot,
    creators,
    creatorIds: creators.map((creator) => creator.creatorId),
    content: snapshot.content.filter((row) => {
      const creatorId = row.creatorId;
      return typeof creatorId === "string" && ids.has(creatorId);
    }),
    commercial: {
      ...snapshot.commercial,
      creatorInvestment,
      totalInvestment: creatorInvestment,
      quotationTotal: creatorInvestment,
      lines: priced.map((creator) => ({
        label: creator.displayName,
        amount: creator.investmentAmount,
      })),
      totalCount: creators.length,
    },
    quotation: snapshot.quotation
      ? {
          ...snapshot.quotation,
          lines: priced.map((creator) => ({
            creatorId: creator.creatorId,
            label: creator.displayName,
            amount: creator.investmentAmount ?? 0,
          })),
        }
      : snapshot.quotation,
    clientSelection: freeze,
  };
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
  if (!input.shortlist) {
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
    identityLogo:
      input.active.identityLogo ??
      quotationSnap?.identityLogo ??
      input.shortlist.identityLogo,
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
  pendingSelectedCount?: number;
}): boolean {
  if (input.historical || !input.interactive) return false;
  if ((input.pendingSelectedCount ?? 0) > 0) return true;
  return input.selectedCount > 0 && !input.selectionConfirmed;
}

export function canEnableApproveSelectedCreators(input: {
  historical: boolean;
  interactive: boolean;
  selectedCount: number;
  unpricedSelectedCount: number;
  selectionConfirmed: boolean;
  pendingSelectedCount?: number;
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
  pendingCommercialApproval?: boolean;
}): boolean {
  if (!input.canDecide) return false;
  if (!input.selectionConfirmed) return true;
  return Boolean(input.pendingCommercialApproval);
}

export const COMMERCIAL_LOCKED_UNTIL_CREATOR_APPROVAL_MESSAGE =
  "Continue to Your Selection, then Approve Selected Creators. Selection, Cost, Agency Fees, and Total Investment appear here after that approval.";

export function commercialLockedUntilCreatorApprovalMessage(hideCostAndFees = false): string {
  if (hideCostAndFees) {
    return "Continue to Your Selection, then Approve Selected Creators. Selection and Total Investment appear here after that approval.";
  }
  return COMMERCIAL_LOCKED_UNTIL_CREATOR_APPROVAL_MESSAGE;
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
  pendingCommercialApproval?: boolean;
}): { ok: boolean; message?: string } {
  if (input.pendingCommercialApproval) {
    if (!input.priced) {
      return { ok: false, message: "Pricing is required before this creator can be added to the quotation." };
    }
    return { ok: true };
  }
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
    const frozen = new Set(approvedIds);
    return creators.filter((creator) =>
      creatorMatchesApprovedIds(creator as ClientCreatorIdentityFields, frozen)
    );
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

/**
 * Shell header CTA. After creator freeze this navigates to Commercial so the
 * client can Approve Final Quotation there. It never writes quotation status.
 */
export function headerJourneyCta(input: {
  canApproveFinalQuotation: boolean;
  pendingCommercialApproval?: boolean;
}): {
  label: string;
  section: "creators" | "commercial";
  writesClientSelection: false;
  freezesSelection: false;
  approvesCreators: false;
  approvesQuotation: false;
} {
  if (input.pendingCommercialApproval) return headerSelectionNavigation();
  if (input.canApproveFinalQuotation) {
    return {
      label: APPROVE_FINAL_QUOTATION_LABEL,
      section: AFTER_CREATOR_APPROVAL_SECTION,
      writesClientSelection: false,
      freezesSelection: false,
      approvesCreators: false,
      approvesQuotation: false,
    };
  }
  return headerSelectionNavigation();
}

/** Shortlist primary CTA. Navigation only — does not freeze selection or approve the quotation. */
export function shortlistContinueToYourSelection(): {
  label: typeof CONTINUE_TO_YOUR_SELECTION_LABEL;
  section: typeof AFTER_SHORTLIST_CONTINUE_SECTION;
  writesClientSelection: false;
  freezesSelection: false;
  approvesCreators: false;
  approvesQuotation: false;
} {
  return {
    label: CONTINUE_TO_YOUR_SELECTION_LABEL,
    section: AFTER_SHORTLIST_CONTINUE_SECTION,
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
  pendingCommercialApproval?: boolean;
}): { label: string; tone: "idle" | "active" | "attention" | "ok" | "bad" } {
  if (input.pendingCommercialApproval) {
    return { label: "New pricing to approve", tone: "attention" };
  }
  if (input.quotationStage === "approved") {
    if (input.selectedCount === 0) return { label: "Selection required", tone: "attention" };
    return { label: "Approved", tone: "ok" };
  }
  if (input.quotationStage === "updated") {
    return { label: "Updated — final quotation approval required", tone: "attention" };
  }
  if (input.quotationStage === "rejected") return { label: "Rejected", tone: "bad" };
  if (input.quotationStage === "superseded") return { label: "Historical / Superseded", tone: "idle" };
  if (input.selectionConfirmed) {
    return { label: FINAL_QUOTATION_APPROVAL_REQUIRED_LABEL, tone: "attention" };
  }
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
  if (input.commerciallyApproved) return { label: CAMPAIGN_SETTING_UP_LABEL, tone: "active" };
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
  commerciallyIncludedCreatorIds?: string[];
  pendingCommercialApprovalCreatorIds?: string[];
  quotationExtensionCount?: number;
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
  pendingSelectedCount?: number;
  commerciallyIncludedCreatorIds?: string[];
  pendingCommercialApprovalCreatorIds?: string[];
  quotationExtensionCount?: number;
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
    commerciallyIncludedCreatorIds: input.commerciallyIncludedCreatorIds,
    pendingCommercialApprovalCreatorIds: input.pendingCommercialApprovalCreatorIds,
    quotationExtensionCount: input.quotationExtensionCount,
  };
}

export function sourceForConfirm(source: ClientReviewSource): ClientReviewSource {
  return source;
}
