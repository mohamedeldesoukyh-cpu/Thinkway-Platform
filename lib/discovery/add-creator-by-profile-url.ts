import type { SupabaseClient } from "@supabase/supabase-js";

import { persistCreatorPrimaryIdentity } from "@/lib/creators/persist-primary-avatar";
import { MAX_ADD_MISSING_CREATORS } from "@/lib/discovery/add-creator-constants";
import {
  extractEmailFromText,
  mergeContactLinks,
  normalizeContactLink,
} from "@/lib/creators/contact-info";
import { formatCreatorDisplayName } from "@/lib/text/decode-html-entities";
import { getUnifiedCreatorById } from "@/lib/creators/unified-browse";
import {
  countryWritePayload,
  persistCountryFromInitialProfileSignals,
} from "@/lib/creators/country-persistence";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { refreshCreatorMetrics } from "@/lib/services/creators/creator-enrichment-service";
import { requireCreatorBaselineDna } from "@/features/creator-dna/services/baseline-dna-populator";
import { findDuplicatePlatformAccounts } from "@/lib/social/duplicate-check";
import { enrichCreatorProfile } from "@/lib/social/enrichment/providers/open-graph";
import { resolveMetricsSourceForEnrichment } from "@/lib/social/enrichment/metrics-status";
import { buildNormalizedPlatformAccount } from "@/lib/social/normalize-account";
import { parseProfileInput, parseProfileInputList } from "@/lib/social/parse-profile-url";
import { isSocialPlatform } from "@/lib/social/platforms";
import type { Database } from "@/types/database";

export type AddCreatorByProfileUrlResult =
  | {
      ok: true;
      creator: UnifiedCreatorResult | null;
      created: boolean;
      skippedExisting: boolean;
      enrichmentQueued: boolean;
      message: string;
    }
  | { ok: false; message: string };

export type AddCreatorByProfileUrlInput = {
  profileUrl: string;
  actorId: string;
  /** When true, existing Discovery creators are left unchanged (no re-enrich). */
  skipIfExists?: boolean;
  /** When true, skip Open Graph preview so batch adds stay off the timeout path. */
  skipPreviewEnrichment?: boolean;
};

/**
 * Parse a social profile URL, upsert a minimal influencer + platform account when
 * needed, and queue Apify enrichment via the unified creator-enrichment pipeline.
 */
