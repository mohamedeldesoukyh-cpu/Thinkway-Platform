import type { SupabaseClient } from "@supabase/supabase-js";

import {
  fetchApifyProfileRaw,
  normalizeApifyProfileData,
} from "@/lib/creator-enrichment/apify-profile";
import { resolveNextPrimaryAvatar } from "@/lib/creator-enrichment/enrichment-avatar-policy";
import { syncEnrichmentAvatarToStorage } from "@/lib/creator-enrichment/enrichment-avatar-storage";
import type { ApifyProfileData } from "@/lib/creator-enrichment/types";
import {
  inferCategoriesFromProfileSignals,
  mergeInferredCategories,
} from "@/lib/creator-enrichment/category-inference";
import {
  countryWritePayload,
  persistCountryFromApifyProfile,
} from "@/lib/creators/country-persistence";
import { fetchProfileWithIpl, getProviderAdapter, persistSnapshot } from "@/lib/intelligence-persistence";
import { bridgeSnapshotToCreatorDna } from "@/lib/intelligence-persistence/services/dna-bridge";
import { isDnaGenerateAfterImportEnabled } from "@/lib/discovery/control-center/discovery-control-policy";
import { getDiscoveryControlSettings } from "@/lib/discovery/control-center/discovery-control-service";
import type { RawProviderPayload } from "@/lib/intelligence-persistence/types";
import { dedupeByCreatorId } from "@/lib/creators/dedupe-creators";
import { normalizeSocialPlatform } from "@/lib/social/normalize-platform";
import { buildCanonicalProfileUrl, isSocialPlatform } from "@/lib/social/platforms";
import { buildNormalizedPlatformAccount } from "@/lib/social/normalize-account";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import {
  backfillInstagramProfileRowsForImport,
  shouldBackfillInstagramProfileDetails,
} from "@/lib/discovery/apify-import-profile-backfill";
import {
  createApifyImportTransactionState,
  rollbackApifyImportTransaction,
} from "@/lib/discovery/apify-import-transaction";
import {
  hasUsableFollowerCount,
  resolveOfflineImportEnrichmentStatus,
} from "@/lib/discovery/enrichment-staging";
import type { CreatorEnrichmentStatus } from "@/lib/creator-enrichment/types";

export type ApifyImportPipelineInput = {
  platform: string;
  username: string;
  profileUrl?: string | null;
  countryCode?: string | null;
  categoryTags?: string[];
  searchId?: string;
};

export type ApifyImportPipelineResult = {
  ok: boolean;
  discoveredProfileId?: string;
  influencerId?: string | null;
  platformAccountId?: string;
  snapshotId?: string;
  merged: boolean;
  message: string;
};

export type ApifyStoredPayloadImportInput = ApifyImportPipelineInput & {
  profileRows: Record<string, unknown>[];
  postRows?: Record<string, unknown>[];
  apifyRunId?: string | null;
  detailsRunId?: string | null;
  postsRunId?: string | null;
  /** Download profilePictureUrl into Supabase storage (no Apify call). */
  uploadAvatar?: boolean;
  /**
   * When true, may launch a live Instagram profile-details Apify run for post-only
   * rows. Default false — dataset/batch imports must not N+1 scrape every creator.
   */
  allowLiveApifyBackfill?: boolean;
};

function normalizeUsername(value: string): string {
  return value.replace(/^@+/, "").trim().toLowerCase();
}

async function findExistingDiscoveredProfile(
  supabase: SupabaseClient,
  platform: string,
  username: string
): Promise<{ id: string; influencer_id: string | null } | null> {
  const { data, error } = await supabase
    .from("discovered_profiles")
    .select("id, influencer_id")
    .eq("platform", platform)
    .eq("username", username)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as { id: string; influencer_id: string | null } | null;
}

async function findExistingInfluencerByHandle(
  supabase: SupabaseClient,
  platform: string,
  username: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("influencer_platform_accounts")
    .select("influencer_id")
    .eq("platform", platform)
    .eq("normalized_username", username)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.influencer_id ?? null;
}

