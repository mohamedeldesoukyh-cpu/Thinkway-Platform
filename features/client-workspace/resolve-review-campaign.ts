import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClientReviewRecord } from "./types";

/** Resolve existing relationships only; a shared quotation may predate its campaign. */
export async function hydrateReviewCampaigns(
  db: SupabaseClient,
  reviews: ClientReviewRecord[]
): Promise<ClientReviewRecord[]> {
  if (reviews.every((review) => review.campaignHeaderId)) return reviews;
  const ids = (values: (string | null | undefined)[]) => [...new Set(values.filter((v): v is string => Boolean(v)))];
  const journeyIds = ids(reviews.map((review) => review.journeyId));
  const quotationIds = ids(reviews.map((review) => review.quotationId));
  const [journeys, quotations, headers] = await Promise.all([
    journeyIds.length ? db.from("campaign_client_journeys").select("id, campaign_header_id").in("id", journeyIds) : { data: [] },
    quotationIds.length ? db.from("quotations").select("id, campaign_header_id").in("id", quotationIds) : { data: [] },
    quotationIds.length ? db.from("campaign_headers").select("id, quotation_id").in("quotation_id", quotationIds) : { data: [] },
  ]);
  return reviews.map((review) => {
    if (review.campaignHeaderId) return review;
    const candidates = ids([
      ...(journeys.data ?? []).filter(row => row.id === review.journeyId).map(row => row.campaign_header_id),
      ...(quotations.data ?? []).filter(row => row.id === review.quotationId).map(row => row.campaign_header_id),
      ...(headers.data ?? []).filter(row => row.quotation_id === review.quotationId).map(row => row.id),
    ]);
    // Never pick an arbitrary campaign when source relationships disagree.
    return candidates.length === 1 ? { ...review, campaignHeaderId: candidates[0] } : review;
  });
}
