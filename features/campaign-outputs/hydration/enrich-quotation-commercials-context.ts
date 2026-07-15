import type { SupabaseClient } from "@supabase/supabase-js";

import type { CampaignObject } from "@/features/campaign-intelligence";
import type { QuotationDetail } from "@/lib/domains/commercial/quotation-detail-types";
import { getQuotationDetail } from "@/lib/services/quotations/quotation-document-service";

import {
  buildQuotationCommercialsMeta,
  mergeQuotationCommercialsContext,
  type QuotationCommercialsContextPatch,
  type QuotationCommercialsMeta,
} from "./quotation-commercials-meta";
import { seedFromQuotation } from "./seed-adapters";

function contextFromQuotationDetail(
  detail: QuotationDetail,
  quotationId: string
): QuotationCommercialsContextPatch {
  return {
    quotationId,
    clientName: detail.client_name ?? detail.temporary_client_name ?? undefined,
    brandName: detail.brand_name ?? detail.temporary_brand_name ?? undefined,
    groupName: detail.group_name ?? undefined,
    agencyOrDirect: detail.agency_or_direct ?? undefined,
    agencyName:
      detail.agency_or_direct === "agency"
        ? detail.agency_name ?? detail.client_name ?? undefined
        : undefined,
  };
}

function resolveQuotationId(
  campaignObject: CampaignObject,
  options?: {
    quotationId?: string;
    workspaceType?: string;
    workspaceId?: string;
  }
): string | undefined {
  return (
    options?.quotationId ??
    campaignObject.meta.quotationCommercials?.quotationId ??
    (options?.workspaceType === "quotation" ? options.workspaceId : undefined)
  );
}

/**
 * Refresh `meta.quotationCommercials` from the live quotation — identity fields
 * and creator commercial snapshot (manual rows, ad types, fees) so Media Plan
 * stays current without a manual workspace re-sync.
 */
export async function enrichCampaignObjectQuotationContext(
  supabase: SupabaseClient,
  campaignObject: CampaignObject,
  options?: {
    quotationId?: string;
    workspaceType?: string;
    workspaceId?: string;
  }
): Promise<CampaignObject> {
  const existing = campaignObject.meta.quotationCommercials;

  const quotationId = resolveQuotationId(campaignObject, options);
  if (!quotationId) return campaignObject;

  const detail = await getQuotationDetail(supabase, quotationId);
  if (!detail) return campaignObject;

  const contextPatch = contextFromQuotationDetail(detail, quotationId);
  const seed = seedFromQuotation(detail);
  const syncedAt = new Date().toISOString();

  const merged: QuotationCommercialsMeta =
    seed.creators.length > 0
      ? buildQuotationCommercialsMeta(seed.creators, { ...contextPatch, syncedAt })
      : mergeQuotationCommercialsContext(existing, { ...contextPatch, syncedAt });

  const creatorsChanged =
    JSON.stringify(merged.creators) !== JSON.stringify(existing?.creators ?? []);
  const contextChanged =
    merged.clientName !== existing?.clientName ||
    merged.brandName !== existing?.brandName ||
    merged.groupName !== existing?.groupName ||
    merged.agencyOrDirect !== existing?.agencyOrDirect ||
    merged.agencyName !== existing?.agencyName ||
    merged.quotationId !== existing?.quotationId;

  if (!creatorsChanged && !contextChanged) return campaignObject;

  return {
    ...campaignObject,
    meta: {
      ...campaignObject.meta,
      quotationCommercials: merged,
    },
    updatedAt: syncedAt,
  };
}
