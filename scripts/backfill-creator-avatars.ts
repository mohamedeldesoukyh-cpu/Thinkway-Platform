#!/usr/bin/env node
/**
 * Backfill creator profile photos from Apify author metadata.
 *
 * Run:
 *   npm run backfill:creator-avatars
 *   npm run backfill:creator-avatars -- --platform=instagram
 *   npm run backfill:creator-avatars -- --platform=tiktok
 *   npm run backfill:creator-avatars -- --all
 *   npm run backfill:creator-avatars -- --dry-run
 */
import "@/lib/performance/script-env-preload";

import {
  shouldSyncPlatformAvatar,
  isUsableAvatarUrl,
  type PlatformAvatarAccount,
} from "@/lib/performance/avatar-sync-policy";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { isAvatarUrlAllowedForPlatform, resolvePublicationEffectivePlatform } from "@/lib/performance/creator-avatar";
import { collectPublicationMetricsById } from "@/lib/performance/metrics-collector";
import { enqueuePublicationMetricsJob, isMetricsQueueAvailable } from "@/lib/performance/metrics-collector/queue";
import { persistInfluencerPlatformAvatar, enrichAndPersistPlatformAvatar } from "@/lib/performance/metrics-collector/persist";
import { authorAvatarFromSyncLogSummary } from "@/lib/performance/apify-author-avatar";
import {
  createScriptSupabase,
  formatScriptErrorWithDiagnostics,
  getScriptSupabaseUrl,
  parseCliArgs,
} from "@/lib/performance/script-env";

type PlatformAccountRow = PlatformAvatarAccount & {
  id: string;
  influencer_id: string;
  platform: string;
  handle: string;
};

type PublicationCandidate = {
  id: string;
  campaign_header_id: string;
  influencer_id: string | null;
  platform: string | null;
  publication_type: string | null;
  content_url: string | null;
};

function accountNeedsAvatarSync(account: PlatformAvatarAccount & { platform: string }): boolean {
  const platformKey = canonicalPlatformKey(account.platform);
  const crossPlatformBlocked = Boolean(
    account.profile_picture_url?.trim() &&
      !isAvatarUrlAllowedForPlatform(platformKey, account.profile_picture_url)
  );
  return shouldSyncPlatformAvatar(account, Date.now(), {
    allowManualCrossPlatformRefresh: crossPlatformBlocked,
  });
}

async function findRecentPublication(
  supabase: ReturnType<typeof createScriptSupabase>,
  account: PlatformAccountRow
): Promise<PublicationCandidate | null> {
  const platformKey = canonicalPlatformKey(account.platform);
  const { data, error } = await supabase
    .from("campaign_publications")
    .select(
      "id, campaign_header_id, influencer_id, platform, publication_type, content_url, updated_at"
    )
    .eq("influencer_id", account.influencer_id)
    .not("content_url", "is", null)
    .order("updated_at", { ascending: false })
    .limit(40);

  if (error) {
    console.warn(
      `[backfill] publication lookup failed influencer=${account.influencer_id} platform=${account.platform}: ${error.message}`
    );
    return null;
  }

  const match = (data ?? []).find((row) => {
    const effective = resolvePublicationEffectivePlatform({
      platform: row.platform,
      publication_type: row.publication_type,
      content_url: row.content_url,
    });
    return effective === platformKey;
  });

  return (match as PublicationCandidate | undefined) ?? null;
}

