import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";
import { getQuotationDetail } from "@/lib/services/quotations/quotation-document-service";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { ClientCreatorSelectionState } from "./constants";
import { persistClientReview, type CreateClientReviewResult } from "./persist-client-review";
import { fingerprintFromSnapshotCreators } from "./snapshot";
import { quotationItemsForClient, quotationReviewBlockers } from "./source-readiness";
import type { ClientReviewSourceSnapshot, ClientReviewSourceSnapshotCreator } from "./types";
import { formatDeliverableItems, parseDeliverableItems } from "./deliverables";
import { enrichSnapshotCreatorFromUnified } from "./creator-snapshot";
import { buildMediaPlanSummary } from "./media-plan-summary";
import {
  resolveCreatorFromRefLookup,
  resolveUnifiedCreatorsByRefs,
} from "@/lib/creators/unified-browse";

export type CreateClientReviewFromQuotationInput = {
  quotationId: string;
  userId: string;
  origin: string;
};

function formatDeliverables(item: QuotationItemRow): string | undefined {
  const items = parseDeliverableItems(item.deliverables);
  return formatDeliverableItems(items) || item.service_description || undefined;
}

function creatorIdForItem(item: QuotationItemRow): string {
  if (item.unified_id?.trim()) return item.unified_id.trim();
  if (item.influencer_id?.trim()) return `inf:${item.influencer_id.trim()}`;
  if (item.profile_id?.trim()) return `dis:${item.profile_id.trim()}`;
  return item.id;
}

function handleFor(item: QuotationItemRow): string | undefined {
  if (!item.handle?.trim()) return undefined;
  return item.handle.startsWith("@") ? item.handle : `@${item.handle}`;
}

function snapshotCreator(item: QuotationItemRow, currency: string): ClientReviewSourceSnapshotCreator {
  const deliverableItems = parseDeliverableItems(item.deliverables);
  return {
    creatorId: creatorIdForItem(item),
    displayName: item.creator_name?.trim() || handleFor(item) || "Creator",
    handle: handleFor(item),
    platform: item.platform ?? undefined,
    followers: item.followers ?? undefined,
    engagementRate: item.engagement_rate ?? undefined,
    country: item.country_code ?? undefined,
    category: item.creator_categories?.[0] ?? undefined,
    categories: item.creator_categories?.filter(Boolean) ?? undefined,
    deliverables: formatDeliverables(item),
    deliverableItems: deliverableItems.length > 0 ? deliverableItems : undefined,
    investmentAmount: item.revenue,
    investmentCurrency: item.cost_currency || currency,
    avatarUrl: item.profile_image_url ?? item.creator_profile_source?.avatarUrl ?? undefined,
    influencerId: item.influencer_id ?? undefined,
  };
}

function contentFromQuotation(items: QuotationItemRow[]): ClientReviewSourceSnapshot["content"] {
  return items.flatMap((item) =>
    (item.deliverables ?? []).map((line) => ({
      creatorId: creatorIdForItem(item),
      creatorName: item.creator_name?.trim() || "Creator",
      platform: line.platform || item.platform || "",
      deliverable: line.type || line.types?.[0] || "",
      contentConcept: line.service_description ?? item.service_description ?? undefined,
      timing: line.tentative_posting_label ?? undefined,
    }))
  ).filter((row) => row.deliverable || row.timing);
}

