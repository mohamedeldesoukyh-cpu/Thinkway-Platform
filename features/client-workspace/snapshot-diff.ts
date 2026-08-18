import type { ClientReviewSourceSnapshot, ClientReviewSourceSnapshotCreator } from "./types";

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

function sortedNames(creators: ClientReviewSourceSnapshotCreator[]): string {
  return creators.map(creatorName).sort((a, b) => a.localeCompare(b)).join(", ");
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

export function retainCreatorBriefs(
  previous: ClientReviewSourceSnapshot,
  next: ClientReviewSourceSnapshot
): ClientReviewSourceSnapshot {
  const prevById = new Map(previous.creators.map((creator) => [creator.creatorId, creator]));
  return {
    ...next,
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