async function tryAvatarFromSyncLogs(
  supabase: ReturnType<typeof createScriptSupabase>,
  publicationId: string,
  platform: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("publication_metric_sync_logs")
    .select("response_summary, created_at")
    .eq("publication_id", publicationId)
    .eq("provider", "apify")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error || !data?.length) return null;

  for (const row of data) {
    const url = authorAvatarFromSyncLogSummary(row.response_summary);
    if (url && isUsableAvatarUrl(url) && isAvatarUrlAllowedForPlatform(platform, url)) return url;
  }

  return null;
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  const supabase = createScriptSupabase();
  const dryRun = args["dry-run"] === true || args.dryRun === true;
  const allFlag = args.all === true;
  const platformFilter =
    typeof args.platform === "string" ? args.platform.trim().toLowerCase() : null;
  const useQueue = isMetricsQueueAvailable() && !dryRun;

  let query = supabase
    .from("influencer_platform_accounts")
    .select(
      "id, influencer_id, platform, handle, profile_picture_url, avatar_source, avatar_last_synced_at"
    );

  if (platformFilter) {
    query = query.eq("platform", platformFilter);
  }

  const supabaseUrl = getScriptSupabaseUrl();
  let accounts: PlatformAccountRow[] | null;
  try {
    const { data, error } = await query;
    if (error) {
      throw Object.assign(
        new Error(
          `Supabase query failed (influencer_platform_accounts) at ${supabaseUrl}: ${error.message}`
        ),
        { cause: error }
      );
    }
    accounts = (data ?? []) as PlatformAccountRow[];
  } catch (queryError) {
    const message =
      queryError instanceof Error ? queryError.message : String(queryError);
    throw Object.assign(
      new Error(
        `Failed to load platform accounts from ${supabaseUrl}: ${message}`
      ),
      { cause: queryError instanceof Error ? queryError : undefined }
    );
  }

  const candidates = accounts.filter((account) => accountNeedsAvatarSync(account));

  console.log(
    `[backfill] ${candidates.length} platform account(s) eligible${platformFilter ? ` (${platformFilter})` : ""}${dryRun ? " [dry-run]" : ""}`
  );
  console.log(`[backfill] queue mode: ${useQueue ? "redis" : "inline"}`);

  if (!allFlag && candidates.length > 50) {
    console.log(
      "[backfill] More than 50 accounts — pass --all to process entire batch, or narrow with --platform="
    );
    return;
  }

  let saved = 0;
  let queued = 0;
  let skipped = 0;

  for (const account of candidates) {
    const publication = await findRecentPublication(supabase, account);
    if (!publication?.content_url) {
      skipped += 1;
      console.log(
        `[backfill] skip ${account.platform}/@${account.handle} — no publication with content URL`
      );
      continue;
    }

    let avatarUrl = await tryAvatarFromSyncLogs(
      supabase,
      publication.id,
      account.platform
    );

    if (!avatarUrl && !useQueue && !dryRun) {
      try {
        await collectPublicationMetricsById(supabase, {
          publicationId: publication.id,
          campaignHeaderId: publication.campaign_header_id,
          triggeredBy: "avatar_backfill",
        });
        avatarUrl = await tryAvatarFromSyncLogs(
          supabase,
          publication.id,
          account.platform
        );
      } catch (collectError) {
        console.warn(
          `[backfill] metrics collect failed publication=${publication.id}`,
          collectError
        );
      }
    } else if (!avatarUrl && useQueue) {
      const result = await enqueuePublicationMetricsJob({
        publicationId: publication.id,
        campaignHeaderId: publication.campaign_header_id,
        triggeredBy: "avatar_backfill",
      });
      if (result.enqueued) {
        queued += 1;
        console.log(
          `[backfill] queued metrics publication=${publication.id} account=${account.platform}/@${account.handle}`
        );
      }
      continue;
    }

    if (!avatarUrl) {
      if (!dryRun) {
        const enrichResult = await enrichAndPersistPlatformAvatar(supabase, {
          influencerId: account.influencer_id,
          platform: account.platform,
        });
        if (enrichResult.saved) {
          saved += 1;
          console.log(`[backfill] enriched ${account.platform}/@${account.handle}`);
          continue;
        }
      }
      skipped += 1;
      continue;
    }

    if (dryRun) {
      console.log(
        `[backfill] would save ${account.platform}/@${account.handle} ← ${avatarUrl.slice(0, 72)}…`
      );
      saved += 1;
      continue;
    }

    const persisted = await persistInfluencerPlatformAvatar(supabase, {
      influencerId: account.influencer_id,
      platform: account.platform,
      profilePictureUrl: avatarUrl,
      source: "apify",
    });

    if (persisted) {
      saved += 1;
      console.log(`[backfill] saved ${account.platform}/@${account.handle}`);
    } else {
      skipped += 1;
    }
  }

  console.log(
    `[backfill] done saved=${saved} queued=${queued} skipped=${skipped} total=${candidates.length}`
  );
}

main().catch(async (error) => {
  console.error("[backfill] fatal\n", await formatScriptErrorWithDiagnostics(error));
  process.exit(1);
});