async function findExistingPlatformAccount(
  supabase: SupabaseClient,
  platform: string,
  username: string
): Promise<{ id: string; influencer_id: string } | null> {
  const platformKey = normalizeSocialPlatform(platform);
  if (!platformKey) return null;

  // Case-insensitive platform match — DB may still have "Snapchat" until migration.
  const { data, error } = await supabase
    .from("influencer_platform_accounts")
    .select("id, influencer_id, platform")
    .eq("normalized_username", username);

  if (error) throw new Error(error.message);

  const match = (data ?? []).find(
    (row) => normalizeSocialPlatform(row.platform as string) === platformKey
  );
  return match
    ? { id: match.id as string, influencer_id: match.influencer_id as string }
    : null;
}

function resolveApifyImportCountryFields(
  normalized: ApifyProfileData,
  username: string,
  existing?: { country_code?: string | null; country_codes?: string[] | null }
) {
  return persistCountryFromApifyProfile({
    existingCountryCode: existing?.country_code,
    existingCountryCodes: existing?.country_codes,
    audienceCountry: normalized.audienceCountry,
    bio: normalized.bio,
    displayName: normalized.displayName,
    handle: username,
    hashtags: normalized.hashtags,
    mentions: normalized.mentions,
  });
}

function resolveImportEnrichmentStatus(input: {
  platform: string;
  normalized: ApifyProfileData;
  profileRowsCount: number;
  importCountryCode?: string | null;
  countryFields: ReturnType<typeof resolveApifyImportCountryFields>;
}): CreatorEnrichmentStatus {
  const profileDetailsSatisfied =
    input.profileRowsCount > 0 || hasUsableFollowerCount(input.normalized.followers);

  return resolveOfflineImportEnrichmentStatus({
    platform: input.platform,
    followers: input.normalized.followers,
    audienceCountry: input.normalized.audienceCountry,
    countryCode: input.countryFields?.country_code ?? null,
    countryCodes: input.countryFields?.country_codes ?? null,
    importCountryCode: input.importCountryCode,
    profileDetailsSatisfied,
  });
}

/**
 * Identity-only Apify upsert (L1). Never writes Commercial Creator CRM.
 * Exported for `lib/creators/identity` boundary; never writes creator_crm_profiles.
 */
