import type { SupabaseClient } from "@supabase/supabase-js";

import type { CampaignObject } from "@/features/campaign-intelligence";
import type { QuotationDetail } from "@/lib/domains/commercial/quotation-detail-types";
import { getQuotationDetail } from "@/lib/services/quotations/quotation-document-service";

import {
  mergeQuotationCommercialsContext,
  type QuotationCommercialsContextPatch,
} from "./quotation-commercials-meta";

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
 * Refresh `meta.quotationCommercials` identity fields from the live quotation
 * record — used on conversation load, preview, and export so Media Plan reflects
 * client/brand edits without a manual re-sync.
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

  const merged = mergeQuotationCommercialsContext(
    existing,
    contextFromQuotationDetail(detail, quotationId)
  );

  if (
    merged.clientName === existing?.clientName &&
    merged.brandName === existing?.brandName &&
    merged.groupName === existing?.groupName &&
    merged.agencyOrDirect === existing?.agencyOrDirect &&
    merged.agencyName === existing?.agencyName &&
    merged.quotationId === existing?.quotationId
  ) {
    return campaignObject;
  }

  return {
    ...campaignObject,
    meta: {
      ...campaignObject.meta,
      quotationCommercials: merged,
    },
  };
}
