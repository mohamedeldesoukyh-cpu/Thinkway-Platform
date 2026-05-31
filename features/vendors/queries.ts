import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  InfluencerPlatformAccountRow,
  InfluencerRow,
  InfluencerStatus,
  VendorCampaignAssignment,
  VendorDetail,
  VendorListItem,
} from "@/types/database";

import { VENDORS_PAGE_SIZE } from "./constants";

export type VendorsListResult = {
  vendors: VendorListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type VendorListFilters = {
  page?: number;
  search?: string;
  status?: InfluencerStatus;
  platform?: string;
};

function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\,]/g, "\\$&");
}

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  if (!user) {
    throw new Error("You must be signed in to continue.");
  }

  return { supabase, user };
}

export async function getVendorsList(
  params: VendorListFilters
): Promise<VendorsListResult> {
  const page = Math.max(1, params.page ?? 1);
  const search = params.search?.trim() ?? "";
  const status = params.status;
  const platform = params.platform?.trim() ?? "";
  const from = (page - 1) * VENDORS_PAGE_SIZE;
  const to = from + VENDORS_PAGE_SIZE - 1;

  const { supabase } = await requireUser();

  if (platform) {
    const { data: platformMatches, error: platformError } = await supabase
      .from("influencer_platform_accounts")
      .select("influencer_id")
      .eq("platform", platform);

    if (platformError) {
      throw new Error(platformError.message);
    }

    const influencerIds = [
      ...new Set(platformMatches?.map((row) => row.influencer_id) ?? []),
    ];

    if (influencerIds.length === 0) {
      return {
        vendors: [],
        total: 0,
        page,
        pageSize: VENDORS_PAGE_SIZE,
        totalPages: 1,
      };
    }

    let query = supabase
      .from("influencers")
      .select(
        `
        *,
        platform_accounts:influencer_platform_accounts(
          id,
          platform,
          handle,
          follower_count,
          is_primary
        )
      `,
        { count: "exact" }
      )
      .in("id", influencerIds)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    if (search) {
      const pattern = `%${escapeIlikePattern(search)}%`;
      query = query.or(
        [
          `display_name.ilike.${pattern}`,
          `legal_name.ilike.${pattern}`,
          `document_number.ilike.${pattern}`,
          `email.ilike.${pattern}`,
        ].join(",")
      );
    }

    const { data, error, count } = await query.range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    const total = count ?? 0;

    return {
      vendors: (data ?? []) as VendorListItem[],
      total,
      page,
      pageSize: VENDORS_PAGE_SIZE,
      totalPages: Math.max(1, Math.ceil(total / VENDORS_PAGE_SIZE)),
    };
  }

  let query = supabase
    .from("influencers")
    .select(
      `
      *,
      platform_accounts:influencer_platform_accounts(
        id,
        platform,
        handle,
        follower_count,
        is_primary
      )
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  if (search) {
    const pattern = `%${escapeIlikePattern(search)}%`;
    query = query.or(
      [
        `display_name.ilike.${pattern}`,
        `legal_name.ilike.${pattern}`,
        `document_number.ilike.${pattern}`,
        `email.ilike.${pattern}`,
      ].join(",")
    );
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  const total = count ?? 0;

  return {
    vendors: (data ?? []) as VendorListItem[],
    total,
    page,
    pageSize: VENDORS_PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / VENDORS_PAGE_SIZE)),
  };
}

export async function getVendorById(id: string): Promise<VendorDetail | null> {
  const { supabase } = await requireUser();

  const { data: vendor, error } = await supabase
    .from("influencers")
    .select(
      `
      *,
      platform_accounts:influencer_platform_accounts(
        id,
        platform,
        handle,
        username,
        profile_url,
        follower_count,
        engagement_rate,
        avg_views,
        audience_country,
        audience_gender_split,
        is_verified,
        is_primary,
        created_at,
        updated_at
      )
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!vendor) {
    return null;
  }

  const { data: documents, error: documentsError } = await supabase
    .from("influencer_documents")
    .select("*")
    .eq("influencer_id", id)
    .order("created_at", { ascending: false });

  if (documentsError) {
    throw new Error(documentsError.message);
  }

  const { data: assignments, error: assignmentsError } = await supabase
    .from("campaign_influencers")
    .select(
      `
      id,
      status,
      agreed_fee,
      currency,
      invited_at,
      confirmed_at,
      campaign:campaigns(id, name, document_number, status)
    `
    )
    .eq("influencer_id", id)
    .order("created_at", { ascending: false });

  if (assignmentsError) {
    throw new Error(assignmentsError.message);
  }

  const vendorRow = vendor as InfluencerRow & {
    platform_accounts?: InfluencerPlatformAccountRow[];
  };

  return {
    ...vendorRow,
    platform_accounts: vendorRow.platform_accounts ?? [],
    campaign_assignments: (assignments ?? []) as VendorCampaignAssignment[],
    documents: documents ?? [],
  };
}
