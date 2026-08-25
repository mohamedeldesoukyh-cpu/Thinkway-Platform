import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";
import { isQuotationExpired } from "@/lib/commercial/quotation-validity";
import { getQuotationDetail } from "@/lib/services/quotations/quotation-document-service";
import { clearQuotationValidityAfterCampaign } from "@/lib/services/quotations/repositories/quotation-repository";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

import { persistClientReview, type CreateClientReviewResult } from "./persist-client-review";
import { quotationItemClientCreatorId } from "./quotation-item-creator-id";
import { fingerprintFromSnapshotCreators } from "./snapshot";
import { loadIdentityLogoForReview, identityLookupLabels } from "./identity-logo";
import {
  defaultQuotationClientSelection,
  quotationIsMovedToCampaign,
} from "./client-review-selection";
import { loadShortlistPoolCreators } from "./create-from-shortlist";
import { overlayQuotationOnShortlistCreators, isPricedClientInvestment } from "./selection-flow";
import { quotationItemSnapshotCreator } from "./quotation-client-overlay";
import { quotationItemsForClient, quotationReviewBlockers } from "./source-readiness";
import type { ClientReviewSourceSnapshot, ClientReviewSourceSnapshotCreator } from "./types";
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
  mintMissingShareToken?: boolean;
  syncExistingOnly?: boolean;
};

export { overlayQuotationDetailOnCreators } from "./quotation-client-overlay";

function creatorIdForItem(item: QuotationItemRow): string {
  return quotationItemClientCreatorId(item);
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

  const movedToCampaign = quotationIsMovedToCampaign(detail);
  if (movedToCampaign && isQuotationExpired(detail.validity_date)) {
    await clearQuotationValidityAfterCampaign(
      supabase as SupabaseClient<Database>,
      detail.id
    );
  }

  const blockers = quotationReviewBlockers(detail, { allowEmptyItems: input.syncExistingOnly });
  if (blockers.length > 0) {
    return { ok: false, message: "Cannot create client review from this quotation.", blockers };
  }

  const items = quotationItemsForClient(detail.items);
  const { resolveRateToEgp } = await import("@/lib/commercial/fx-server");
  const quotationFxRateToEgp = await resolveRateToEgp(
    supabase,
    detail.currency,
    detail.issue_date
  );
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
    const base = quotationItemSnapshotCreator(item, detail.currency, quotationFxRateToEgp);
    const unified = lookup
      ? resolveCreatorFromRefLookup(lookup, {
          unified_id: item.unified_id,
          influencer_id: item.influencer_id,
          profile_id: item.profile_id,
        })
      : null;
    return enrichSnapshotCreatorFromUnified(base, unified ?? undefined);
  });
  let pooledCreators = snapshotCreators;
  if (detail.shortlist_id) {
    try {
      const shortlistPool = await loadShortlistPoolCreators(supabase, detail.shortlist_id);
      if (shortlistPool) {
        pooledCreators = overlayQuotationOnShortlistCreators(shortlistPool, snapshotCreators, {
          currency: detail.currency,
        });
      }
    } catch {
      pooledCreators = snapshotCreators;
    }
  }
  const selection = defaultQuotationClientSelection(
    pooledCreators.map((creator) => creator.creatorId),
    movedToCampaign
  );

  const creatorInvestment = pooledCreators.reduce(
    (sum, creator) => sum + (isPricedClientInvestment(creator.investmentAmount) ? creator.investmentAmount ?? 0 : 0),
    0
  );
  const platforms = [
    ...new Set(pooledCreators.map((creator) => creator.platform).filter((value): value is string => Boolean(value))),
  ];
  const deliverables = [
    ...new Set(
      pooledCreators.flatMap((creator) => creator.deliverables?.split(", ") ?? []).filter(Boolean)
    ),
  ];
  const content = contentFromQuotation(items);
  const brandName = detail.brand_name || detail.temporary_brand_name || "Brand";
  const clientLabel = identityLookupLabels(
    detail.client_name || detail.temporary_client_name,
    brandName
  )[0] ?? null;
  const campaignName = detail.campaign_name || detail.name;

  const snapshot: ClientReviewSourceSnapshot = {
    source: "quotation",
    brandName,
    campaignName,
    clientLabel: clientLabel ?? "",
    platforms,
    deliverables,
    whyThisApproach: `Commercial proposal ${detail.serial_number ?? detail.name} for ${brandName}.`,
    creators: pooledCreators,
    content,
    timeline: { durationWeeks: null, durationLabel: "Duration not confirmed", phases: [] },
    commercial: {
      currency: detail.currency,
      creatorInvestment,
      totalInvestment: creatorInvestment,
      quotationTotal: creatorInvestment,
      lines: pooledCreators
        .filter((creator) => isPricedClientInvestment(creator.investmentAmount))
        .map((creator) => ({
          label: creator.displayName,
          amount: creator.investmentAmount,
        })),
      selectedCount: pooledCreators.length,
      totalCount: pooledCreators.length,
    },
    quotation: {
      id: detail.id,
      serialNumber: detail.serial_number,
      name: detail.name,
      version: detail.version,
      lines: pooledCreators
        .filter((creator) => isPricedClientInvestment(creator.investmentAmount))
        .map((creator) => ({
          creatorId: creator.creatorId,
          label: creator.displayName,
          amount: creator.investmentAmount ?? 0,
        })),
    },
    creatorIds: pooledCreators.map((creator) => creator.creatorId),
  };
  snapshot.mediaPlanSummary = buildMediaPlanSummary(snapshot);
  snapshot.identityLogo =
    (await loadIdentityLogoForReview(supabase, {
      quotationId: detail.id,
      shortlistId: detail.shortlist_id,
      campaignHeaderId: detail.campaign_header_id,
      clientLabel,
      brandName,
      campaignName,
    })) ?? undefined;

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
    fingerprint: fingerprintFromSnapshotCreators(pooledCreators, {
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
    reuseInteractiveReview: true,
    mintMissingShareToken: input.mintMissingShareToken,
    syncExistingOnly: input.syncExistingOnly,
    replaceSelection: movedToCampaign,
  });
}
