import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  clientWorkspaceListLinkForSubject,
  indexClientWorkspaceListLinks,
  propagateClientWorkspaceListLinks,
  type ClientWorkspaceJourneyLinkRow,
  type ClientWorkspaceListLink,
  type ClientWorkspaceReviewLinkRow,
} from "./client-review-selection";

function uniqueIds(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])];
}

async function loadRowsByIds<T>(
  supabase: SupabaseClient,
  table: "campaign_client_journeys" | "campaign_client_reviews",
  select: string,
  column: "shortlist_id" | "quotation_id" | "campaign_header_id" | "journey_id",
  ids: string[]
): Promise<T[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from(table as never).select(select).in(column, ids);
  if (error) {
    console.warn(`[client-workspace] ${table} ${column} enrich failed`, error.message);
    return [];
  }
  return (data ?? []) as T[];
}

async function loadRelatedClientWorkspaceSubjects(
  supabase: SupabaseClient,
  input: {
    shortlistIds: string[];
    quotationIds: string[];
    campaignHeaderIds: string[];
  }
): Promise<{
  shortlistIds: string[];
  quotationIds: string[];
  campaignHeaderIds: string[];
  subjects: Array<{
    shortlistId?: string | null;
    quotationId?: string | null;
    campaignHeaderId?: string | null;
  }>;
}> {
  const shortlistIds = new Set(input.shortlistIds);
  const quotationIds = new Set(input.quotationIds);
  const campaignHeaderIds = new Set(input.campaignHeaderIds);
  const subjects: Array<{
    shortlistId?: string | null;
    quotationId?: string | null;
    campaignHeaderId?: string | null;
  }> = [];

  const [quotesByShortlist, quotesById, headersByShortlist, headersByQuote, headersById] =
    await Promise.all([
      input.shortlistIds.length === 0
        ? Promise.resolve({ data: [] as unknown[] })
        : supabase
            .from("quotations")
            .select("id, shortlist_id, campaign_header_id, parent_quotation_id")
            .in("shortlist_id", input.shortlistIds),
      input.quotationIds.length === 0
        ? Promise.resolve({ data: [] as unknown[] })
        : supabase
            .from("quotations")
            .select("id, shortlist_id, campaign_header_id, parent_quotation_id")
            .in("id", input.quotationIds),
      input.shortlistIds.length === 0
        ? Promise.resolve({ data: [] as unknown[] })
        : supabase
            .from("campaign_headers")
            .select("id, quotation_id, shortlist_id")
            .in("shortlist_id", input.shortlistIds),
      input.quotationIds.length === 0
        ? Promise.resolve({ data: [] as unknown[] })
        : supabase
            .from("campaign_headers")
            .select("id, quotation_id, shortlist_id")
            .in("quotation_id", input.quotationIds),
      input.campaignHeaderIds.length === 0
        ? Promise.resolve({ data: [] as unknown[] })
        : supabase
            .from("campaign_headers")
            .select("id, quotation_id, shortlist_id")
            .in("id", input.campaignHeaderIds),
    ]);

  const quoteRows = [...(quotesByShortlist.data ?? []), ...(quotesById.data ?? [])] as Array<{
    id?: string | null;
    shortlist_id?: string | null;
    campaign_header_id?: string | null;
    parent_quotation_id?: string | null;
  }>;
  for (const row of quoteRows) {
    const quotationId = row.id?.trim();
    const shortlistId = row.shortlist_id?.trim();
    const campaignHeaderId = row.campaign_header_id?.trim();
    const parentId = row.parent_quotation_id?.trim();
    if (quotationId) quotationIds.add(quotationId);
    if (shortlistId) shortlistIds.add(shortlistId);
    if (campaignHeaderId) campaignHeaderIds.add(campaignHeaderId);
    if (parentId) quotationIds.add(parentId);
    subjects.push({ shortlistId, quotationId, campaignHeaderId });
  }

  const headerRows = [
    ...(headersByShortlist.data ?? []),
    ...(headersByQuote.data ?? []),
    ...(headersById.data ?? []),
  ] as Array<{
    id?: string | null;
    quotation_id?: string | null;
    shortlist_id?: string | null;
  }>;
  for (const row of headerRows) {
    const campaignHeaderId = row.id?.trim();
    const quotationId = row.quotation_id?.trim();
    const shortlistId = row.shortlist_id?.trim();
    if (campaignHeaderId) campaignHeaderIds.add(campaignHeaderId);
    if (quotationId) quotationIds.add(quotationId);
    if (shortlistId) shortlistIds.add(shortlistId);
    subjects.push({ shortlistId, quotationId, campaignHeaderId });
  }

  return {
    shortlistIds: [...shortlistIds],
    quotationIds: [...quotationIds],
    campaignHeaderIds: [...campaignHeaderIds],
    subjects,
  };
}