export async function ensureIdentityCreatorFromApifyData(
  supabase: SupabaseClient,
  platform: string,
  normalized: ApifyProfileData,
  options: {
    profileRowsCount: number;
    importCountryCode?: string | null;
  }
): Promise<{
  influencerId: string;
  platformAccountId: string;
  created: boolean;
  enrichmentStatus: CreatorEnrichmentStatus;
}> {
  const username = normalizeUsername(normalized.username ?? "");
  if (!username) {
    throw new Error("Normalized profile is missing username.");
  }

  const accountFields = buildNormalizedPlatformAccount({
    platform,
    username,
    profile_url: normalized.profileUrl,
    follower_count: normalized.followers,
    following_count: normalized.following,
    engagement_rate: normalized.engagementRate,
    avg_views: normalized.avgViews,
    profile_display_name: normalized.displayName,
    profile_bio: normalized.bio,
    profile_picture_url: normalized.profilePictureUrl,
    is_verified: normalized.isVerified ?? false,
    sync_status: "synced",
    sync_source: "apify",
    last_synced_at: new Date().toISOString(),
    metrics_source: "synced",
    metrics_last_synced_at: new Date().toISOString(),
  });

  const inferredCategories = mergeInferredCategories(
    normalized.categories,
    inferCategoriesFromProfileSignals({
      bio: normalized.bio,
      hashtags: normalized.hashtags,
      mentions: normalized.mentions,
      extraTerms: normalized.categories,
      displayName: normalized.displayName,
      handle: username,
    })
  );

  const existingAccount = await findExistingPlatformAccount(supabase, platform, username);
  const nowIso = new Date().toISOString();

  if (existingAccount) {
    const { data: influencer } = await supabase
      .from("influencers")
      .select("categories, country_code, country_codes")
      .eq("id", existingAccount.influencer_id)
      .maybeSingle();

    const countryFields = resolveApifyImportCountryFields(
      normalized,
      username,
      (influencer as { country_code?: string | null; country_codes?: string[] | null } | null) ??
        undefined
    );
    const enrichmentStatus = resolveImportEnrichmentStatus({
      platform,
      normalized,
      profileRowsCount: options.profileRowsCount,
      importCountryCode: options.importCountryCode,
      countryFields,
    });

    const { error: accountError } = await supabase
      .from("influencer_platform_accounts")
      .update({
        // Heal mixed-case platforms ("Snapchat" → "snapchat") on successful sync.
        platform: accountFields.platform,
        handle: accountFields.handle,
        username: accountFields.username,
        profile_url: accountFields.profile_url,
        normalized_profile_url: accountFields.normalized_profile_url,
        profile_display_name: normalized.displayName,
        profile_bio: normalized.bio,
        profile_picture_url: normalized.profilePictureUrl,
        follower_count: normalized.followers,
        following_count: normalized.following,
        posts_count: normalized.postsCount,
        engagement_rate: normalized.engagementRate,
        avg_views: normalized.avgViews,
        avg_likes: normalized.avgLikes,
        avg_comments: normalized.avgComments,
        is_verified: normalized.isVerified ?? false,
        audience_country: normalized.audienceCountry,
        hashtags: normalized.hashtags.length > 0 ? normalized.hashtags : null,
        mentions: normalized.mentions.length > 0 ? normalized.mentions : null,
        interest_categories: inferredCategories.length > 0 ? inferredCategories : null,
        recent_publications:
          normalized.recentPublications.length > 0 ? normalized.recentPublications : null,
        contact_email: normalized.contactEmail,
        contact_phone: normalized.contactPhone,
        contact_links: normalized.contactLinks.length > 0 ? normalized.contactLinks : null,
        enrichment_status: enrichmentStatus,
        last_enriched_at: nowIso,
        apify_run_id: normalized.apifyRunId,
        sync_status: "synced",
        sync_source: "apify",
        last_synced_at: nowIso,
        metrics_source: "synced",
        metrics_last_synced_at: nowIso,
        updated_at: nowIso,
      } as never)
      .eq("id", existingAccount.id);

    if (accountError) throw new Error(accountError.message);

    const mergedCategories =
      inferredCategories.length > 0
        ? mergeInferredCategories(
            (influencer?.categories as string[] | null) ?? [],
            inferredCategories
          )
        : null;

    await supabase
      .from("influencers")
      .update({
        display_name: normalized.displayName ?? undefined,
        ...countryWritePayload(countryFields),
        ...(mergedCategories && mergedCategories.length > 0
          ? { categories: mergedCategories }
          : {}),
        enrichment_status: enrichmentStatus,
        last_enriched_at: nowIso,
        apify_run_id: normalized.apifyRunId ?? undefined,
        updated_at: nowIso,
      } as never)
      .eq("id", existingAccount.influencer_id);

    return {
      influencerId: existingAccount.influencer_id,
      platformAccountId: existingAccount.id,
      created: false,
      enrichmentStatus,
    };
  }

  const countryFields = resolveApifyImportCountryFields(normalized, username);
  const enrichmentStatus = resolveImportEnrichmentStatus({
    platform,
    normalized,
    profileRowsCount: options.profileRowsCount,
    importCountryCode: options.importCountryCode,
    countryFields,
  });

  const { data: influencer, error: influencerError } = await supabase
    .from("influencers")
    .insert({
      display_name: normalized.displayName ?? username,
      ...countryWritePayload(countryFields),
      categories: inferredCategories.length > 0 ? inferredCategories : [],
      status: "active",
      enrichment_status: enrichmentStatus,
      last_enriched_at: nowIso,
      apify_run_id: normalized.apifyRunId,
      notes: "Imported from Apify dataset export (offline)",
      metadata: { import_source: "apify_dataset_export" },
    } as never)
    .select("id")
    .single();

  if (influencerError) throw new Error(influencerError.message);

  const { data: account, error: accountError } = await supabase
    .from("influencer_platform_accounts")
    .insert({
      influencer_id: influencer.id,
      platform: accountFields.platform,
      handle: accountFields.handle,
      username: accountFields.username,
      normalized_username: accountFields.normalized_username,
      profile_url: accountFields.profile_url,
      normalized_profile_url: accountFields.normalized_profile_url,
      profile_display_name: normalized.displayName,
      profile_bio: normalized.bio,
      profile_picture_url: normalized.profilePictureUrl,
      follower_count: normalized.followers ?? 0,
      following_count: normalized.following,
      posts_count: normalized.postsCount,
      engagement_rate: normalized.engagementRate,
      avg_views: normalized.avgViews,
      avg_likes: normalized.avgLikes,
      avg_comments: normalized.avgComments,
      is_verified: normalized.isVerified ?? false,
      is_primary: true,
      audience_country: normalized.audienceCountry,
      hashtags: normalized.hashtags.length > 0 ? normalized.hashtags : null,
      mentions: normalized.mentions.length > 0 ? normalized.mentions : null,
      interest_categories: inferredCategories.length > 0 ? inferredCategories : null,
      recent_publications:
        normalized.recentPublications.length > 0 ? normalized.recentPublications : null,
      contact_email: normalized.contactEmail,
      contact_phone: normalized.contactPhone,
      contact_links: normalized.contactLinks.length > 0 ? normalized.contactLinks : null,
      enrichment_status: enrichmentStatus,
      last_enriched_at: nowIso,
      apify_run_id: normalized.apifyRunId,
      sync_status: "synced",
      sync_source: "apify",
      last_synced_at: nowIso,
      metrics_source: "synced",
      metrics_last_synced_at: nowIso,
    } as never)
    .select("id")
    .single();

  if (accountError) throw new Error(accountError.message);

  return {
    influencerId: influencer.id as string,
    platformAccountId: account.id as string,
    created: true,
    enrichmentStatus,
  };
}

