"use client";

import { CreatorTierBadge } from "@/components/creator/creator-tier-badge";
import type { CreatorEnrichmentStatus } from "@/features/discovery/enrichment/status";
import {
  resolveCreatorTierFromUnified,
  type CreatorTierLabel,
} from "@/lib/creators/creator-tier";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import type { ShortlistItemStatus } from "@/types/database";

import { SHORTLIST_ITEM_STATUS_LABELS } from "../constants";
import type { ShortlistCreatorQuotationRef } from "../types";
import { ShortlistCreatorQuotedBadge } from "./shortlist-badges";

export const SHORTLIST_CREATOR_TIER_CELL_CLASS = "discovery-search-exact-tier-cell";
export const SHORTLIST_CREATOR_STATUS_CELL_CLASS = "discovery-search-exact-status-cell";
export const SHORTLIST_CREATOR_QUOTED_CELL_CLASS = "discovery-search-exact-quoted-cell";

/** @deprecated Use split status/quoted cells — kept for legacy meta grid usage */
export const SHORTLIST_CREATOR_META_GRID_CLASS = "discovery-search-exact-meta-grid";

/** Avatar sync glow on shortlist creator rows (replaces Sync column). */
export function shortlistCreatorSyncBorderClass(
  status: CreatorEnrichmentStatus
): string {
  switch (status) {
    case "enriched":
    case "skipped":
    // Enrichment ran / staged — still show the green updated ring.
    case "awaiting_profile_details":
      return "shortlist-creator-row-sync--updated";
    case "failed":
      return "shortlist-creator-row-sync--failed";
    case "partial":
      return "shortlist-creator-row-sync--partial";
    case "running":
    case "queued":
      return "shortlist-creator-row-sync--syncing";
    case "never":
    default:
      return "shortlist-creator-row-sync--never";
  }
}

/** Parse agency/client prefix from names like "Wavemaker x NBK Bank: …". */
export function resolveShortlistClientLabel(
  name: string,
  brandName: string | null,
  clientName: string | null
): string | null {
  if (clientName?.trim()) return clientName.trim();
  if (!brandName?.trim()) return null;
  const split = name.indexOf(" x ");
  if (split <= 0) return null;
  const prefix = name.slice(0, split).trim();
  const after = name.slice(split + 3);
  if (!after.startsWith(brandName)) return null;
  return prefix || null;
}

export function ShortlistCreatorTierCell({
  creator,
  tier,
}: {
  creator?: UnifiedCreatorResult | null;
  tier?: CreatorTierLabel | null;
}) {
  const resolved =
    tier ?? (creator ? resolveCreatorTierFromUnified(creator) : "Unknown");

  if (resolved === "Unknown") {
    return <span className="text-[11px] text-muted-foreground/60">—</span>;
  }

  return <CreatorTierBadge tier={resolved} className="shortlist-creator-tier-badge" />;
}

export function ShortlistCreatorStatusCell({
  itemStatus,
}: {
  itemStatus: ShortlistItemStatus;
}) {
  return (
    <span
      className="shortlist-creator-status-pill inline-flex h-5 max-w-full items-center truncate rounded-full border border-border bg-muted/50 px-2 text-[10px] font-semibold text-muted-foreground"
      title={SHORTLIST_ITEM_STATUS_LABELS[itemStatus]}
    >
      {SHORTLIST_ITEM_STATUS_LABELS[itemStatus]}
    </span>
  );
}

export function ShortlistCreatorQuotedCell({
  quotationRefs,
}: {
  quotationRefs: ShortlistCreatorQuotationRef[];
}) {
  return (
    <div className="min-w-0">
      <ShortlistCreatorQuotedBadge refs={quotationRefs} variant="table" />
    </div>
  );
}

/** @deprecated Use ShortlistCreatorStatusCell + ShortlistCreatorQuotedCell via metaColumns */
export function ShortlistCreatorMetaCells({
  itemStatus,
  quotationRefs,
}: {
  itemStatus: ShortlistItemStatus;
  quotationRefs: ShortlistCreatorQuotationRef[];
}) {
  return (
    <div className={SHORTLIST_CREATOR_META_GRID_CLASS}>
      <ShortlistCreatorStatusCell itemStatus={itemStatus} />
      <ShortlistCreatorQuotedCell quotationRefs={quotationRefs} />
    </div>
  );
}
