import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";
import { getQuotationDetail } from "@/lib/services/quotations/quotation-document-service";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { ClientCreatorSelectionState } from "./constants";
import { persistClientReview, type CreateClientReviewResult } from "./persist-client-review";
import { fingerprintFromSnapshotCreators } from "./snapshot";
import { quotationItemsForClient, quotationReviewBlockers } from "./source-readiness";
import type { ClientReviewSourceSnapshot, ClientReviewSourceSnapshotCreator } from "./types";

export type CreateClientReviewFromQuotationInput = {
  quotationId: string;
  userId: string;
  origin: string;
};

function formatDeliverables(item: QuotationItemRow): string | undefined {
  if (!item.deliverables?.length) return item.service_description ?? undefined;
  const parts = item.deliverables.map((line) => {
    const type = line.type || line.types?.[0];
    if (!type) return null;
    const qty = line.quantity && line.quantity > 1 ? `${line.quantity}× ` : "";
    return `${qty}${type}`;
  });
  return parts.filter((part): part is string => Boolean(part)).join(", ") || item.service_description || undefined;
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
  return {
    creatorId: creatorIdForItem(item),
    displayName: item.creator_name?.trim() || handleFor(item) || "Creator",
    handle: handleFor(item),
    platform: item.platform ?? undefined,
    followers: item.followers ?? undefined,
    engagementRate: item.engagement_rate ?? undefined,
    country: item.country_code ?? undefined,
    category: item.creator_categories?.[0] ?? undefined,
    deliverables: formatDeliverables(item),
    investmentAmount: item.revenue,
    investmentCurrency: item.cost_currency || currency,
    avatarUrl: item.profile_image_url ?? item.creator_profile_source?.avatarUrl ?? undefined,
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
  const snapshotCreators = items.map((item) => snapshotCreator(item, detail.currency));
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