async function finalizeImportedCreatorPresentation(
  supabase: SupabaseClient,
  input: {
    influencerId: string;
    platformAccountId: string;
    platform: string;
    username: string;
    normalized: ApifyProfileData;
    uploadAvatar: boolean;
    enrichmentStatus: CreatorEnrichmentStatus;
  }
): Promise<{ avatarUrlOverride: string | null }> {
  let primaryAvatarUrl = input.normalized.profilePictureUrl ?? null;
  let primaryAvatarSource: "imported" | "instagram" = primaryAvatarUrl ? "instagram" : "instagram";
  let avatarUrlOverride: string | null = null;

  if (input.uploadAvatar && primaryAvatarUrl) {
    const avatarResult = await syncEnrichmentAvatarToStorage(supabase, {
      influencerId: input.influencerId,
      platformAccountId: input.platformAccountId,
      platform: input.platform,
      username: input.username,
      providerAvatarUrl: primaryAvatarUrl,
    });
    if (avatarResult.uploaded) {
      primaryAvatarUrl = avatarResult.url;
      primaryAvatarSource = "imported";
      avatarUrlOverride = avatarResult.url;
    }
  }

  const { data: existingInfluencer } = await supabase
    .from("influencers")
    .select("primary_avatar_url, primary_avatar_source")
    .eq("id", input.influencerId)
    .maybeSingle();
  const existingRow = existingInfluencer as {
    primary_avatar_url?: string | null;
    primary_avatar_source?: string | null;
  } | null;

  // Merge rule: never null-out or downgrade a captured avatar with an import
  // that has no photo (or whose storage upload failed, leaving an expiring CDN URL).
  const nextPrimary = resolveNextPrimaryAvatar({
    existingUrl: existingRow?.primary_avatar_url,
    existingSource: existingRow?.primary_avatar_source,
    incomingUrl: primaryAvatarUrl,
    incomingSource: primaryAvatarSource,
  });

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("influencers")
    .update({
      default_metrics_platform_account_id: input.platformAccountId,
      primary_avatar_url: nextPrimary.url,
      primary_avatar_source: nextPrimary.source,
      // Preserve staged status from ensureIdentityCreatorFromApifyData —
      // never promote post-only imports to enriched here.
      enrichment_status: input.enrichmentStatus,
      last_enriched_at: nowIso,
      updated_at: nowIso,
    } as never)
    .eq("id", input.influencerId);

  if (error) throw new Error(error.message);

  return { avatarUrlOverride };
}

