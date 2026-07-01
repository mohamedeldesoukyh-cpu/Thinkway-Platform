/**
 * Creator enrichment service — the merge engine that the worker executes.
 *
 * Responsibilities (spec §11, §2.C, §3):
 *  - Enforce the 30-day freshness skip (unless forced).
 *  - Call Apify per platform account (reusing the shared Apify contract).
 *  - Merge results with MANUAL PROTECTION + per-field TRANSPARENCY sources.
 *  - Persist enriched fields + creator-level orchestration metadata.
 *  - Write an audit run row for every outcome (including skips & failures).
 *
 * Demographics are intentionally NOT written here: Apify does not provide
 * audience demographics, and we NEVER invent them. Columns stay NULL with
 * demographic_source='unavailable' until a real provider (Modash/HypeAuditor/
 * CreatorIQ) is wired in — which needs no schema change.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { buildCanonicalProfileUrl, isSocialPlatform } from "@/lib/social/platforms";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";

import { persistInfluencerPlatformAvatarDetailed } from "@/lib/performance/metrics-collector/persist";
import { isUsableAvatarUrl, normalizeAvatarSource } from "@/lib/performance/avatar-sync-policy";
import { persistCreatorPrimaryIdentity } from "@/lib/creators/persist-primary-avatar";

import { fetchApifyProfile } from "./apify-profile";
import { writeEnrichmentRun } from "./audit";
import {
  canEnqueueCreatorEnrichment,
  creatorEnrichmentDisabledMessage,
  isCreatorEnrichmentWorkerEnabled,
  type EnrichmentScope,
} from "./enabled";
import { decideEnrichment, computeNextRefreshAt } from "./policy";
import { resolveApifyAvatarPersistOptions } from "./enrichment-avatar-policy";
import { mergeSourcedFields, type IncomingField } from "./merge";
import {
  recentPublicationsLackThumbnails,
} from "@/lib/creators/recent-publication-thumb";
import type {
  CreatorEnrichmentJobPayload,
  CreatorEnrichmentResult,
  FieldSource,
  FieldSourceMap,
  ApifyProfileData,
} from "./types";

type AnySupabase = SupabaseClient;

type PlatformAccountRow = {
  id: string;
  platform: string;
  handle: string | null;
  username: string | null;
  profile_url: string | null;
  profile_display_name: string | null;
  profile_bio: string | null;
  following_count: number | null;
  posts_count: number | null;
  follower_count: number | null;
  engagement_rate: number | null;
  avg_views: number | null;
  avg_likes: number | null;
  avg_comments: number | null;
  is_verified: boolean | null;
  audience_country: string | null;
  hashtags: string[] | null;
  mentions: string[] | null;
  interest_categories: string[] | null;
  recent_publications: ApifyProfileData["recentPublications"] | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_links: string[] | null;
  metrics_is_manual_override: boolean | null;
  field_sources: FieldSourceMap | null;
  profile_picture_url: string | null;
  avatar_source: string | null;
  metadata: Record<string, unknown> | null;
};

const APIFY: FieldSource = "apify";

const APIFY_METRIC_FIELDS = [
  "follower_count",
  "engagement_rate",
  "avg_views",
  "avg_likes",
  "avg_comments",
  "following_count",
  "posts_count",
] as const;

const SCOPE_FIELDS: Record<Exclude<EnrichmentScope, "all">, readonly string[]> = {
  avatar: ["profile_picture_url"],
  metrics: [
    ...APIFY_METRIC_FIELDS,
    "audience_country",
    "interest_categories",
    "audience_interests",
  ],
  profile: [
    "profile_display_name",
    "profile_bio",
    "contact_email",
    "contact_phone",
    "contact_links",
    "is_verified",
    "hashtags",
    "mentions",
    "recent_publications",
  ],
  audience: ["audience_country", "audience_interests"],
  categories: ["interest_categories", "categories", "ai_categories", "brand_fit_categories", "niche"],
};

function scopeAllowsField(scope: EnrichmentScope | undefined, field: string): boolean {
  const resolved = scope ?? "all";
  if (resolved === "all") return true;
  return SCOPE_FIELDS[resolved].includes(field);
}

function filterIncomingByScope(
  incoming: IncomingField[],
  scope: EnrichmentScope | undefined
): IncomingField[] {
  return incoming.filter((item) => scopeAllowsField(scope, item.field));
}

function logCreatorEnrichment(event: string, data: Record<string, unknown>): void {
  console.log(`[creator-enrichment:service] ${event}`, JSON.stringify(data));
}

/** Legacy imports may only set metrics_is_manual_override — treat as manual lock. */
function resolveAccountFieldSources(account: PlatformAccountRow): FieldSourceMap {
  const sources: FieldSourceMap = { ...(account.field_sources ?? {}) };
  if (!account.metrics_is_manual_override) return sources;

  for (const field of APIFY_METRIC_FIELDS) {
    const value = account[field];
    if (value != null && sources[field] == null) {
      sources[field] = "manual";
    }
  }
  return sources;
}

