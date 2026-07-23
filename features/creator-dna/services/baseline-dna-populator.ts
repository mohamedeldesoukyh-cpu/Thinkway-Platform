/**
 * Mandatory Creator DNA baseline — reads existing DB data, writes via mergeEvidence() only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { CreatorDNAService } from "./creator-dna-service";
import {
  mapBaselineToFieldCandidates,
  type BaselineInfluencerRow,
  type BaselineIplSnapshotRow,
  type BaselinePlatformAccountRow,
  type BaselineAiScoreRow,
} from "./baseline-dna-mapper";
import type { DnaIntelligenceSource } from "../types";
import { CreatorDnaMandatoryError } from "../types";

type AnySupabase = SupabaseClient;

export type EnsureBaselineDnaOptions = {
  /** True when creator was imported via Discovery Import Center. */
  isImport?: boolean;
  intelligenceSource?: DnaIntelligenceSource;
  /** Fail if merge does not succeed — required for creator creation paths. */
  mandatory?: boolean;
};

export type EnsureBaselineDnaResult = {
  ok: boolean;
  changedFields: string[];
  message: string;
  created: boolean;
};

const INFLUENCER_SELECT =
  "id, display_name, status, country_code, country_codes, languages, categories, email, phone, rate_card, exclusivity, thinkway_score, profile_id, primary_avatar_url, default_metrics_platform_account_id, audience_age_13_17, audience_age_18_24, audience_age_25_34, audience_age_35_44, audience_age_45_54, audience_age_55_plus, audience_gender_male, audience_gender_female, audience_top_countries, audience_top_cities, demographic_source, metadata";

const ACCOUNT_SELECT =
  "id, influencer_id, platform, handle, username, profile_url, profile_display_name, profile_picture_url, profile_bio, follower_count, following_count, posts_count, engagement_rate, avg_likes, avg_comments, avg_views, audience_country, is_verified, hashtags, mentions, interest_categories, contact_email, contact_phone, contact_links, recent_publications, field_sources, metrics_source, sync_status, metrics_is_manual_override";