/**
 * Offline Apify import: ingest pre-fetched actor rows (file export or dataset read)
 * without launching new actor runs. Upserts identity creator rows, IPL snapshot, DNA.
 */
export async function importApifyStoredPayloadWithDnaPipeline(
  supabase: SupabaseClient,
  input: ApifyStoredPayloadImportInput
): Promise<ApifyImportPipelineResult> {
  const platform = canonicalPlatformKey(input.platform);
  const username = normalizeUsername(input.username);
  if (!platform || !username) {
    return { ok: false, merged: false, message: "Platform and username are required." };
  }

  const profileUrl =
    input.profileUrl?.trim() ||
    (isSocialPlatform(platform) ? buildCanonicalProfileUrl(platform, username) : null) ||
    null;

  if (!profileUrl) {
    return { ok: false, merged: false, message: "Profile URL could not be resolved." };
  }

  let profileRows = input.profileRows ?? [];
  let postRows = input.postRows ?? [];
  if (profileRows.length === 0 && postRows.length === 0) {
    return { ok: false, merged: false, message: "No Apify rows supplied for import." };
  }

  let apifyRunId = input.apifyRunId ?? null;

  let normalized = normalizeApifyProfileData({
    platformKey: platform,
    username,
    profileUrl,
    profileRows,
    postRows,
    apifyRunId,
  });

  if (
    input.allowLiveApifyBackfill === true &&
    shouldBackfillInstagramProfileDetails(platform, profileRows, postRows, normalized)
  ) {
    const backfilled = await backfillInstagramProfileRowsForImport({
      platform,
      username,
      profileUrl,
      postRows,
      apifyRunId,
    });
    if (backfilled?.normalized) {
      profileRows = backfilled.profileRows;
      postRows = backfilled.postRows;
      apifyRunId = backfilled.apifyRunId;
      normalized = backfilled.normalized;
    }
  }

  if (!normalized) {
    return { ok: false, merged: false, message: "Apify rows could not be normalized." };
  }

  const existingProfile = await findExistingDiscoveredProfile(supabase, platform, username);
  const existingAccount = await findExistingPlatformAccount(supabase, platform, username);
  const merged = Boolean(existingProfile || existingAccount);
  const tx = createApifyImportTransactionState();

  try {
    const identity = await ensureIdentityCreatorFromApifyData(supabase, platform, normalized, {
      profileRowsCount: profileRows.length,
      importCountryCode: input.countryCode,
    });
    tx.influencerId = identity.influencerId;
    tx.influencerCreated = identity.created;
    tx.platformAccountId = identity.platformAccountId;
    tx.platformAccountCreated = identity.created;

    let discoveredProfileId = existingProfile?.id ?? null;
    if (!discoveredProfileId) {
      const { data: inserted, error: insertError } = await supabase
        .from("discovered_profiles")
        .upsert(
          {
            platform,
            username,
            profile_url: profileUrl,
            country_code: input.countryCode ?? normalized.audienceCountry ?? null,
            category_tags: input.categoryTags ?? normalized.categories ?? [],
            stage: "discovered",
            influencer_id: identity.influencerId,
            metadata: {
              import_source: "apify_dataset_export",
              search_id: input.searchId ?? null,
            },
          },
          { onConflict: "platform,username" }
        )
        .select("id")
        .single();

      if (insertError) {
        await rollbackApifyImportTransaction(supabase, tx);
        return { ok: false, merged, message: insertError.message };
      }
      discoveredProfileId = inserted.id as string;
      tx.discoveredProfileId = discoveredProfileId;
      tx.discoveredProfileCreated = true;
    } else {
      const { error: updateError } = await supabase
        .from("discovered_profiles")
        .update({
          profile_url: profileUrl,
          influencer_id: identity.influencerId,
          country_code: input.countryCode ?? normalized.audienceCountry ?? undefined,
          category_tags: input.categoryTags?.length ? input.categoryTags : undefined,
          updated_at: new Date().toISOString(),
        })
        .eq("id", discoveredProfileId);

      if (updateError) {
        await rollbackApifyImportTransaction(supabase, tx);
        throw new Error(updateError.message);
      }
      tx.discoveredProfileId = discoveredProfileId;
    }

    const rawPayload: RawProviderPayload = {
      profileRows,
      postRows,
      apifyRunId,
      detailsRunId: input.detailsRunId ?? null,
      postsRunId: input.postsRunId ?? null,
      platformKey: platform,
      profileUrl,
      username,
    };

    const controlSettings = await getDiscoveryControlSettings(supabase);
    const generateDnaAfterImport = isDnaGenerateAfterImportEnabled(controlSettings);

    const snapshotId = await persistSnapshot(supabase, {
      provider: "apify",
      platform,
      profileUrl,
      influencerId: identity.influencerId,
      platformAccountId: identity.platformAccountId,
      discoveredProfileId,
      rawSnapshot: rawPayload,
      normalizedSnapshot: normalized,
      auditMetadata: {
        trigger: "apify_dataset_export",
        search_id: input.searchId ?? null,
      },
      awaitDnaBridge: false,
    });

    if (!snapshotId) {
      await rollbackApifyImportTransaction(supabase, tx);
      return {
        ok: false,
        merged,
        discoveredProfileId,
        influencerId: identity.influencerId,
        platformAccountId: identity.platformAccountId,
        message: "IPL snapshot persistence failed.",
      };
    }
    tx.snapshotId = snapshotId;

    const { avatarUrlOverride } = await finalizeImportedCreatorPresentation(supabase, {
      influencerId: identity.influencerId,
      platformAccountId: identity.platformAccountId,
      platform,
      username,
      normalized,
      uploadAvatar: input.uploadAvatar ?? true,
      enrichmentStatus: identity.enrichmentStatus,
    });

    if (generateDnaAfterImport) {
      const bridgeResult = await bridgeSnapshotToCreatorDna(supabase, snapshotId, {
        avatarUrlOverride,
      });
      if (!bridgeResult.ok) {
        await rollbackApifyImportTransaction(supabase, tx);
        return { ok: false, merged, message: bridgeResult.message };
      }
    }

    return {
      ok: true,
      merged: merged || !identity.created,
      discoveredProfileId,
      influencerId: identity.influencerId,
      platformAccountId: identity.platformAccountId,
      snapshotId,
      message: identity.created
        ? "Imported new creator from stored Apify payload."
        : "Merged stored Apify payload.",
    };
  } catch (error) {
    await rollbackApifyImportTransaction(supabase, tx);
    throw error;
  }
}