function accountExistingValues(account: PlatformAccountRow): Record<string, unknown> {
  const metadata = (account.metadata ?? {}) as Record<string, unknown>;
  return {
    profile_display_name: account.profile_display_name,
    profile_bio: account.profile_bio,
    following_count: account.following_count,
    posts_count: account.posts_count,
    follower_count: account.follower_count,
    engagement_rate: account.engagement_rate,
    avg_views: account.avg_views,
    avg_likes: account.avg_likes,
    avg_comments: account.avg_comments,
    is_verified: account.is_verified,
    audience_country: account.audience_country,
    hashtags: account.hashtags,
    mentions: account.mentions,
    interest_categories: account.interest_categories,
    audience_interests: metadata.audience_interests,
    categories: metadata.categories,
    ai_categories: metadata.ai_categories,
    brand_fit_categories: metadata.brand_fit_categories,
    niche: metadata.niche,
    recent_publications: account.recent_publications,
    contact_email: account.contact_email,
    contact_phone: account.contact_phone,
    contact_links: account.contact_links,
  };
}

function profileUrlFor(account: PlatformAccountRow): string | null {
  if (account.profile_url?.trim()) return account.profile_url.trim();
  const platformKey = canonicalPlatformKey(account.platform);
  const username = account.username?.trim() || account.handle?.trim();
  if (username && isSocialPlatform(platformKey)) {
    return buildCanonicalProfileUrl(platformKey, username.replace(/^@/, ""));
  }
  return null;
}

