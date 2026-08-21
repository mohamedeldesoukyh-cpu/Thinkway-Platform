import type {
  ClientReviewSourceSnapshot,
  ClientReviewSourceSnapshotCreator,
  ClientRosterDiffKind,
  ClientRosterDiffRow,
  ClientStageDiff,
} from "./types";

export type { ClientRosterDiffKind, ClientRosterDiffRow, ClientStageDiff };

export type ClientReviewUpdateNotice = {
  updatedAt: string;
  items: string[];
};

function creatorName(creator: ClientReviewSourceSnapshotCreator): string {
  return creator.displayName.trim() || creator.handle?.trim() || "Creator";
}

function money(value: number | undefined): number {
  return value != null && Number.isFinite(value) ? value : 0;
}

function sortedNames(creators: Array<{ displayName?: string; handle?: string }>): string {
  return creators
    .map((creator) => creatorName(creator as ClientReviewSourceSnapshotCreator))
    .sort((a, b) => a.localeCompare(b))
    .join(", ");
}

/** Client-safe list of what changed between two frozen quotation snapshots. */
export function diffClientReviewSnapshots(
  previous: ClientReviewSourceSnapshot,
  next: ClientReviewSourceSnapshot
): string[] {
  const items: string[] = [];
  const prevById = new Map(previous.creators.map((creator) => [creator.creatorId, creator]));
  const nextById = new Map(next.creators.map((creator) => [creator.creatorId, creator]));

  const added = next.creators.filter((creator) => !prevById.has(creator.creatorId));
  const removed = previous.creators.filter((creator) => !nextById.has(creator.creatorId));
  if (added.length === 1) items.push(`Added creator: ${creatorName(added[0]!)}`);
  else if (added.length > 1) items.push(`Added creators: ${sortedNames(added)}`);
  if (removed.length === 1) items.push(`Removed creator: ${creatorName(removed[0]!)}`);
  else if (removed.length > 1) items.push(`Removed creators: ${sortedNames(removed)}`);

  const investmentChanged = next.creators.some((creator) => {
    const prior = prevById.get(creator.creatorId);
    if (!prior) return false;
    return money(prior.investmentAmount) !== money(creator.investmentAmount);
  });
  if (
    investmentChanged ||
    money(previous.commercial.totalInvestment) !== money(next.commercial.totalInvestment)
  ) {
    items.push("Investment totals were updated.");
  }

  const deliverableChanged = next.creators.some((creator) => {
    const prior = prevById.get(creator.creatorId);
    if (!prior) return false;
    return (prior.deliverables ?? "") !== (creator.deliverables ?? "");
  });
  if (deliverableChanged || previous.deliverables.join("|") !== next.deliverables.join("|")) {
    items.push("Deliverables were updated.");
  }

  if (previous.campaignName.trim() !== next.campaignName.trim()) {
    items.push(`Campaign name is now ${next.campaignName.trim()}.`);
  }

  return items.slice(0, 6);
}

function deliverableKey(creator: ClientReviewSourceSnapshotCreator): string {
  return (creator.deliverables ?? "").trim();
}

export function diffShortlistToQuotation(
  shortlist: ClientReviewSourceSnapshot | null | undefined,
  quotation: ClientReviewSourceSnapshot | null | undefined
): ClientStageDiff | null {
  if (!shortlist || !quotation) return null;
  const prevById = new Map(shortlist.creators.map((creator) => [creator.creatorId, creator]));
  const nextById = new Map(quotation.creators.map((creator) => [creator.creatorId, creator]));
  const ids = [...new Set([...prevById.keys(), ...nextById.keys()])];
  const rows: ClientRosterDiffRow[] = ids.map((creatorId) => {
    const prior = prevById.get(creatorId);
    const next = nextById.get(creatorId);
    const kind: ClientRosterDiffKind = !prior ? "added" : !next ? "removed" : "existing";
    const shortlistInvestment = prior ? money(prior.investmentAmount) : undefined;
    const quotationInvestment = next ? money(next.investmentAmount) : undefined;
    const investmentChanged =
      kind === "existing" && shortlistInvestment !== quotationInvestment;
    const deliverablesChanged =
      kind === "existing" && deliverableKey(prior!) !== deliverableKey(next!);
    return {
      creatorId,
      displayName: creatorName(next ?? prior!),
      kind,
      shortlistInvestment,
      quotationInvestment,
      investmentDelta:
        investmentChanged && shortlistInvestment != null && quotationInvestment != null
          ? quotationInvestment - shortlistInvestment
          : undefined,
      investmentChanged,
      deliverablesChanged,
      shortlistDeliverables: prior?.deliverables,
      quotationDeliverables: next?.deliverables,
    };
  });

  const hasRosterChange = rows.some((row) => row.kind !== "existing");
  const commercialChangedAfterShortlistApproval =
    rows.some((row) => row.investmentChanged || row.kind !== "existing") ||
    money(shortlist.commercial.totalInvestment) !== money(quotation.commercial.totalInvestment);
  const deliverableChanged = rows.some((row) => row.deliverablesChanged);

  const summaryItems: string[] = [];
  if (commercialChangedAfterShortlistApproval) {
    summaryItems.push("Commercial value changed after shortlist approval.");
  }
  const added = rows.filter((row) => row.kind === "added");
  const removed = rows.filter((row) => row.kind === "removed");
  if (added.length === 1) summaryItems.push(`New creator added: ${added[0]!.displayName}`);
  else if (added.length > 1) {
    summaryItems.push(
      `New creators added: ${sortedNames(added.map((row) => ({ displayName: row.displayName })))}`
    );
  }
  if (removed.length === 1) summaryItems.push(`Creator removed: ${removed[0]!.displayName}`);
  else if (removed.length > 1) {
    summaryItems.push(
      `Creators removed: ${sortedNames(removed.map((row) => ({ displayName: row.displayName })))}`
    );
  }
  if (rows.some((row) => row.investmentChanged)) summaryItems.push("Creator investment changed.");
  if (deliverableChanged) summaryItems.push("Deliverables changed.");

  return {
    commercialChangedAfterShortlistApproval,
    hasRosterChange,
    rows,
    summaryItems: [...new Set(summaryItems)],
  };
}

export function retainCreatorBriefs(
  previous: ClientReviewSourceSnapshot,
  next: ClientReviewSourceSnapshot
): ClientReviewSourceSnapshot {
  const prevById = new Map(previous.creators.map((creator) => [creator.creatorId, creator]));
  return {
    ...next,
    clientSelection: previous.clientSelection,
    creators: next.creators.map((creator) => {
      const prior = prevById.get(creator.creatorId);
      if (!prior) return creator;
      return {
        ...prior,
        ...creator,
        creatorId: creator.creatorId,
        avatarUrl: creator.avatarUrl || prior.avatarUrl,
        profileUrl: creator.profileUrl || prior.profileUrl,
        bio: creator.bio || prior.bio,
        notes: creator.notes || prior.notes,
        contentFeed: creator.contentFeed?.length ? creator.contentFeed : prior.contentFeed,
        audience: creator.audience ?? prior.audience,
        performance: creator.performance ?? prior.performance,
        historical: creator.historical?.length ? creator.historical : prior.historical,
        briefFrozenAt: creator.briefFrozenAt || prior.briefFrozenAt,
        briefBackfillDone: creator.briefBackfillDone || prior.briefBackfillDone,
      };
    }),
  };
}