/**
 * Apify import path: Normalize → Dedupe → IPL snapshot → DNA bridge → persist.
 * Never bypasses DNA on the import path.
 */
export async function importApifyProfileWithDnaPipeline(
  supabase: SupabaseClient,
  input: ApifyImportPipelineInput
): Promise<ApifyImportPipelineResult> {
  const platform = canonicalPlatformKey(input.platform);
  const username = normalizeUsername(input.username);
  if (!platform || !username) {
    return { ok: false, merged: false, message: "Platform and username are required." };
  }

  const profileUrl =
    input.profileUrl?.trim() ||
    (isSocialPlatform(platform) ? buildCanonicalProfileUrl(platform, username) : null) ||
    null;

  const existingProfile = await findExistingDiscoveredProfile(supabase, platform, username);
  const existingInfluencerId =
    existingProfile?.influencer_id ??
    (await findExistingInfluencerByHandle(supabase, platform, username));

  const controlSettings = await getDiscoveryControlSettings(supabase);
  const generateDnaAfterImport = isDnaGenerateAfterImportEnabled(controlSettings);

  let discoveredProfileId = existingProfile?.id ?? null;
  let snapshotId: string | null = null;

  if (existingInfluencerId && profileUrl) {
    const iplResult = await fetchProfileWithIpl(supabase, {
      platform,
      username,
      profileUrl,
      influencerId: existingInfluencerId,
      discoveredProfileId: existingProfile?.id ?? null,
      auditMetadata: {
        trigger: "coverage_backfill",
        search_id: input.searchId ?? null,
      },
    });

    if (!iplResult.ok) {
      return {
        ok: false,
        merged: Boolean(existingProfile || existingInfluencerId),
        discoveredProfileId: existingProfile?.id,
        influencerId: existingInfluencerId,
        message: iplResult.reason ?? "Apify fetch failed for existing influencer.",
      };
    }

    snapshotId = iplResult.snapshotId;
    if (snapshotId && generateDnaAfterImport) {
      await bridgeSnapshotToCreatorDna(supabase, snapshotId);
    }
  } else if (profileUrl) {
    const rawResult = await fetchApifyProfileRaw({
      platform,
      username,
      profileUrl,
    });

    if (!rawResult.ok) {
      return {
        ok: false,
        merged: Boolean(existingProfile),
        discoveredProfileId: existingProfile?.id,
        message: rawResult.reason ?? "Apify fetch failed.",
      };
    }

    const adapter = getProviderAdapter("apify");
    const rawPayload: RawProviderPayload = {
      profileRows: rawResult.profileRows,
      postRows: rawResult.postRows,
      apifyRunId: rawResult.apifyRunId,
      detailsRunId: rawResult.detailsRunId,
      postsRunId: rawResult.postsRunId,
      platformKey: platform,
      profileUrl,
      username,
    };
    const normalized = adapter?.normalize(rawPayload);
    if (!normalized) {
      return {
        ok: false,
        merged: Boolean(existingProfile),
        discoveredProfileId: existingProfile?.id,
        message: "Apify returned no usable normalized profile.",
      };
    }

    snapshotId = await persistSnapshot(supabase, {
      provider: "apify",
      platform,
      profileUrl,
      discoveredProfileId: discoveredProfileId ?? undefined,
      rawSnapshot: rawPayload,
      normalizedSnapshot: normalized,
      auditMetadata: {
        trigger: "coverage_backfill",
        search_id: input.searchId ?? null,
      },
    });

    if (snapshotId && generateDnaAfterImport) {
      await bridgeSnapshotToCreatorDna(supabase, snapshotId);
    }
  } else {
    return {
      ok: false,
      merged: Boolean(existingProfile || existingInfluencerId),
      message: "Profile URL could not be resolved for Apify import.",
    };
  }

  if (!discoveredProfileId) {
    const { data: inserted, error: insertError } = await supabase
      .from("discovered_profiles")
      .upsert(
        {
          platform,
          username,
          profile_url: profileUrl,
          country_code: input.countryCode ?? null,
          category_tags: input.categoryTags ?? [],
          stage: "discovered",
          metadata: {
            import_source: "coverage_backfill",
            search_id: input.searchId ?? null,
          },
        },
        { onConflict: "platform,username" }
      )
      .select("id")
      .single();

    if (insertError) {
      return {
        ok: false,
        merged: false,
        message: insertError.message,
      };
    }
    discoveredProfileId = inserted.id as string;
  } else {
    await supabase
      .from("discovered_profiles")
      .update({
        profile_url: profileUrl,
        country_code: input.countryCode ?? undefined,
        category_tags: input.categoryTags?.length ? input.categoryTags : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", discoveredProfileId);
  }

  return {
    ok: true,
    merged: Boolean(existingProfile || existingInfluencerId),
    discoveredProfileId,
    influencerId: existingInfluencerId,
    snapshotId: snapshotId ?? undefined,
    message: existingProfile || existingInfluencerId ? "Merged into existing creator." : "Imported new profile.",
  };
}

export function dedupeImportedUnifiedIds(ids: readonly string[]): string[] {
  const { items } = dedupeByCreatorId(
    ids.map((id) => ({ id })),
    (row) => row.id
  );
  return items.map((row) => row.id);
}
