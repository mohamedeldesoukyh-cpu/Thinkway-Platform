import type { SupabaseClient } from "@supabase/supabase-js";

import { DEFAULT_PLATFORM_CURRENCY } from "@/lib/master-data/default-currency";
import {
  resolveVatRateForCountry,
  resolveVendorDefaultVatPercent,
} from "@/lib/vat/queries";
import type {
  CreatorBrowseFilters,
  CreatorBrowseResult,
  InfluencerAssignmentProfile,
  InfluencerSearchResult,
} from "@/lib/domains/creator/types";

import {
  suggestCostFromRateCard,
  suggestCurrencyFromPaymentDetails,
} from "@/lib/campaigns/line-assignment";
import { escapeIlikePattern } from "../campaign-commercial";

const INFLUENCER_PLATFORM_ACCOUNT_SELECT =
  "id, influencer_id, platform, handle, profile_url, follower_count, engagement_rate, audience_country";

export async function fetchInfluencerForLine(
  supabase: SupabaseClient,
  influencerId: string
) {
  return supabase
    .from("influencers")
    .select(
      "id, document_number, display_name, vat_registered, default_vat_percent, country_code"
    )
    .eq("id", influencerId)
    .maybeSingle();
}

export async function fetchInfluencerPlatformAccounts(
  supabase: SupabaseClient,
  influencerId: string
) {
  return supabase
    .from("influencer_platform_accounts")
    .select(
      "id, platform, handle, profile_url, follower_count, engagement_rate, audience_country"
    )
    .eq("influencer_id", influencerId);
}

export async function deleteLegacyDeliverablesForAssignment(
  supabase: SupabaseClient,
  input: {
    assignmentId: string | null;
    campaignId: string;
    influencerId: string;
  }
) {
  if (input.assignmentId) {
    return supabase
      .from("deliverables")
      .delete()
      .eq("campaign_influencer_id", input.assignmentId);
  }
  return supabase
    .from("deliverables")
    .delete()
    .eq("campaign_id", input.campaignId)
    .eq("influencer_id", input.influencerId);
}

export async function insertLegacyDeliverablesForPlatforms(
  supabase: SupabaseClient,
  userId: string,
  input: {
    campaignId: string;
    influencerId: string;
    assignmentId: string | null;
    platforms: Array<{ platform: string; handle: string; deliverables: string[] }>;
    dueDate: string | null;
  }
) {
  let sort = 0;
  for (const platform of input.platforms) {
    for (const deliverableType of platform.deliverables) {
      sort += 1;
      const { error } = await supabase.from("deliverables").insert({
        document_number: `DEL-${Date.now()}-${sort}`,
        campaign_id: input.campaignId,
        influencer_id: input.influencerId,
        campaign_influencer_id: input.assignmentId,
        deliverable_type: deliverableType,
        title: `${platform.handle} — ${deliverableType.replace(/_/g, " ")}`,
        platform: platform.platform,
        due_date: input.dueDate,
        status: "pending",
        created_by: userId,
      });
      if (error) {
        throw new Error(error.message);
      }
    }
  }
}

export async function insertDeliverable(
  supabase: SupabaseClient,
  payload: Record<string, unknown>
) {
  return supabase.from("deliverables").insert(payload);
}

export async function updateDeliverableStatus(
  supabase: SupabaseClient,
  deliverableId: string,
  payload: Record<string, unknown>
) {
  return supabase.from("deliverables").update(payload).eq("id", deliverableId);
}