export async function addCreatorByProfileUrl(
  supabase: SupabaseClient<Database>,
  input: AddCreatorByProfileUrlInput
): Promise<AddCreatorByProfileUrlResult> {
  const trimmed = input.profileUrl.trim();
  const parsed = parseProfileInput(trimmed);

  if (!parsed) {
    return {
      ok: false,
      message: "Could not detect platform or username from this URL.",
    };
  }

  if (!isSocialPlatform(parsed.platform)) {
    return { ok: false, message: "Unsupported platform." };
  }

  const duplicates = await findDuplicatePlatformAccounts(supabase, {
    platform: parsed.platform,
    normalized_username: parsed.normalized_username,
    normalized_profile_url: parsed.normalized_profile_url,
  });

  let influencerId: string;
  let created = false;

  if (duplicates.length > 0) {
    influencerId = duplicates[0]!.influencer_id;
    if (input.skipIfExists) {
      return {
        ok: true,
        creator: null,
        created: false,
        skippedExisting: true,
        enrichmentQueued: false,
        message: `Already in Discovery — skipped @${parsed.normalized_username}.`,
      };
    }
  } else {
    let enrichment = null;
    if (!input.skipPreviewEnrichment) {
      try {
        enrichment = await enrichCreatorProfile({
          platform: parsed.platform,
          username: parsed.username,
          profile_url: parsed.profile_url,
        });
      } catch {
        // Open-graph enrichment must not block creator creation.
      }
    }

    const displayName =
      formatCreatorDisplayName(enrichment?.display_name) ||
      `@${parsed.normalized_username}`;

    const normalized = buildNormalizedPlatformAccount({
      platform: parsed.platform,
      username: parsed.username,
      profile_url: parsed.profile_url,
      follower_count: enrichment?.follower_count ?? null,
      following_count: enrichment?.following_count ?? null,
      engagement_rate: enrichment?.engagement_rate ?? null,
      avg_views: enrichment?.avg_views ?? null,
      profile_display_name: formatCreatorDisplayName(enrichment?.display_name) || null,
      profile_bio: enrichment?.bio ?? null,
      profile_picture_url: enrichment?.profile_picture_url ?? null,
      is_verified: enrichment?.is_verified ?? false,
      sync_status: enrichment?.sync_status ?? "partial",
      sync_source: enrichment?.sync_source ?? "discovery_add",
      sync_error: enrichment?.sync_error ?? null,
      last_synced_at: enrichment ? new Date().toISOString() : null,
      metrics_source: resolveMetricsSourceForEnrichment({
        platform: parsed.platform,
        follower_count: enrichment?.follower_count ?? null,
        engagement_rate: enrichment?.engagement_rate ?? null,
        avg_views: enrichment?.avg_views ?? null,
        sync_status: enrichment?.sync_status ?? "partial",
      }),
      metrics_last_synced_at: enrichment ? new Date().toISOString() : null,
      metrics_is_manual_override: false,
    });

    const profileBio = enrichment?.bio ?? null;
    const initialCountryWrite = persistCountryFromInitialProfileSignals({
      bio: profileBio,
      displayName,
      handle: parsed.normalized_username,
    });

    const { data: influencer, error: influencerError } = await supabase
      .from("influencers")
      .insert({
        display_name: displayName,
        status: "active",
        notes: "Added via Discovery profile link",
        created_by: input.actorId,
        ...countryWritePayload(initialCountryWrite),
      })
      .select("id")
      .single();

    if (influencerError || !influencer) {
      return {
        ok: false,
        message: influencerError?.message ?? "Failed to create creator.",
      };
    }

    influencerId = influencer.id;
    created = true;

    const contactEmail = extractEmailFromText(profileBio);
    const contactLinks = mergeContactLinks(
      null,
      normalizeContactLink(parsed.profile_url) ? [parsed.profile_url] : null
    );

    const { error: accountError } = await supabase
      .from("influencer_platform_accounts")
      .insert({
        influencer_id: influencerId,
        platform: normalized.platform,
        handle: normalized.handle,
        username: normalized.username,
        normalized_username: normalized.normalized_username,
        profile_url: normalized.profile_url,
        normalized_profile_url: normalized.normalized_profile_url,
        profile_display_name: normalized.profile_display_name,
        profile_bio: normalized.profile_bio,
        profile_picture_url: normalized.profile_picture_url,
        follower_count: normalized.follower_count ?? 0,
        following_count: normalized.following_count,
        engagement_rate: normalized.engagement_rate,
        avg_views: normalized.avg_views,
        is_verified: normalized.is_verified,
        sync_status: normalized.sync_status,
        sync_source: normalized.sync_source,
        sync_error: normalized.sync_error,
        last_synced_at: normalized.last_synced_at,
        metrics_source: normalized.metrics_source,
        metrics_last_synced_at: normalized.metrics_last_synced_at,
        metrics_is_manual_override: normalized.metrics_is_manual_override,
        contact_email: contactEmail,
        contact_links: contactLinks.length > 0 ? contactLinks : null,
        is_primary: true,
        ...(normalized.profile_picture_url
          ? {
              avatar_source: enrichment?.profile_picture_url ? "discovery" : "manual",
              avatar_last_synced_at: new Date().toISOString(),
            }
          : {}),
      });

    if (accountError) {
      await supabase.from("influencers").delete().eq("id", influencerId);
      return { ok: false, message: accountError.message };
    }

    if (normalized.profile_picture_url) {
      await persistCreatorPrimaryIdentity(supabase, influencerId);
    }

    await supabase
      .from("influencers")
      .update({ display_name: displayName })
      .eq("id", influencerId);
  }

  try {
    await requireCreatorBaselineDna(supabase, influencerId);
  } catch (error) {
    if (created) {
      await supabase.from("influencers").delete().eq("id", influencerId);
    }
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Creator DNA baseline failed — creator cannot exist without DNA.",
    };
  }

  // Match Refresh metrics (live Apify): force=true bypasses freshness/IPL soft paths
  // and uses the same producer semantics as manual refresh. force=false caused
  // add-creator polls to false-fail while a later Refresh succeeded.
  const refresh = await refreshCreatorMetrics(supabase, influencerId, {
    force: true,
    trigger: "manual",
    scope: "all",
    requestedBy: input.actorId,
    feature: "add_creator",
  });

  const unifiedId = `inf:${influencerId}`;
  const creator = await getUnifiedCreatorById(supabase, unifiedId);
  if (!creator) {
    return { ok: false, message: "Creator was saved but could not be loaded." };
  }

  const message = created
    ? refresh.queued
      ? "Creator added — enrichment queued."
      : refresh.message
    : refresh.queued
      ? "This creator already exists — enrichment queued."
      : `This creator already exists. ${refresh.message}`;

  return {
    ok: true,
    creator,
    created,
    skippedExisting: false,
    enrichmentQueued: refresh.queued,
    message,
  };
}

export type AddCreatorsByProfileUrlsResult = {
  ok: true;
  added: UnifiedCreatorResult[];
  skipped: Array<{ username: string; platform: string }>;
  failed: Array<{ raw: string; message: string }>;
  invalid: string[];
};

export async function addCreatorsByProfileUrls(
  supabase: SupabaseClient<Database>,
  input: { raw: string; actorId: string }
): Promise<AddCreatorsByProfileUrlsResult> {
  const { parsed, invalid } = parseProfileInputList(input.raw);
  const limited = parsed.slice(0, MAX_ADD_MISSING_CREATORS);
  const overflow = parsed.slice(MAX_ADD_MISSING_CREATORS);
  const batch = limited.length > 1;
  const added: UnifiedCreatorResult[] = [];
  const skipped: AddCreatorsByProfileUrlsResult["skipped"] = [];
  const failed: AddCreatorsByProfileUrlsResult["failed"] = [
    ...overflow.map((item) => ({
      raw: item.raw,
      message: `Limit is ${MAX_ADD_MISSING_CREATORS} creators per batch.`,
    })),
  ];

  for (const item of limited) {
    const result = await addCreatorByProfileUrl(supabase, {
      profileUrl: item.profile_url,
      actorId: input.actorId,
      skipIfExists: true,
      skipPreviewEnrichment: batch,
    });
    if (!result.ok) {
      failed.push({ raw: item.raw, message: result.message });
      continue;
    }
    if (result.skippedExisting) {
      skipped.push({
        username: item.normalized_username,
        platform: item.platform,
      });
      continue;
    }
    if (result.creator) {
      added.push(result.creator);
    }
  }

  return { ok: true, added, skipped, failed, invalid };
}