/** Run a single enrichment job end-to-end. Throws only on unexpected DB errors. */
export async function runCreatorEnrichment(
  supabase: AnySupabase,
  payload: CreatorEnrichmentJobPayload,
  options?: { attempt?: number; jobId?: string | null }
): Promise<CreatorEnrichmentResult> {
  const startedAt = new Date().toISOString();
  const attempt = options?.attempt ?? 1;

  const { data: creator, error: creatorError } = await supabase
    .from("influencers")
    .select("id, last_enriched_at, field_sources, profile_data_version")
    .eq("id", payload.influencerId)
    .maybeSingle();

  if (creatorError) throw new Error(creatorError.message);
  if (!creator) {
    return {
      ok: false,
      status: "failed",
      message: "Creator not found.",
      fieldsUpdated: [],
    };
  }

  const creatorRow = creator as {
    id: string;
    last_enriched_at: string | null;
    field_sources: FieldSourceMap | null;
    profile_data_version: number | null;
  };

  const scope = payload.scope ?? "all";
  const gate = canEnqueueCreatorEnrichment({ trigger: payload.trigger, scope });
  if (!gate.allowed) {
    const skippedReason = gate.reason ?? creatorEnrichmentDisabledMessage();
    const restoredStatus: CreatorEnrichmentResult["status"] = creatorRow.last_enriched_at
      ? "enriched"
      : "never";

    await supabase
      .from("influencers")
      .update({ enrichment_status: restoredStatus } as never)
      .eq("id", payload.influencerId);

    logCreatorEnrichment("Skipped enrichment (gate)", {
      influencerId: payload.influencerId,
      trigger: payload.trigger,
      scope,
      restoredStatus,
    });
    await writeEnrichmentRun(supabase, {
      influencerId: payload.influencerId,
      discoveredProfileId: payload.discoveredProfileId,
      trigger: payload.trigger,
      priority: payload.priority,
      status: "skipped",
      forced: Boolean(payload.force),
      skippedReason,
      attempt,
      jobId: options?.jobId ?? null,
      requestedBy: payload.requestedBy,
      startedAt,
      completedAt: new Date().toISOString(),
    });
    return {
      ok: true,
      status: "skipped",
      message: skippedReason,
      fieldsUpdated: [],
      skippedReason,
    };
  }

  // ---- 30-day freshness skip (spec §2.C) -----------------------------------
  const decision = decideEnrichment({
    lastEnrichedAt: creatorRow.last_enriched_at,
    force: payload.force,
  });
  if (decision.skip) {
    const restoredStatus: CreatorEnrichmentResult["status"] = creatorRow.last_enriched_at
      ? "enriched"
      : "never";

    await supabase
      .from("influencers")
      .update({ enrichment_status: restoredStatus } as never)
      .eq("id", payload.influencerId);

    logCreatorEnrichment("Skipped enrichment (freshness policy)", {
      influencerId: payload.influencerId,
      fallbackReason: decision.reason,
      force: Boolean(payload.force),
      restoredStatus,
    });
    await writeEnrichmentRun(supabase, {
      influencerId: payload.influencerId,
      discoveredProfileId: payload.discoveredProfileId,
      trigger: payload.trigger,
      priority: payload.priority,
      status: "skipped",
      forced: Boolean(payload.force),
      skippedReason: decision.reason,
      attempt,
      jobId: options?.jobId ?? null,
      requestedBy: payload.requestedBy,
      startedAt,
      completedAt: new Date().toISOString(),
    });
    return {
      ok: true,
      status: "skipped",
      message: decision.reason,
      fieldsUpdated: [],
      skippedReason: decision.reason,
    };
  }

  // Mark collecting (DB: running).
  await supabase
    .from("influencers")
    .update({ enrichment_status: "running" } as never)
    .eq("id", payload.influencerId);

  await writeEnrichmentRun(supabase, {
    influencerId: payload.influencerId,
    discoveredProfileId: payload.discoveredProfileId,
    trigger: payload.trigger,
    priority: payload.priority,
    status: "running",
    forced: Boolean(payload.force),
    attempt: options?.attempt ?? 1,
    jobId: options?.jobId ?? null,
    requestedBy: payload.requestedBy,
    startedAt,
  });

  const { data: accountsData, error: accountsError } = await supabase
    .from("influencer_platform_accounts")
    .select(
      "id, platform, handle, username, profile_url, profile_display_name, profile_bio, following_count, posts_count, follower_count, engagement_rate, avg_views, avg_likes, avg_comments, is_verified, audience_country, hashtags, mentions, interest_categories, recent_publications, contact_email, contact_phone, contact_links, metrics_is_manual_override, field_sources, profile_picture_url, avatar_source, metadata"
    )
    .eq("influencer_id", payload.influencerId);

  if (accountsError) throw new Error(accountsError.message);
  const accounts = (accountsData ?? []) as PlatformAccountRow[];

  const allFieldsUpdated: string[] = [];
  let anyApifyAvailable = false;
  let anySuccess = false;
  let topFollowers = 0;
  let lastApifyRunId: string | null = null;
  const errors: string[] = [];
  const { forceSync: forceAvatarSync, forceAvatarReplace } = resolveApifyAvatarPersistOptions({
    scope,
    force: payload.force,
    bypassMetricsManualOverride: payload.bypassMetricsManualOverride,
    forceAvatarReplace: payload.forceAvatarReplace,
  });
  const forceInterestReplace =
    scopeAllowsField(scope, "categories") && Boolean(payload.forceInterestReplace);

  logCreatorEnrichment("Enrichment job started", {
    influencerId: payload.influencerId,
    trigger: payload.trigger,
    force: Boolean(payload.force),
    forceAvatarSync,
    forceAvatarReplace,
    forceInterestReplace,
  });

  for (const account of accounts) {
    if (payload.platformAccountId && account.id !== payload.platformAccountId) {
      continue;
    }

    const profileUrl = profileUrlFor(account);
    const platformKey = canonicalPlatformKey(account.platform);
    const username = account.username ?? account.handle;

    if (!profileUrl || !isSocialPlatform(platformKey)) {
      logCreatorEnrichment("Skipped platform account", {
        influencerId: payload.influencerId,
        platform: account.platform,
        platformKey,
        username,
        fallbackReason: !profileUrl
          ? "Missing profile URL or username."
          : "Unsupported platform for Apify enrichment.",
      });
      continue;
    }

    logCreatorEnrichment("Fetching Apify profile", {
      influencerId: payload.influencerId,
      platform: platformKey,
      username,
      profileUrl,
    });

    const fetched = await fetchApifyProfile({
      platform: platformKey,
      username,
      profileUrl,
    });

    if (!fetched.ok) {
      logCreatorEnrichment("Apify fetch failed", {
        influencerId: payload.influencerId,
        platform: platformKey,
        username,
        available: fetched.available,
        fallbackReason: fetched.reason,
      });
      const avatarSource = normalizeAvatarSource(account.avatar_source);
      if (
        avatarSource === "uploaded" &&
        isUsableAvatarUrl(account.profile_picture_url)
      ) {
        console.log(
          `[avatar] preserving uploaded avatar after failed enrichment influencer=${payload.influencerId} platform=${platformKey} username=${username ?? "unknown"}`
        );
      }
      if (fetched.available) {
        anyApifyAvailable = true;
        errors.push(`${platformKey}: ${fetched.reason}`);
      }
      continue;
    }

    anyApifyAvailable = true;
    const data = fetched.data;
    lastApifyRunId = data.apifyRunId ?? lastApifyRunId;

    const incoming: IncomingField[] = [
      { field: "profile_display_name", value: data.displayName, source: APIFY },
      { field: "profile_bio", value: data.bio, source: APIFY },
      { field: "following_count", value: data.following, source: APIFY },
      { field: "posts_count", value: data.postsCount, source: APIFY },
      { field: "follower_count", value: data.followers, source: APIFY },
      { field: "engagement_rate", value: data.engagementRate, source: APIFY },
      { field: "avg_views", value: data.avgViews, source: APIFY },
      { field: "avg_likes", value: data.avgLikes, source: APIFY },
      { field: "avg_comments", value: data.avgComments, source: APIFY },
      { field: "is_verified", value: data.isVerified, source: APIFY },
      { field: "audience_country", value: data.audienceCountry, source: APIFY },
      { field: "hashtags", value: data.hashtags, source: APIFY },
      { field: "mentions", value: data.mentions, source: APIFY },
      { field: "interest_categories", value: data.categories, source: APIFY },
      {
        field: "audience_interests",
        value: data.categories.length > 0 ? data.categories : null,
        source: APIFY,
      },
      { field: "recent_publications", value: data.recentPublications, source: APIFY },
      { field: "contact_email", value: data.contactEmail, source: APIFY },
      { field: "contact_phone", value: data.contactPhone, source: APIFY },
      {
        field: "contact_links",
        value: data.contactLinks.length > 0 ? data.contactLinks : null,
        source: APIFY,
      },
    ];

    const scopedIncoming = filterIncomingByScope(incoming, scope);

    const merged = mergeSourcedFields(resolveAccountFieldSources(account), scopedIncoming, {
      existingValues: accountExistingValues(account),
      fillMissingOnly: payload.trigger !== "manual",
      metadata: account.metadata,
      forceInterestReplace,
    });

    const metadataFields = [
      "audience_interests",
      "categories",
      "ai_categories",
      "brand_fit_categories",
      "niche",
    ] as const;
    const metadataBase = (account.metadata ?? {}) as Record<string, unknown>;
    const metadataPatch: Record<string, unknown> = {};
    for (const field of metadataFields) {
      if (field in merged.updates) {
        metadataPatch[field] = merged.updates[field];
        delete merged.updates[field];
      }
    }
    if (Object.keys(metadataPatch).length > 0) {
      merged.updates.metadata = { ...metadataBase, ...metadataPatch };
      if (!merged.fieldsUpdated.includes("metadata")) {
        merged.fieldsUpdated.push("metadata");
      }
    }

    const incomingHasThumbnails = data.recentPublications.some((pub) => pub.thumbnail);
    const existingLacksThumbnails = recentPublicationsLackThumbnails(account.recent_publications);
    const shouldForcePublicationRefresh =
      data.recentPublications.length > 0 &&
      incomingHasThumbnails &&
      (existingLacksThumbnails ||
        Boolean(payload.force) ||
        Boolean(payload.bypassMetricsManualOverride));

    if (shouldForcePublicationRefresh && !merged.fieldsUpdated.includes("recent_publications")) {
      merged.updates.recent_publications = data.recentPublications;
      merged.fieldSources.recent_publications = APIFY;
      merged.fieldsUpdated.push("recent_publications");
    }

    if (data.recentPublications.length > 0) {
      logCreatorEnrichment("Sample recent publication", {
        influencerId: payload.influencerId,
        platform: platformKey,
        samplePublication: data.recentPublications[0],
      });
    }

    if (merged.fieldsUpdated.length > 0) {
      const nowIso = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("influencer_platform_accounts")
        .update({
          ...merged.updates,
          field_sources: merged.fieldSources,
          enrichment_status: "enriched",
          last_enriched_at: nowIso,
          apify_run_id: data.apifyRunId,
          profile_data_version: ((account as { profile_data_version?: number }).profile_data_version ?? 0) + 1,
          sync_status: "synced",
          sync_source: "apify",
          last_synced_at: nowIso,
          updated_at: nowIso,
        } as never)
        .eq("id", account.id);

      if (updateError) {
        errors.push(`${platformKey}: ${updateError.message}`);
      } else {
        anySuccess = true;
        allFieldsUpdated.push(...merged.fieldsUpdated.map((f) => `${platformKey}.${f}`));
      }
    } else {
      anySuccess = true;
    }

    // Always attempt when Apify returned a photo. Metrics refresh still honors
    // avatar-sync-policy unless scope is avatar/all (forceSync / forceAvatarReplace).
    if (data.profilePictureUrl) {
      const avatarResult = await persistInfluencerPlatformAvatarDetailed(supabase, {
        influencerId: payload.influencerId,
        platform: platformKey,
        profilePictureUrl: data.profilePictureUrl,
        source: "apify",
        forceSync: forceAvatarSync,
        forceAvatarReplace,
        allowUploadedProviderReplace: payload.trigger === "manual",
        logSkips: false,
      });

      const { data: avatarRow } = await supabase
        .from("influencer_platform_accounts")
        .select("profile_picture_url, avatar_source, avatar_last_synced_at")
        .eq("id", account.id)
        .maybeSingle();

      logCreatorEnrichment("Avatar persist result", {
        influencerId: payload.influencerId,
        platform: platformKey,
        username,
        apifyProfilePictureUrl: data.profilePictureUrl,
        forceSync: forceAvatarSync,
        saved: avatarResult.saved,
        skipReason: avatarResult.saved ? undefined : avatarResult.reason,
        dbProfilePictureUrl:
          (avatarRow as { profile_picture_url?: string | null } | null)?.profile_picture_url ??
          null,
        dbAvatarSource:
          (avatarRow as { avatar_source?: string | null } | null)?.avatar_source ?? null,
      });

      if (avatarResult.saved) {
        allFieldsUpdated.push(`${platformKey}.profile_picture_url`);
      }
    } else {
      console.log(
        `[avatar] provider returned empty avatar influencer=${payload.influencerId} platform=${platformKey} username=${username ?? "unknown"}`
      );
      const avatarSource = normalizeAvatarSource(account.avatar_source);
      if (
        avatarSource === "uploaded" &&
        isUsableAvatarUrl(account.profile_picture_url)
      ) {
        console.log(
          `[avatar] preserving uploaded avatar after failed enrichment influencer=${payload.influencerId} platform=${platformKey} username=${username ?? "unknown"}`
        );
      }
      logCreatorEnrichment("Avatar persist skipped", {
        influencerId: payload.influencerId,
        platform: platformKey,
        username,
        reason: "apify_profile_picture_missing",
      });
    }

    if ((data.followers ?? 0) > topFollowers) topFollowers = data.followers ?? 0;
  }

  // ---- Persist creator-level orchestration metadata ------------------------
  const completedAt = new Date().toISOString();
  const finalStatus: CreatorEnrichmentResult["status"] = anySuccess
    ? allFieldsUpdated.length > 0
      ? "enriched"
      : "partial"
    : anyApifyAvailable
      ? "failed"
      : "skipped";

  await supabase
    .from("influencers")
    .update({
      enrichment_status: finalStatus === "skipped" ? "partial" : finalStatus,
      enrichment_source: anySuccess ? "apify" : null,
      enrichment_priority: payload.priority,
      last_enriched_at: anySuccess ? completedAt : creatorRow.last_enriched_at,
      next_refresh_at: computeNextRefreshAt({ followers: topFollowers }).toISOString(),
      apify_run_id: lastApifyRunId,
      profile_data_version: (creatorRow.profile_data_version ?? 0) + 1,
      updated_at: completedAt,
    } as never)
    .eq("id", payload.influencerId);

  if (anySuccess) {
    await persistCreatorPrimaryIdentity(supabase, payload.influencerId);
  }

  await writeEnrichmentRun(supabase, {
    influencerId: payload.influencerId,
    discoveredProfileId: payload.discoveredProfileId,
    trigger: payload.trigger,
    priority: payload.priority,
    status:
      finalStatus === "enriched" || finalStatus === "partial"
        ? finalStatus === "enriched"
          ? "completed"
          : "partial"
        : "failed",
    source: anySuccess ? "apify" : null,
    apifyRunId: lastApifyRunId,
    forced: Boolean(payload.force),
    fieldsUpdated: allFieldsUpdated,
    attempt,
    errorMessage: errors.length > 0 ? errors.join("; ") : null,
    jobId: options?.jobId ?? null,
    requestedBy: payload.requestedBy,
    startedAt,
    completedAt,
  });

  if (!anyApifyAvailable && !anySuccess) {
    return {
      ok: false,
      status: "failed",
      message: "Apify is not configured; no enrichment performed.",
      fieldsUpdated: [],
    };
  }

  if (finalStatus === "failed") {
    // Surface failure so BullMQ retries / dead-letters the job.
    throw new Error(
      errors.length > 0 ? errors.join("; ") : "Enrichment failed for all platform accounts."
    );
  }

  return {
    ok: true,
    status: finalStatus,
    message:
      allFieldsUpdated.length > 0
        ? `Enriched ${allFieldsUpdated.length} field(s).`
        : "No changes (existing data current or manually protected).",
    fieldsUpdated: allFieldsUpdated,
    apifyRunId: lastApifyRunId,
  };
}