export async function searchInfluencers(
  supabase: SupabaseClient,
  params: { search?: string; platform?: string; limit?: number }
): Promise<InfluencerSearchResult[]> {
  const search = params.search?.trim() ?? "";
  const platform = params.platform?.trim() ?? "";
  const limit = params.limit ?? 20;

  let influencerIds: string[] | null = null;

  if (platform) {
    const { data: platformMatches, error } = await supabase
      .from("influencer_platform_accounts")
      .select("influencer_id")
      .eq("platform", platform);

    if (error) {
      throw new Error(error.message);
    }

    influencerIds = [...new Set(platformMatches?.map((r) => r.influencer_id) ?? [])];
    if (influencerIds.length === 0) {
      return [];
    }
  }

  let query = supabase
    .from("influencers")
    .select("id, document_number, display_name, status, country_code, rate_card, payment_details")
    .eq("status", "active")
    .order("display_name")
    .limit(limit);

  if (search) {
    const pattern = `%${escapeIlikePattern(search)}%`;
    query = query.or(
      [`display_name.ilike.${pattern}`, `document_number.ilike.${pattern}`].join(",")
    );
  }

  if (influencerIds) {
    query = query.in("id", influencerIds);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const ids = (data ?? []).map((r) => r.id);
  if (ids.length === 0) {
    return [];
  }

  const { data: accounts } = await supabase
    .from("influencer_platform_accounts")
    .select(INFLUENCER_PLATFORM_ACCOUNT_SELECT)
    .in("influencer_id", ids);

  const accountsByInfluencer = new Map<string, InfluencerSearchResult["platforms"]>();
  for (const account of accounts ?? []) {
    const list = accountsByInfluencer.get(account.influencer_id) ?? [];
    list.push({
      id: account.id,
      platform: account.platform,
      handle: account.handle,
      profile_url: account.profile_url,
      follower_count: account.follower_count,
      engagement_rate: account.engagement_rate,
      audience_country: account.audience_country ?? null,
    });
    accountsByInfluencer.set(account.influencer_id, list);
  }

  return (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      document_number: string;
      display_name: string;
      status: string;
      country_code: string | null;
      rate_card: Record<string, unknown>;
      payment_details: Record<string, unknown>;
    };
    return {
      id: r.id,
      document_number: r.document_number,
      display_name: r.display_name,
      status: r.status,
      country_code: r.country_code,
      suggested_currency: suggestCurrencyFromPaymentDetails(
        r.payment_details,
        DEFAULT_PLATFORM_CURRENCY
      ),
      platforms: accountsByInfluencer.get(r.id) ?? [],
    };
  });
}

export async function getInfluencerAssignmentProfile(
  supabase: SupabaseClient,
  influencerId: string
): Promise<InfluencerAssignmentProfile | null> {
  const { data: influencer, error } = await supabase
    .from("influencers")
    .select(
      "id, document_number, display_name, status, country_code, rate_card, payment_details, vat_registered, default_vat_percent, tax_registration_number, notes"
    )
    .eq("id", influencerId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!influencer) return null;

  const { data: accounts } = await supabase
    .from("influencer_platform_accounts")
    .select(
      "id, platform, handle, profile_url, follower_count, engagement_rate, audience_country"
    )
    .eq("influencer_id", influencerId)
    .order("is_primary", { ascending: false });

  const platforms = (accounts ?? []).map((a) => ({
    id: a.id,
    platform: a.platform,
    handle: a.handle,
    profile_url: a.profile_url,
    follower_count: a.follower_count,
    engagement_rate: a.engagement_rate,
    audience_country: a.audience_country ?? null,
  }));

  const inf = influencer as unknown as {
    id: string;
    document_number: string;
    display_name: string;
    status: string;
    country_code: string | null;
    rate_card: Record<string, unknown>;
    payment_details: Record<string, unknown>;
    vat_registered: boolean;
    default_vat_percent: number;
    tax_registration_number: string | null;
    notes: string | null;
  };

  const suggested_currency = suggestCurrencyFromPaymentDetails(
    inf.payment_details,
    DEFAULT_PLATFORM_CURRENCY
  );
  const countryVatRate = await resolveVatRateForCountry(supabase, inf.country_code);
  const suggested_cost_vat_percent = resolveVendorDefaultVatPercent({
    vatRegistered: inf.vat_registered,
    defaultVatPercent: Number(inf.default_vat_percent ?? 0),
    countryCode: inf.country_code,
    countryVatRate,
  });

  return {
    id: inf.id,
    document_number: inf.document_number,
    display_name: inf.display_name,
    status: inf.status,
    country_code: inf.country_code,
    suggested_currency,
    platforms,
    rate_card: inf.rate_card,
    payment_details: inf.payment_details,
    suggested_cost: suggestCostFromRateCard(inf.rate_card, []),
    vat_registered: inf.vat_registered,
    default_vat_percent: Number(inf.default_vat_percent ?? 0),
    tax_registration_number: inf.tax_registration_number,
    notes: inf.notes,
    suggested_cost_vat_percent,
  };
}

