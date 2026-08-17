import { readShortlistDisplayCurrency } from "@/lib/discovery/shortlist-currency";
import { queryShortlistSeedItemsWithCollapseFallback } from "@/lib/discovery/shortlist-item-collapse-select";
import {
  resolveCreatorFromRefLookup,
  resolveUnifiedCreatorsByRefs,
} from "@/lib/creators/unified-browse";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { ClientCreatorSelectionState } from "./constants";
import { persistClientReview, type CreateClientReviewResult } from "./persist-client-review";
import { fingerprintFromSnapshotCreators } from "./snapshot";
import { shortlistReviewBlockers } from "./source-readiness";
import type { ClientReviewSourceSnapshot, ClientReviewSourceSnapshotCreator } from "./types";
import { formatDeliverableItems, parseDeliverableItems } from "./deliverables";
import { attachMatchExplanation, enrichSnapshotCreatorFromUnified } from "./creator-snapshot";
import { buildMediaPlanSummary } from "./media-plan-summary";

export type CreateClientReviewFromShortlistInput = {
  shortlistId: string;
  selectedItemIds?: string[];
  userId: string;
  origin: string;
};

type ShortlistHeader = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  is_archived: boolean;
  client_id: string | null;
  brand_id: string | null;
  campaign_header_id?: string | null;
  currency?: string | null;
  metadata?: unknown;
};

type ShortlistSeedItem = {
  id: string;
  influencer_id: string | null;
  profile_id: string | null;
  unified_id: string | null;
  revenue: number | null;
  cost_currency: string | null;
  deliverables: unknown;
  item_status?: string | null;
  sort_order: number | null;
  match_score?: number | null;
};

type DeliverableLine = {
  platform?: string;
  type?: string;
  types?: string[];
  quantity?: number;
};

function creatorIdForItem(item: ShortlistSeedItem): string {
  if (item.unified_id?.trim()) return item.unified_id.trim();
  if (item.influencer_id?.trim()) return `inf:${item.influencer_id.trim()}`;
  if (item.profile_id?.trim()) return `dis:${item.profile_id.trim()}`;
  return item.id;
}

function formatDeliverables(raw: unknown): string | undefined {
  return formatDeliverableItems(parseDeliverableItems(raw));
}

function contentFromDeliverables(
  creatorName: string,
  creatorId: string,
  raw: unknown
): ClientReviewSourceSnapshot["content"] {
  if (!Array.isArray(raw)) return [];
  return (raw as DeliverableLine[])
    .filter((line) => line.type || line.types?.[0])
    .map((line) => ({
      creatorId,
      creatorName,
      platform: line.platform ?? "",
      deliverable: line.type || line.types?.[0] || "",
    }));
}

function cardFromCreator(
  item: ShortlistSeedItem,
  creator: UnifiedCreatorResult | undefined,
  currency: string
): ClientReviewSourceSnapshotCreator {
  const platform = creator?.platforms[0];
  const handle = platform?.handle
    ? platform.handle.startsWith("@")
      ? platform.handle
      : `@${platform.handle}`
    : undefined;
  const deliverableItems = parseDeliverableItems(item.deliverables);
  const base: ClientReviewSourceSnapshotCreator = {
    creatorId: creatorIdForItem(item),
    displayName: creator?.display_name || handle || "Creator",
    handle,
    platform: platform?.platform,
    deliverables: formatDeliverables(item.deliverables),
    deliverableItems: deliverableItems.length > 0 ? deliverableItems : undefined,
    investmentAmount: item.revenue ?? undefined,
    investmentCurrency: item.cost_currency || currency,
    influencerId: item.influencer_id ?? undefined,
  };
  return attachMatchExplanation(enrichSnapshotCreatorFromUnified(base, creator), {
    matchPercent: item.match_score,
    why: creator?.ai_niche ? `Relevant ${creator.ai_niche} creator for this campaign.` : undefined,
  });
}