async function loadBaselineContext(supabase: AnySupabase, influencerId: string) {
  const [
    influencerResult,
    accountsResult,
    sourcesResult,
    campaignResult,
    snapshotsResult,
  ] = await Promise.all([
    supabase.from("influencers").select(INFLUENCER_SELECT).eq("id", influencerId).maybeSingle(),
    supabase.from("influencer_platform_accounts").select(ACCOUNT_SELECT).eq("influencer_id", influencerId),
    supabase
      .from("creator_sources")
      .select("id", { count: "exact", head: true })
      .eq("influencer_id", influencerId),
    supabase
      .from("campaign_influencers")
      .select("id", { count: "exact", head: true })
      .eq("influencer_id", influencerId),
    supabase
      .from("ipl_snapshots")
      .select("id, platform_account_id, normalized_snapshot, snapshot_version, fetched_at")
      .eq("influencer_id", influencerId)
      .eq("is_latest", true)
      .order("fetched_at", { ascending: false }),
  ]);

  if (influencerResult.error) throw new Error(influencerResult.error.message);
  if (!influencerResult.data) {
    return null;
  }

  if (accountsResult.error) throw new Error(accountsResult.error.message);
  if (snapshotsResult.error) throw new Error(snapshotsResult.error.message);

  const influencer = influencerResult.data as BaselineInfluencerRow;
  const accounts = (accountsResult.data ?? []) as BaselinePlatformAccountRow[];
  const snapshots = (snapshotsResult.data ?? []) as BaselineIplSnapshotRow[];

  let aiScore: BaselineAiScoreRow | null = null;
  if (influencer.profile_id) {
    const { data: aiRows, error: aiError } = await supabase
      .from("profile_ai_scores")
      .select("category, niche, brand_fit_score, content_quality_score")
      .eq("profile_id", influencer.profile_id)
      .order("scored_at", { ascending: false })
      .limit(1);

    if (aiError) throw new Error(aiError.message);
    aiScore = (aiRows?.[0] as BaselineAiScoreRow | undefined) ?? null;
  }

  const brandCategories: string[] = [];
  if ((campaignResult.count ?? 0) > 0) {
    const { data: assignmentRows, error: assignmentError } = await supabase
      .from("campaign_influencers")
      .select("campaign_header_id")
      .eq("influencer_id", influencerId)
      .limit(50);

    if (assignmentError) throw new Error(assignmentError.message);

    const headerIds = [
      ...new Set(
        (assignmentRows ?? [])
          .map((row) => (row as { campaign_header_id?: string | null }).campaign_header_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];

    if (headerIds.length > 0) {
      const { data: headers, error: headerError } = await supabase
        .from("campaign_headers")
        .select("brand_id")
        .in("id", headerIds);

      if (headerError) throw new Error(headerError.message);

      const brandIds = [
        ...new Set(
          (headers ?? [])
            .map((row) => (row as { brand_id?: string | null }).brand_id)
            .filter((id): id is string => Boolean(id))
        ),
      ];

      if (brandIds.length > 0) {
        const { data: brands, error: brandError } = await supabase
          .from("brands")
          .select("category_id")
          .in("id", brandIds);

        if (brandError) throw new Error(brandError.message);

        const categoryIds = [
          ...new Set(
            (brands ?? [])
              .map((row) => (row as { category_id?: string | null }).category_id)
              .filter((id): id is string => Boolean(id))
          ),
        ];

        if (categoryIds.length > 0) {
          const { data: categories, error: categoryError } = await supabase
            .from("md_categories")
            .select("name")
            .in("id", categoryIds);

          if (categoryError) throw new Error(categoryError.message);

          for (const category of categories ?? []) {
            const name = (category as { name?: string | null }).name;
            if (name?.trim()) brandCategories.push(name.trim());
          }
        }
      }
    }
  }

  return {
    influencer,
    accounts,
    snapshots,
    aiScore,
    campaignCount: campaignResult.count ?? 0,
    brandCategories: [...new Set(brandCategories)],
    isImport: (sourcesResult.count ?? 0) > 0,
    hasEnrichmentSnapshot: snapshots.length > 0,
  };
}

/** Merge baseline intelligence into canonical Creator DNA (idempotent). */
export async function ensureCreatorBaselineDna(
  supabase: AnySupabase,
  influencerId: string,
  options?: EnsureBaselineDnaOptions
): Promise<EnsureBaselineDnaResult> {
  const service = new CreatorDNAService(supabase);
  const existing = await service.getCreatorDNA(influencerId);
  const context = await loadBaselineContext(supabase, influencerId);

  if (!context) {
    const message = `Influencer not found: ${influencerId}`;
    if (options?.mandatory) {
      throw new CreatorDnaMandatoryError(influencerId, message);
    }
    return { ok: false, changedFields: [], message, created: false };
  }

  const mergedAt = new Date().toISOString();
  const isImport = options?.isImport ?? context.isImport;
  const fields = mapBaselineToFieldCandidates({
    influencer: context.influencer,
    accounts: context.accounts,
    aiScore: context.aiScore,
    campaignCount: context.campaignCount,
    brandCategories: context.brandCategories,
    snapshots: context.snapshots,
    mergedAt,
  });

  const primarySnapshot = context.snapshots[0] ?? null;
  const result = await service.mergeEvidence(influencerId, {
    snapshotId: primarySnapshot?.id ?? null,
    fields,
    changeReason: "baseline_population",
    eventType: "baseline_population",
    intelligenceSource: options?.intelligenceSource ?? "baseline_import",
    enrichedAt: mergedAt,
    ensureRow: true,
    platformAccountIds: context.accounts.map((account) => account.id),
    lifecycleContext: {
      influencerStatus: context.influencer.status,
      isImport,
      hasCampaignHistory: context.campaignCount > 0,
      hasEnrichmentSnapshot: context.hasEnrichmentSnapshot,
    },
  });

  if (!result.ok && options?.mandatory) {
    throw new CreatorDnaMandatoryError(
      influencerId,
      result.message || "Baseline Creator DNA merge failed."
    );
  }

  return {
    ok: result.ok,
    changedFields: result.changedFields,
    message: result.message,
    created: !existing,
  };
}

/** Mandatory variant — throws if Creator DNA cannot be established. */
export async function requireCreatorBaselineDna(
  supabase: AnySupabase,
  influencerId: string,
  options?: Omit<EnsureBaselineDnaOptions, "mandatory">
): Promise<EnsureBaselineDnaResult> {
  return ensureCreatorBaselineDna(supabase, influencerId, {
    ...options,
    mandatory: true,
  });
}