export async function browseInfluencers(
  supabase: SupabaseClient,
  params: CreatorBrowseFilters
): Promise<CreatorBrowseResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, params.pageSize ?? 20);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const search = params.search?.trim() ?? "";
  const platform = params.platform?.trim() ?? "";
  const country = params.country?.trim().toUpperCase() ?? "";
  const category = params.category?.trim() ?? "";

  let influencerIds: string[] | null = null;

  if (
    platform ||
    params.minFollowers != null ||
    params.maxFollowers != null ||
    params.minEngagement != null
  ) {
    let accountQuery = supabase
      .from("influencer_platform_accounts")
      .select("influencer_id, follower_count, engagement_rate, handle, profile_url, platform");

    if (platform) {
      accountQuery = accountQuery.eq("platform", platform);
    }
    if (params.minFollowers != null) {
      accountQuery = accountQuery.gte("follower_count", params.minFollowers);
    }
    if (params.maxFollowers != null) {
      accountQuery = accountQuery.lte("follower_count", params.maxFollowers);
    }
    if (params.minEngagement != null) {
      accountQuery = accountQuery.gte("engagement_rate", params.minEngagement);
    }

    const { data: platformMatches, error: platformError } = await accountQuery;
    if (platformError) throw new Error(platformError.message);

    let ids = [...new Set(platformMatches?.map((r) => r.influencer_id) ?? [])];

    if (search) {
      const pattern = `%${escapeIlikePattern(search)}%`;
      const handleMatches = (platformMatches ?? []).filter(
        (a) =>
          a.handle?.toLowerCase().includes(search.toLowerCase()) ||
          a.profile_url?.toLowerCase().includes(search.toLowerCase())
      );
      const handleIds = new Set(handleMatches.map((a) => a.influencer_id));

      const { data: nameMatches } = await supabase
        .from("influencers")
        .select("id")
        .eq("status", "active")
        .or(
          [`display_name.ilike.${pattern}`, `document_number.ilike.${pattern}`].join(",")
        );

      const nameIds = new Set(nameMatches?.map((r) => r.id) ?? []);
      ids = ids.filter((id) => handleIds.has(id) || nameIds.has(id));
      for (const id of nameIds) {
        if (!ids.includes(id)) ids.push(id);
      }
    }

    influencerIds = ids;
    if (influencerIds.length === 0) {
      return { creators: [], total: 0, page, pageSize };
    }
  }

  let query = supabase
    .from("influencers")
    .select(
      "id, document_number, display_name, status, country_code, categories, notes, rate_card, payment_details",
      { count: "exact" }
    )
    .eq("status", "active")
    .order("display_name");

  if (country) {
    query = query.eq("country_code", country);
  }

  if (category) {
    query = query.contains("categories", [category]);
  }

  if (search && !platform && params.minFollowers == null && params.maxFollowers == null) {
    const pattern = `%${escapeIlikePattern(search)}%`;
    query = query.or(
      [`display_name.ilike.${pattern}`, `document_number.ilike.${pattern}`].join(",")
    );
  }

  if (influencerIds) {
    query = query.in("id", influencerIds);
  }

  const { data, error, count } = await query.range(from, to);
  if (error) throw new Error(error.message);

  const ids = (data ?? []).map((r) => r.id);
  if (ids.length === 0) {
    return { creators: [], total: count ?? 0, page, pageSize };
  }

  const { data: accounts } = await supabase
    .from("influencer_platform_accounts")
    .select(
      "id, influencer_id, platform, handle, profile_url, follower_count, engagement_rate, audience_country, is_verified, is_primary"
    )
    .in("influencer_id", ids)
    .order("is_primary", { ascending: false });

  const accountsByInfluencer = new Map<string, InfluencerSearchResult["platforms"]>();
  for (const account of accounts ?? []) {
    const list = accountsByInfluencer.get(account.influencer_id) ?? [];
    list.push({
      id: account.id,
      platform: account.platform,
      handle: account.handle,
      profile_url: account.profile_url,
      follower_count: account.follower_count,
      engagement_rate: account.engagement_rate,
      audience_country: account.audience_country ?? null,
      is_verified: account.is_verified ?? false,
    });
    accountsByInfluencer.set(account.influencer_id, list);
  }

  const creators: InfluencerSearchResult[] = (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      document_number: string;
      display_name: string;
      status: string;
      country_code: string | null;
      categories: string[];
      notes: string | null;
      rate_card: Record<string, unknown>;
      payment_details: Record<string, unknown>;
    };
    return {
      id: r.id,
      document_number: r.document_number,
      display_name: r.display_name,
      status: r.status,
      country_code: r.country_code,
      categories: r.categories ?? [],
      notes: r.notes,
      suggested_currency: suggestCurrencyFromPaymentDetails(
        r.payment_details,
        DEFAULT_PLATFORM_CURRENCY
      ),
      platforms: accountsByInfluencer.get(r.id) ?? [],
    };
  });

  return {
    creators,
    total: count ?? creators.length,
    page,
    pageSize,
  };
}