export async function createClientReviewFromQuotation(
  supabase: SupabaseClient,
  input: CreateClientReviewFromQuotationInput
): Promise<CreateClientReviewResult> {
  const detail = await getQuotationDetail(supabase as SupabaseClient<Database>, input.quotationId);
  if (!detail) {
    return {
      ok: false,
      message: "Quotation not found.",
      blockers: ["Quotation not found."],
    };
  }

  const blockers = quotationReviewBlockers(detail);
  if (blockers.length > 0) {
    return { ok: false, message: "Cannot create client review from this quotation.", blockers };
  }

  const items = quotationItemsForClient(detail.items);
  let lookup: Awaited<ReturnType<typeof resolveUnifiedCreatorsByRefs>> | null = null;
  try {
    lookup = await resolveUnifiedCreatorsByRefs(
      supabase as never,
      {
        unifiedIds: items.map((item) => item.unified_id),
        influencerIds: items.map((item) => item.influencer_id),
        discoveredProfileIds: items.map((item) => item.profile_id),
      },
      { omitHeavyFields: false }
    );
  } catch {
    lookup = null;
  }
  const snapshotCreators = items.map((item) => {
    const base = snapshotCreator(item, detail.currency);
    const unified = lookup
      ? resolveCreatorFromRefLookup(lookup, {
          unified_id: item.unified_id,
          influencer_id: item.influencer_id,
          profile_id: item.profile_id,
        })
      : null;
    return enrichSnapshotCreatorFromUnified(base, unified ?? undefined);
  });
  const selection: Record<string, ClientCreatorSelectionState> = {};
  for (const creator of snapshotCreators) selection[creator.creatorId] = "in_review";

  const creatorInvestment = snapshotCreators.reduce(
    (sum, creator) => sum + (creator.investmentAmount ?? 0),
    0
  );
  const platforms = [
    ...new Set(snapshotCreators.map((creator) => creator.platform).filter((value): value is string => Boolean(value))),
  ];
  const deliverables = [
    ...new Set(
      snapshotCreators.flatMap((creator) => creator.deliverables?.split(", ") ?? []).filter(Boolean)
    ),
  ];
  const content = contentFromQuotation(items);
  const brandName = detail.brand_name || detail.temporary_brand_name || "Brand";
  const clientLabel =
    detail.client_name || detail.temporary_client_name || brandName;
  const campaignName = detail.campaign_name || detail.name;

  const snapshot: ClientReviewSourceSnapshot = {
    source: "quotation",
    brandName,
    campaignName,
    clientLabel,
    platforms,
    deliverables,
    whyThisApproach: `Commercial proposal ${detail.serial_number ?? detail.name} for ${brandName}.`,
    creators: snapshotCreators,
    content,
    timeline: { durationWeeks: null, durationLabel: "Duration not confirmed", phases: [] },
    commercial: {
      currency: detail.currency,
      creatorInvestment,
      totalInvestment: creatorInvestment,
      lines: snapshotCreators.map((creator) => ({
        label: creator.displayName,
        amount: creator.investmentAmount,
      })),
      selectedCount: snapshotCreators.length,
      totalCount: snapshotCreators.length,
    },
    quotation: {
      id: detail.id,
      serialNumber: detail.serial_number,
      name: detail.name,
      version: detail.version,
      lines: snapshotCreators.map((creator) => ({
        creatorId: creator.creatorId,
        label: creator.displayName,
        amount: creator.investmentAmount ?? 0,
      })),
    },
    creatorIds: snapshotCreators.map((creator) => creator.creatorId),
  };
  snapshot.mediaPlanSummary = buildMediaPlanSummary(snapshot);

  return persistClientReview({
    supabase,
    userId: input.userId,
    origin: input.origin,
    source: "quotation",
    scope: { source: "quotation", quotationId: detail.id },
    campaignObjectId: detail.campaign_object_id,
    frozenVersion: detail.source_campaign_object_version ?? 0,
    campaignHeaderId: detail.campaign_header_id,
    shortlistId: detail.shortlist_id,
    quotationId: detail.id,
    clientLabel,
    brandName,
    campaignName,
    fingerprint: fingerprintFromSnapshotCreators(snapshotCreators, {
      source: "quotation",
      quotationId: detail.id,
      version: detail.version,
      updatedAt: detail.updated_at,
      itemIds: items.map((item) => item.id).sort(),
      currency: detail.currency,
    }),
    selection,
    snapshot,
    alreadyOpenMessage: "A client review already exists for this quotation version.",
  });
}
