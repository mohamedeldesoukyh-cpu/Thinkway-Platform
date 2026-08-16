import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";

/** Agreed = matches assignment platforms; added_value = extra platforms beyond the assignment. */
export type PublicationValueScope = "agreed" | "added_value";

export type AssignmentAgreedPlatformIndex = {
  byLineId: Map<string, Set<string>>;
  byInfluencerId: Map<string, Set<string>>;
};

export type PublicationValueScopeInput = {
  campaign_line_id?: string | null;
  influencer_id?: string | null;
  platform: string;
  value_scope?: PublicationValueScope | null;
};

export function createEmptyAssignmentAgreedPlatformIndex(): AssignmentAgreedPlatformIndex {
  return {
    byLineId: new Map(),
    byInfluencerId: new Map(),
  };
}

export function addAgreedPlatform(
  index: AssignmentAgreedPlatformIndex,
  input: {
    campaignLineId?: string | null;
    influencerId?: string | null;
    platform: string | null | undefined;
  }
): void {
  const platform = canonicalPlatformKey(input.platform);
  if (!platform || platform === "multi") return;

  if (input.campaignLineId) {
    const lineSet = index.byLineId.get(input.campaignLineId) ?? new Set<string>();
    lineSet.add(platform);
    index.byLineId.set(input.campaignLineId, lineSet);
  }

  if (input.influencerId) {
    const influencerSet = index.byInfluencerId.get(input.influencerId) ?? new Set<string>();
    influencerSet.add(platform);
    index.byInfluencerId.set(input.influencerId, influencerSet);
  }
}

type AssignmentPlatformSourceLine = {
  id: string;
  influencer_id?: string | null;
  assignment?: {
    influencer_id?: string | null;
    platforms?: readonly {
      platform: string;
      deliverables?: readonly string[] | null;
    }[] | null;
    commercial_rows?: readonly { platform: string }[] | null;
  } | null;
};

type AssignmentPlatformSourceGroup = {
  line: { id: string; influencer_id?: string | null };
  deliverables: readonly {
    platform: string;
    is_synthetic?: boolean;
    posts?: readonly { platform: string }[] | null;
  }[];
};

function addPlatformToLineMap(
  target: Map<string, Set<string>>,
  lineId: string,
  platform: string | null | undefined
) {
  const key = canonicalPlatformKey(platform);
  if (!key || key === "multi") return;
  const set = target.get(lineId) ?? new Set<string>();
  set.add(key);
  target.set(lineId, set);
}

/**
 * Build the live agreed-platform index from Assignments data already in the workspace.
 * Deliverable rows win over line metadata so adding/removing a platform in Assignments
 * immediately moves matching publications between Agreed and Added value.
 */
export function buildAssignmentAgreedPlatformIndexFromAssignments(input: {
  lines?: readonly AssignmentPlatformSourceLine[] | null;
  hierarchyGroups?: readonly AssignmentPlatformSourceGroup[] | null;
}): AssignmentAgreedPlatformIndex {
  const index = createEmptyAssignmentAgreedPlatformIndex();
  const metadataPlatformsByLine = new Map<string, Set<string>>();
  const deliverablePlatformsByLine = new Map<string, Set<string>>();
  const influencerByLineId = new Map<string, string>();

  for (const line of input.lines ?? []) {
    const influencerId = line.influencer_id ?? line.assignment?.influencer_id ?? null;
    if (influencerId) influencerByLineId.set(line.id, influencerId);
    for (const platform of line.assignment?.platforms ?? []) {
      // Connected social accounts without contracted deliverables are not agreed.
      if ((platform.deliverables?.length ?? 0) === 0) continue;
      addPlatformToLineMap(metadataPlatformsByLine, line.id, platform.platform);
    }
    // commercial_rows are pricing only — never treat them as agreed scope.
  }

  const hierarchyLineIds = new Set<string>();
  for (const group of input.hierarchyGroups ?? []) {
    hierarchyLineIds.add(group.line.id);
    const influencerId =
      group.line.influencer_id ?? influencerByLineId.get(group.line.id) ?? null;
    if (influencerId) influencerByLineId.set(group.line.id, influencerId);
    for (const deliverable of group.deliverables) {
      if (deliverable.is_synthetic) continue;
      addPlatformToLineMap(deliverablePlatformsByLine, group.line.id, deliverable.platform);
      for (const post of deliverable.posts ?? []) {
        addPlatformToLineMap(deliverablePlatformsByLine, group.line.id, post.platform);
      }
    }
  }

  const lineIds = new Set<string>([
    ...metadataPlatformsByLine.keys(),
    ...deliverablePlatformsByLine.keys(),
    ...hierarchyLineIds,
  ]);

  for (const lineId of lineIds) {
    const deliverablePlatforms = deliverablePlatformsByLine.get(lineId);
    // Assignments grid is SSOT when hierarchy is present for the line: empty
    // deliverables ⇒ no agreed platforms (do not fall back to stale metadata).
    const platforms = hierarchyLineIds.has(lineId)
      ? (deliverablePlatforms ?? new Set<string>())
      : deliverablePlatforms && deliverablePlatforms.size > 0
        ? deliverablePlatforms
        : (metadataPlatformsByLine.get(lineId) ?? new Set<string>());
    const influencerId = influencerByLineId.get(lineId) ?? null;
    for (const platform of platforms) {
      addAgreedPlatform(index, {
        campaignLineId: lineId,
        influencerId,
        platform,
      });
    }
  }

  return index;
}

