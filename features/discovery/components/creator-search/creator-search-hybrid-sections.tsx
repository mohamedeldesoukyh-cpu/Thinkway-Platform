"use client";

import type { UnifiedCreatorResult } from "@/lib/creators/types";

export type CreatorSearchHybridListItem =
  | {
      kind: "section";
      id: string;
      title: string;
      subtitle?: string;
    }
  | {
      kind: "creator";
      id: string;
      creator: UnifiedCreatorResult;
      rank: number;
    };

type BuildHybridListItemsInput = {
  exactMatches: UnifiedCreatorResult[];
  allCreators: UnifiedCreatorResult[];
  didYouMeanCount?: number;
};

export function CreatorSearchHybridSectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="border-b border-border bg-muted/30 px-4 py-2.5 md:px-5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {subtitle ? (
        <p className="mt-0.5 text-[11px] text-muted-foreground/80">{subtitle}</p>
      ) : null}
    </div>
  );
}

/** Build virtualized list rows for hybrid mode (exact matches, did-you-mean, related). */
export function buildCreatorSearchHybridListItems({
  exactMatches,
  allCreators,
  didYouMeanCount = 3,
}: BuildHybridListItemsInput): CreatorSearchHybridListItem[] {
  const exactIds = new Set(exactMatches.map((creator) => creator.unified_id));
  const fuzzyCreators = allCreators.filter((creator) => !exactIds.has(creator.unified_id));
  const items: CreatorSearchHybridListItem[] = [];
  let rank = 1;

  if (exactMatches.length > 0) {
    items.push({
      kind: "section",
      id: "section-exact",
      title: "Exact matches",
      subtitle: "Creators matching this handle or name exactly",
    });
    for (const creator of exactMatches) {
      items.push({ kind: "creator", id: creator.unified_id, creator, rank: rank++ });
    }

    if (fuzzyCreators.length > 0) {
      items.push({
        kind: "section",
        id: "section-related",
        title: "Related creators",
        subtitle: "Similar results from your search",
      });
      for (const creator of fuzzyCreators) {
        items.push({ kind: "creator", id: creator.unified_id, creator, rank: rank++ });
      }
    }

    return items;
  }

  const didYouMean = fuzzyCreators.slice(0, didYouMeanCount);
  const related = fuzzyCreators.slice(didYouMeanCount);

  if (didYouMean.length > 0) {
    items.push({
      kind: "section",
      id: "section-did-you-mean",
      title: "Did you mean?",
      subtitle: "Closest matches — check spelling or try the exact handle",
    });
    for (const creator of didYouMean) {
      items.push({ kind: "creator", id: creator.unified_id, creator, rank: rank++ });
    }
  }

  if (related.length > 0) {
    items.push({
      kind: "section",
      id: "section-related",
      title: "Related creators",
      subtitle: "More creators related to your search",
    });
    for (const creator of related) {
      items.push({ kind: "creator", id: creator.unified_id, creator, rank: rank++ });
    }
  }

  return items;
}

export function countCreatorSearchHybridResults(items: CreatorSearchHybridListItem[]): number {
  return items.filter((item) => item.kind === "creator").length;
}