export async function createClientReviewFromShortlist(
  supabase: SupabaseClient,
  input: CreateClientReviewFromShortlistInput
): Promise<CreateClientReviewResult> {
  const { data: headerRow, error: headerError } = await supabase
    .from("discovery_shortlists")
    .select("id, name, description, status, is_archived, client_id, brand_id, metadata")
    .eq("id", input.shortlistId)
    .maybeSingle();
  if (headerError || !headerRow) {
    return {
      ok: false,
      message: headerError?.message ?? "Shortlist not found.",
      blockers: [headerError?.message ?? "Shortlist not found."],
    };
  }
  const header = headerRow as ShortlistHeader;

  const itemsResult = await queryShortlistSeedItemsWithCollapseFallback<ShortlistSeedItem[]>(
    (select) =>
      supabase
        .from("discovery_shortlist_items")
        .select(`${select}, item_status, match_score`)
        .eq("shortlist_id", input.shortlistId)
        .order("sort_order", { ascending: true }) as never
  );
  if (itemsResult.error) {
    return {
      ok: false,
      message: itemsResult.error.message,
      blockers: [itemsResult.error.message],
    };
  }
  const allItems = (itemsResult.data ?? []) as ShortlistSeedItem[];

  const { data: clientRow } = header.client_id
    ? await supabase.from("clients").select("name").eq("id", header.client_id).maybeSingle()
    : { data: null };
  const { data: brandRow } = header.brand_id
    ? await supabase.from("brands").select("name").eq("id", header.brand_id).maybeSingle()
    : { data: null };
  const clientLabel = (clientRow as { name?: string } | null)?.name ?? null;
  const brandName = (brandRow as { name?: string } | null)?.name ?? null;

  const blockers = shortlistReviewBlockers({
    header,
    clientLabel,
    brandName,
    items: allItems,
    selectedItemIds: input.selectedItemIds,
  });
  if (blockers.length > 0) {
    return { ok: false, message: "Cannot create client review from this shortlist.", blockers };
  }

  const selectedSet = input.selectedItemIds?.length ? new Set(input.selectedItemIds) : null;
  const frozenItems = allItems.filter((item) => {
    if (item.item_status === "cancelled") return false;
    if (selectedSet) return selectedSet.has(item.id);
    return true;
  });
  if (frozenItems.length === 0) {
    return {
      ok: false,
      message: "Cannot create client review from this shortlist.",
      blockers: ["Select at least one creator to send to the client."],
    };
  }

  let lookup: Awaited<ReturnType<typeof resolveUnifiedCreatorsByRefs>> | null = null;
  try {
    lookup = await resolveUnifiedCreatorsByRefs(supabase as never, {
      unifiedIds: frozenItems.map((item) => item.unified_id),
      influencerIds: frozenItems.map((item) => item.influencer_id),
      discoveredProfileIds: frozenItems.map((item) => item.profile_id),
    });
  } catch {
    lookup = null;
  }

  const currency = readShortlistDisplayCurrency(header);
  const snapshotCreators = frozenItems.map((item) =>
    cardFromCreator(
      item,
      lookup ? resolveCreatorFromRefLookup(lookup, item) ?? undefined : undefined,
      currency
    )
  );
  const content = frozenItems.flatMap((item, index) =>
    contentFromDeliverables(snapshotCreators[index]?.displayName ?? "Creator", creatorIdForItem(item), item.deliverables)
  );
  const platforms = [
    ...new Set(snapshotCreators.map((creator) => creator.platform).filter((value): value is string => Boolean(value))),
  ];
  const deliverables = [
    ...new Set(
      snapshotCreators
        .flatMap((creator) => creator.deliverables?.split(", ") ?? [])
        .filter(Boolean)
    ),
  ];
  const creatorInvestment = snapshotCreators.reduce(
    (sum, creator) => sum + (creator.investmentAmount ?? 0),
    0
  );
  const selection: Record<string, ClientCreatorSelectionState> = {};
  for (const creator of snapshotCreators) selection[creator.creatorId] = "in_review";

  const snapshot: ClientReviewSourceSnapshot = {
    source: "shortlist",
    brandName: brandName || header.name,
    campaignName: header.name,
    clientLabel: clientLabel || brandName || header.name,
    objective: header.description?.trim() || undefined,
    platforms,
    deliverables,
    whyThisApproach: `Creator shortlist for ${brandName || clientLabel || header.name}.`,
    creators: snapshotCreators,
    content,
    timeline: { durationWeeks: null, durationLabel: "Duration not confirmed", phases: [] },
    commercial: {
      currency,
      creatorInvestment,
      totalInvestment: creatorInvestment,
      lines: snapshotCreators
        .filter((creator) => creator.investmentAmount != null)
        .map((creator) => ({ label: creator.displayName, amount: creator.investmentAmount })),
      selectedCount: snapshotCreators.length,
      totalCount: snapshotCreators.length,
    },
    creatorIds: snapshotCreators.map((creator) => creator.creatorId),
  };
  snapshot.mediaPlanSummary = buildMediaPlanSummary(snapshot);

  return persistClientReview({
    supabase,
    userId: input.userId,
    origin: input.origin,
    source: "shortlist",
    scope: { source: "shortlist", shortlistId: header.id },
    shortlistId: header.id,
    clientLabel: snapshot.clientLabel,
    brandName: snapshot.brandName,
    campaignName: snapshot.campaignName,
    fingerprint: fingerprintFromSnapshotCreators(snapshotCreators, {
      source: "shortlist",
      shortlistId: header.id,
      itemIds: frozenItems.map((item) => item.id).sort(),
      currency,
    }),
    selection,
    snapshot,
    alreadyOpenMessage: "A client review already exists for this shortlist selection.",
    markShortlistItemIds: frozenItems.map((item) => item.id),
  });
}