export async function loadClientWorkspaceListLinks(
  supabase: SupabaseClient,
  input: {
    shortlistIds?: Array<string | null | undefined>;
    quotationIds?: Array<string | null | undefined>;
    campaignHeaderIds?: Array<string | null | undefined>;
  }
): Promise<{
  byShortlistId: Map<string, ClientWorkspaceListLink>;
  byQuotationId: Map<string, ClientWorkspaceListLink>;
  byCampaignHeaderId: Map<string, ClientWorkspaceListLink>;
}> {
  const seedShortlistIds = uniqueIds(input.shortlistIds ?? []);
  const seedQuotationIds = uniqueIds(input.quotationIds ?? []);
  const seedCampaignHeaderIds = uniqueIds(input.campaignHeaderIds ?? []);
  const empty = {
    byShortlistId: new Map<string, ClientWorkspaceListLink>(),
    byQuotationId: new Map<string, ClientWorkspaceListLink>(),
    byCampaignHeaderId: new Map<string, ClientWorkspaceListLink>(),
  };
  if (
    seedShortlistIds.length === 0 &&
    seedQuotationIds.length === 0 &&
    seedCampaignHeaderIds.length === 0
  ) {
    return empty;
  }

  const related = await loadRelatedClientWorkspaceSubjects(supabase, {
    shortlistIds: seedShortlistIds,
    quotationIds: seedQuotationIds,
    campaignHeaderIds: seedCampaignHeaderIds,
  });
  const shortlistIds = related.shortlistIds;
  const quotationIds = related.quotationIds;
  const campaignHeaderIds = related.campaignHeaderIds;

  const journeySelect =
    "id, share_token, shortlist_id, quotation_id, campaign_header_id";
  const reviewSelect =
    "id, status, review_number, journey_id, shortlist_id, quotation_id, campaign_header_id";

  const journeyBatches = await Promise.all([
    loadRowsByIds<ClientWorkspaceJourneyLinkRow>(
      supabase,
      "campaign_client_journeys",
      journeySelect,
      "shortlist_id",
      shortlistIds
    ),
    loadRowsByIds<ClientWorkspaceJourneyLinkRow>(
      supabase,
      "campaign_client_journeys",
      journeySelect,
      "quotation_id",
      quotationIds
    ),
    loadRowsByIds<ClientWorkspaceJourneyLinkRow>(
      supabase,
      "campaign_client_journeys",
      journeySelect,
      "campaign_header_id",
      campaignHeaderIds
    ),
  ]);
  const journeysById = new Map<string, ClientWorkspaceJourneyLinkRow>();
  for (const row of journeyBatches.flat()) journeysById.set(row.id, row);
  const journeys = [...journeysById.values()];
  const journeyIds = journeys.map((row) => row.id);

  const reviewBatches = await Promise.all([
    loadRowsByIds<ClientWorkspaceReviewLinkRow>(
      supabase,
      "campaign_client_reviews",
      reviewSelect,
      "journey_id",
      journeyIds
    ),
    loadRowsByIds<ClientWorkspaceReviewLinkRow>(
      supabase,
      "campaign_client_reviews",
      reviewSelect,
      "shortlist_id",
      shortlistIds
    ),
    loadRowsByIds<ClientWorkspaceReviewLinkRow>(
      supabase,
      "campaign_client_reviews",
      reviewSelect,
      "quotation_id",
      quotationIds
    ),
    loadRowsByIds<ClientWorkspaceReviewLinkRow>(
      supabase,
      "campaign_client_reviews",
      reviewSelect,
      "campaign_header_id",
      campaignHeaderIds
    ),
  ]);
  const reviewsById = new Map<string, ClientWorkspaceReviewLinkRow>();
  for (const row of reviewBatches.flat()) reviewsById.set(row.id, row);

  const index = indexClientWorkspaceListLinks({
    journeys,
    reviews: [...reviewsById.values()],
  });
  propagateClientWorkspaceListLinks(index, related.subjects);
  return index;
}

export function resolveLoadedClientWorkspaceListLink(
  index: Awaited<ReturnType<typeof loadClientWorkspaceListLinks>>,
  subject: {
    shortlistId?: string | null;
    quotationId?: string | null;
    campaignHeaderId?: string | null;
  }
): ClientWorkspaceListLink | undefined {
  return clientWorkspaceListLinkForSubject(index, subject);
}