export function assignmentIndexHasAgreedPlatforms(
  index: AssignmentAgreedPlatformIndex
): boolean {
  for (const platforms of index.byLineId.values()) {
    if (platforms.size > 0) return true;
  }
  for (const platforms of index.byInfluencerId.values()) {
    if (platforms.size > 0) return true;
  }
  return false;
}

function agreedPlatformsForPublication(
  publication: PublicationValueScopeInput,
  index: AssignmentAgreedPlatformIndex
): Set<string> | null {
  if (publication.campaign_line_id) {
    const linePlatforms = index.byLineId.get(publication.campaign_line_id);
    if (linePlatforms && linePlatforms.size > 0) return linePlatforms;
  }
  if (publication.influencer_id) {
    const influencerPlatforms = index.byInfluencerId.get(publication.influencer_id);
    if (influencerPlatforms && influencerPlatforms.size > 0) return influencerPlatforms;
  }
  return null;
}

/**
 * Classify a live publication against current assignment platforms.
 * Recomputed on every load so adding/removing an assignment platform
 * automatically moves the publication between Agreed and Added value.
 */
export function classifyPublicationValueScope(
  publication: PublicationValueScopeInput,
  index: AssignmentAgreedPlatformIndex
): PublicationValueScope {
  const agreedPlatforms = agreedPlatformsForPublication(publication, index);
  if (!agreedPlatforms) return "added_value";
  const platform = canonicalPlatformKey(publication.platform);
  return platform && agreedPlatforms.has(platform) ? "agreed" : "added_value";
}

export function applyPublicationValueScopes<T extends PublicationValueScopeInput>(
  publications: readonly T[],
  index: AssignmentAgreedPlatformIndex
): Array<T & { value_scope: PublicationValueScope }> {
  const hasAgreedPlatforms = assignmentIndexHasAgreedPlatforms(index);
  return publications.map((publication) => ({
    ...publication,
    value_scope: hasAgreedPlatforms
      ? classifyPublicationValueScope(publication, index)
      : "agreed",
  }));
}

export function resolvePublicationValueScope(
  publication: Pick<PublicationValueScopeInput, "value_scope">
): PublicationValueScope {
  return publication.value_scope === "added_value" ? "added_value" : "agreed";
}

export function publicationValueScopeLabel(
  scope: PublicationValueScope | null | undefined
): string {
  return scope === "added_value" ? "Added value" : "Agreed";
}

/** Unique creators with at least one added-value publication. */
export function countAddedValueCreators<
  T extends Pick<PublicationValueScopeInput, "value_scope" | "influencer_id"> & {
    influencer_name?: string | null;
    id?: string;
  },
>(publications: readonly T[]): number {
  const keys = new Set<string>();
  for (const publication of publications) {
    if (resolvePublicationValueScope(publication) !== "added_value") continue;
    const id = publication.influencer_id?.trim();
    const name = publication.influencer_name?.trim();
    const key = id || (name ? name.toLowerCase() : null);
    // Never fall back to publication id — that would count posts as creators.
    if (key) keys.add(key);
  }
  return keys.size;
}

/**
 * Added-value share of the roster: added-value creators ÷ total creators.
 * Example: 3 added of 30 creators → 10%.
 */
export function addedValueCreatorPercent(
  addedValueCreatorCount: number,
  totalCreatorCount: number
): number | null {
  if (totalCreatorCount <= 0 || addedValueCreatorCount <= 0) return null;
  return Math.round((addedValueCreatorCount / totalCreatorCount) * 100);
}

export function partitionPublicationsByValueScope<
  T extends Pick<PublicationValueScopeInput, "value_scope">,
>(publications: readonly T[]): { agreed: T[]; addedValue: T[] } {
  const agreed: T[] = [];
  const addedValue: T[] = [];
  for (const publication of publications) {
    if (resolvePublicationValueScope(publication) === "added_value") {
      addedValue.push(publication);
    } else {
      agreed.push(publication);
    }
  }
  return { agreed, addedValue };
}

export type PublicationValueSummary = {
  count: number;
  reach: number;
  impressions: number;
  views: number;
  engagements: number;
};

export function summarizePublicationValueGroup(
  publications: ReadonlyArray<{
    reach?: number | null;
    impressions?: number | null;
    views?: number | null;
    total_engagements?: number | null;
  }>
): PublicationValueSummary {
  return {
    count: publications.length,
    reach: publications.reduce((sum, row) => sum + (row.reach ?? 0), 0),
    impressions: publications.reduce((sum, row) => sum + (row.impressions ?? 0), 0),
    views: publications.reduce((sum, row) => sum + (row.views ?? 0), 0),
    engagements: publications.reduce((sum, row) => sum + (row.total_engagements ?? 0), 0),
  };
}
