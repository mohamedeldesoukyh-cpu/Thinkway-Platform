#!/usr/bin/env node
/**
 * Backfill creator-centric Discovery identity on influencers:
 * primary_avatar_url, primary_avatar_source, default_metrics_platform_account_id.
 *
 * Run:
 *   npm run backfill:creator-identity
 *   npm run backfill:creator-identity -- --dry-run
 *   npm run backfill:creator-identity -- --influencer=<uuid>
 */
import "@/lib/performance/script-env-preload";

import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import {
  collectAvatarCandidates,
  resolveDefaultMetricsPlatformAccountId,
  resolvePrimaryAvatar,
  type MetricsPlatformAccount,
  type PlatformAccountAvatarInput,
} from "@/lib/creators/creator-centric";
import {
  createScriptSupabase,
  formatScriptErrorWithDiagnostics,
  parseCliArgs,
} from "@/lib/performance/script-env";

const BATCH_SIZE = 100;

type InfluencerRow = {
  id: string;
  metadata?: Record<string, unknown> | null;
  primary_avatar_url?: string | null;
  primary_avatar_source?: string | null;
  default_metrics_platform_account_id?: string | null;
};

type PlatformAccountRow = PlatformAccountAvatarInput &
  MetricsPlatformAccount & {
    influencer_id: string;
  };

type ResolvedIdentity = {
  primaryAvatarUrl: string | null;
  primaryAvatarSource: string;
  defaultMetricsPlatformAccountId: string | null;
  defaultPlatform: string | null;
  patch: Record<string, unknown>;
};

function groupAccountsByInfluencer(
  accounts: PlatformAccountRow[]
): Map<string, PlatformAccountRow[]> {
  const map = new Map<string, PlatformAccountRow[]>();
  for (const account of accounts) {
    const list = map.get(account.influencer_id) ?? [];
    list.push(account);
    map.set(account.influencer_id, list);
  }
  return map;
}

function resolveCreatorIdentity(
  influencer: InfluencerRow,
  accounts: PlatformAccountRow[],
  discoveryProfileImageUrl: string | null
): ResolvedIdentity {
  const candidates = collectAvatarCandidates({
    storedPrimaryAvatarUrl: influencer.primary_avatar_url,
    storedPrimaryAvatarSource: influencer.primary_avatar_source,
    influencerMetadata: influencer.metadata ?? null,
    discoveryProfileImageUrl,
    accounts,
  });

  const resolved = resolvePrimaryAvatar(candidates);
  const defaultMetricsPlatformAccountId = resolveDefaultMetricsPlatformAccountId(
    accounts,
    influencer.default_metrics_platform_account_id
  );

  const defaultAccount = defaultMetricsPlatformAccountId
    ? accounts.find((a) => a.id === defaultMetricsPlatformAccountId)
    : null;
  const defaultPlatform = defaultAccount
    ? canonicalPlatformKey(defaultAccount.platform)
    : null;

  const patch: Record<string, unknown> = {};
  if (
    resolved.url !== influencer.primary_avatar_url ||
    resolved.source !== influencer.primary_avatar_source
  ) {
    patch.primary_avatar_url = resolved.url;
    patch.primary_avatar_source = resolved.source;
  }
  if (
    defaultMetricsPlatformAccountId &&
    defaultMetricsPlatformAccountId !== influencer.default_metrics_platform_account_id
  ) {
    patch.default_metrics_platform_account_id = defaultMetricsPlatformAccountId;
  }

  return {
    primaryAvatarUrl: resolved.url,
    primaryAvatarSource: resolved.source,
    defaultMetricsPlatformAccountId,
    defaultPlatform,
    patch,
  };
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  const supabase = createScriptSupabase();
  const dryRun = args["dry-run"] === true || args.dryRun === true;
  const influencerFilter =
    typeof args.influencer === "string" ? args.influencer.trim() : null;

  console.log(
    `[backfill] creator primary identity${dryRun ? " [dry-run]" : ""}${influencerFilter ? ` influencer=${influencerFilter}` : ""}`
  );

  let offset = 0;
  let processed = 0;
  let updated = 0;
  let unchanged = 0;

  while (true) {
    let query = supabase
      .from("influencers")
      .select(
        "id, metadata, primary_avatar_url, primary_avatar_source, default_metrics_platform_account_id"
      )
      .order("id", { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (influencerFilter) {
      query = query.eq("id", influencerFilter);
    }

    const { data: influencers, error: influencerError } = await query;
    if (influencerError) throw new Error(influencerError.message);

    const batch = (influencers ?? []) as InfluencerRow[];
    if (batch.length === 0) break;

    const influencerIds = batch.map((row) => row.id);

    const { data: accountsData, error: accountsError } = await supabase
      .from("influencer_platform_accounts")
      .select(
        "id, influencer_id, platform, profile_picture_url, avatar_source, metadata, follower_count"
      )
      .in("influencer_id", influencerIds);

    if (accountsError) throw new Error(accountsError.message);

    const accountsByInfluencer = groupAccountsByInfluencer(
      (accountsData ?? []) as PlatformAccountRow[]
    );

    const { data: discoveryRows, error: discoveryError } = await supabase
      .from("discovered_profiles")
      .select("influencer_id, profile_image_url")
      .in("influencer_id", influencerIds);

    if (discoveryError) throw new Error(discoveryError.message);

    const discoveryByInfluencer = new Map<string, string | null>();
    for (const row of discoveryRows ?? []) {
      const influencerId = (row as { influencer_id?: string | null }).influencer_id;
      if (!influencerId || discoveryByInfluencer.has(influencerId)) continue;
      discoveryByInfluencer.set(
        influencerId,
        (row as { profile_image_url?: string | null }).profile_image_url ?? null
      );
    }

    for (const influencer of batch) {
      const accounts = accountsByInfluencer.get(influencer.id) ?? [];
      const discoveryProfileImage = discoveryByInfluencer.get(influencer.id) ?? null;
      const resolved = resolveCreatorIdentity(influencer, accounts, discoveryProfileImage);

      console.log(`[backfill] influencer=${influencer.id}`);
      console.log(`avatar_source=${resolved.primaryAvatarSource}`);
      console.log(`default_platform=${resolved.defaultPlatform ?? "none"}`);

      processed += 1;

      if (Object.keys(resolved.patch).length === 0) {
        unchanged += 1;
        continue;
      }

      if (dryRun) {
        updated += 1;
        continue;
      }

      const { error: updateError } = await supabase
        .from("influencers")
        .update(resolved.patch as never)
        .eq("id", influencer.id);

      if (updateError) {
        throw new Error(`update failed influencer=${influencer.id}: ${updateError.message}`);
      }

      updated += 1;
    }

    if (influencerFilter || batch.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  console.log(
    `[backfill] done processed=${processed} updated=${updated} unchanged=${unchanged}${dryRun ? " (dry-run, no writes)" : ""}`
  );
}

main().catch(async (error) => {
  console.error("[backfill] fatal\n", await formatScriptErrorWithDiagnostics(error));
  process.exit(1);
});
