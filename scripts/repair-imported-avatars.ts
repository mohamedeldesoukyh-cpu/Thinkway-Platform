#!/usr/bin/env node
/**
 * One-time repair for PDF-import avatars incorrectly stored as uploaded photos.
 *
 * PDF import extracted embedded images, uploaded them to creator-avatars/imports/,
 * and marked avatar_source='uploaded'. This script clears those rows and rebuilds
 * creator identity from existing DB data only — no Apify, no external enrichment.
 *
 * Does NOT run automatically. Does NOT touch manual/operator/custom avatars.
 *
 * Run (Node 22+ on Windows with corporate TLS — use system CA store):
 *   NODE_OPTIONS=--use-system-ca npx tsx scripts/repair-imported-avatars.ts --dry-run
 *   NODE_OPTIONS=--use-system-ca npx tsx scripts/repair-imported-avatars.ts
 *   NODE_OPTIONS=--use-system-ca npx tsx scripts/repair-imported-avatars.ts --all
 *   NODE_OPTIONS=--use-system-ca npx tsx scripts/repair-imported-avatars.ts --limit=25
 *   NODE_OPTIONS=--use-system-ca npx tsx scripts/repair-imported-avatars.ts --inline
 *   NODE_OPTIONS=--use-system-ca npx tsx scripts/repair-imported-avatars.ts --handle=reemalmasryyy
 *   NODE_OPTIONS=--use-system-ca npx tsx scripts/repair-imported-avatars.ts --handle=reemalmasryyy --dry-run
 */
import "@/lib/performance/script-env-preload";

import { persistCreatorPrimaryIdentity } from "@/lib/creators/persist-primary-avatar";
import { sortPlatformsStable } from "@/lib/creators/creator-centric";
import { parseCreatorAvatarStoragePathFromUrl } from "@/lib/discovery-import/import-avatar-storage";
import { normalizeHandle } from "@/lib/intelligence/entity-resolution/normalize";
import {
  isUsableAvatarUrl,
  type AvatarSource,
} from "@/lib/performance/avatar-sync-policy";
import {
  createScriptSupabase,
  formatScriptErrorWithDiagnostics,
  getScriptSupabaseUrl,
  parseCliArgs,
  requireScriptEnvVars,
} from "@/lib/performance/script-env";

const DEFAULT_SAFETY_LIMIT = 50;
/** Reset source after clearing bad PDF-import URLs — NOT NULL column; empty URL allows resolver fallback. */
const CLEARED_PLATFORM_AVATAR_SOURCE: AvatarSource = "manual";
const UPDATE_BATCH_SIZE = 25;

type AffectedPlatformAccount = {
  id: string;
  influencer_id: string;
  platform: string;
  handle: string | null;
  username: string | null;
  profile_picture_url: string;
  avatar_source: AvatarSource;
};

type ReplacementCandidate =
  | { kind: "discovered_profile"; url: string }
  | { kind: "platform_account"; url: string; platform: string; accountId: string }
  | { kind: "influencer_metadata"; url: string };

type CreatorRepairOutcome =
  | { status: "repaired"; sourceUrl: string; sourceLabel: string }
  | { status: "no_replacement" };

function isPdfImportedAvatarUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  const storagePath = parseCreatorAvatarStoragePathFromUrl(url);
  return storagePath?.startsWith("imports/") ?? false;
}

function isValidReplacementAvatarUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  if (isPdfImportedAvatarUrl(url)) return false;
  return isUsableAvatarUrl(url);
}

function displayHandle(account: Pick<AffectedPlatformAccount, "handle" | "username">): string {
  const raw = account.handle?.trim() || account.username?.trim() || "unknown";
  return raw.startsWith("@") ? raw : `@${raw.replace(/^@+/, "")}`;
}

function formatReplacementLabel(candidate: ReplacementCandidate): string {
  switch (candidate.kind) {
    case "discovered_profile":
      return "discovered_profiles.profile_image_url";
    case "platform_account":
      return `platform_account ${candidate.platform} (${candidate.accountId})`;
    case "influencer_metadata":
      return "influencer metadata avatar";
  }
}

function parseLimitArg(args: Record<string, string | boolean>): number | null {
  const raw = args.limit;
  if (typeof raw !== "string" || !raw.trim()) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error("--limit must be a positive integer");
  }
  return parsed;
}

function parseHandleArg(args: Record<string, string | boolean>): string | null {
  const raw = args.handle;
  if (typeof raw !== "string" || !raw.trim()) return null;
  const normalized = normalizeHandle(raw);
  if (!normalized) {
    throw new Error("--handle must be a non-empty username (with or without @ prefix)");
  }
  return normalized;
}

function accountMatchesHandle(
  account: Pick<AffectedPlatformAccount, "handle" | "username">,
  normalizedHandle: string
): boolean {
  return (
    normalizeHandle(account.handle) === normalizedHandle ||
    normalizeHandle(account.username) === normalizedHandle
  );
}

function applyHandleFilterToQuery<T extends { or: (filter: string) => T }>(
  query: T,
  normalizedHandle: string
): T {
  return query.or(`handle.ilike.${normalizedHandle},username.ilike.${normalizedHandle}`);
}

async function loadAffectedPlatformAccounts(
  supabase: ReturnType<typeof createScriptSupabase>,
  maxRows: number,
  handleFilter: string | null
): Promise<AffectedPlatformAccount[]> {
  let query = supabase
    .from("influencer_platform_accounts")
    .select("id, influencer_id, platform, handle, username, profile_picture_url, avatar_source")
    .eq("avatar_source", "uploaded")
    .like("profile_picture_url", "%/creator-avatars/imports/%")
    .order("id", { ascending: true })
    .limit(maxRows);

  if (handleFilter) {
    query = applyHandleFilterToQuery(query, handleFilter);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(
      `Supabase query failed (influencer_platform_accounts) at ${getScriptSupabaseUrl()}: ${error.message}`
    );
  }

  return (data ?? [])
    .map((row) => row as AffectedPlatformAccount)
    .filter((row) => isPdfImportedAvatarUrl(row.profile_picture_url))
    .filter((row) => !handleFilter || accountMatchesHandle(row, handleFilter));
}

async function countAllAffected(
  supabase: ReturnType<typeof createScriptSupabase>,
  handleFilter: string | null
): Promise<number> {
  let query = supabase
    .from("influencer_platform_accounts")
    .select("id", { count: "exact", head: true })
    .eq("avatar_source", "uploaded")
    .like("profile_picture_url", "%/creator-avatars/imports/%");

  if (handleFilter) {
    query = applyHandleFilterToQuery(query, handleFilter);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(`Count query failed: ${error.message}`);
  }
  return count ?? 0;
}

function metadataAvatarUrl(metadata: Record<string, unknown> | null | undefined): string | null {
  if (typeof metadata?.avatar_url === "string" && metadata.avatar_url.trim()) {
    return metadata.avatar_url.trim();
  }
  if (typeof metadata?.profile_image_url === "string" && metadata.profile_image_url.trim()) {
    return metadata.profile_image_url.trim();
  }
  return null;
}

/** Scan existing DB rows for a usable avatar that is not a PDF-import storage path. */
async function findReplacementAvatar(
  supabase: ReturnType<typeof createScriptSupabase>,
  influencerId: string,
  excludeUrls: Set<string>,
  verbose: boolean
): Promise<ReplacementCandidate | null> {
  const { data: linkedDiscovery, error: discoveryError } = await supabase
    .from("discovered_profiles")
    .select("profile_image_url")
    .eq("influencer_id", influencerId)
    .limit(1)
    .maybeSingle();

  if (discoveryError) {
    throw new Error(
      `Failed to load discovered_profiles for influencer=${influencerId}: ${discoveryError.message}`
    );
  }

  const discoveryUrl = (linkedDiscovery as { profile_image_url?: string | null } | null)
    ?.profile_image_url;
  if (
    discoveryUrl &&
    !excludeUrls.has(discoveryUrl) &&
    isValidReplacementAvatarUrl(discoveryUrl)
  ) {
    if (verbose) {
      console.log(`  [scan] found discovered_profiles.profile_image_url: ${discoveryUrl}`);
    }
    return { kind: "discovered_profile", url: discoveryUrl };
  }

  const { data: accountsData, error: accountsError } = await supabase
    .from("influencer_platform_accounts")
    .select("id, platform, profile_picture_url, avatar_source")
    .eq("influencer_id", influencerId);

  if (accountsError) {
    throw new Error(
      `Failed to load platform accounts for influencer=${influencerId}: ${accountsError.message}`
    );
  }

  const accounts = (accountsData ?? []) as Array<{
    id: string;
    platform: string;
    profile_picture_url?: string | null;
    avatar_source?: string | null;
  }>;

  for (const account of sortPlatformsStable(accounts)) {
    const url = account.profile_picture_url?.trim();
    if (!url || excludeUrls.has(url) || !isValidReplacementAvatarUrl(url)) continue;

    if (verbose) {
      console.log(
        `  [scan] found platform_account ${account.platform}/${account.id}: ${url} (source=${account.avatar_source ?? "unknown"})`
      );
    }
    return {
      kind: "platform_account",
      url,
      platform: account.platform,
      accountId: account.id,
    };
  }

  const { data: influencer, error: influencerError } = await supabase
    .from("influencers")
    .select("metadata, primary_avatar_url, primary_avatar_source")
    .eq("id", influencerId)
    .maybeSingle();

  if (influencerError) {
    throw new Error(`Failed to load influencer=${influencerId}: ${influencerError.message}`);
  }

  const row = influencer as {
    metadata?: Record<string, unknown> | null;
    primary_avatar_url?: string | null;
    primary_avatar_source?: string | null;
  } | null;

  const metaUrl = metadataAvatarUrl(row?.metadata ?? null);
  if (metaUrl && !excludeUrls.has(metaUrl) && isValidReplacementAvatarUrl(metaUrl)) {
    if (verbose) {
      console.log(`  [scan] found influencer metadata avatar: ${metaUrl}`);
    }
    return { kind: "influencer_metadata", url: metaUrl };
  }

  const primaryUrl = row?.primary_avatar_url?.trim();
  const primarySource = row?.primary_avatar_source?.trim().toLowerCase();
  if (
    primaryUrl &&
    !excludeUrls.has(primaryUrl) &&
    isValidReplacementAvatarUrl(primaryUrl) &&
    (primarySource === "manual" || primarySource === "uploaded")
  ) {
    if (verbose) {
      console.log(`  [scan] found preserved primary avatar (${primarySource}): ${primaryUrl}`);
    }
    return { kind: "influencer_metadata", url: primaryUrl };
  }

  if (verbose) {
    console.log(`  [scan] no valid replacement avatar found in DB`);
  }
  return null;
}

async function clearImportedPlatformAvatar(
  supabase: ReturnType<typeof createScriptSupabase>,
  account: AffectedPlatformAccount,
  dryRun: boolean
): Promise<void> {
  if (dryRun) return;

  const { error } = await supabase
    .from("influencer_platform_accounts")
    .update({
      profile_picture_url: null,
      avatar_source: CLEARED_PLATFORM_AVATAR_SOURCE,
      avatar_last_synced_at: null,
    } as never)
    .eq("id", account.id)
    .eq("avatar_source", "uploaded");

  if (error) {
    throw new Error(
      `Failed to clear platform avatar account=${account.id} ${account.platform}/${displayHandle(account)}: ${error.message}`
    );
  }
}

async function clearMatchingInfluencerPrimaryAvatar(
  supabase: ReturnType<typeof createScriptSupabase>,
  influencerId: string,
  clearedUrls: Set<string>,
  dryRun: boolean
): Promise<boolean> {
  const { data: influencer, error: loadError } = await supabase
    .from("influencers")
    .select("id, primary_avatar_url")
    .eq("id", influencerId)
    .maybeSingle();

  if (loadError) {
    throw new Error(`Failed to load influencer=${influencerId}: ${loadError.message}`);
  }
  if (!influencer) return false;

  const primaryUrl = (influencer as { primary_avatar_url?: string | null }).primary_avatar_url;
  if (!primaryUrl || !isPdfImportedAvatarUrl(primaryUrl)) return false;
  if (!clearedUrls.has(primaryUrl)) return false;

  if (dryRun) return true;

  const { error: updateError } = await supabase
    .from("influencers")
    .update({
      primary_avatar_url: null,
      primary_avatar_source: null,
    } as never)
    .eq("id", influencerId);

  if (updateError) {
    throw new Error(
      `Failed to clear influencer primary avatar influencer=${influencerId}: ${updateError.message}`
    );
  }

  return true;
}

async function rebuildPrimaryIdentityForInfluencers(
  supabase: ReturnType<typeof createScriptSupabase>,
  influencerIds: string[],
  dryRun: boolean
): Promise<Map<string, { primaryAvatarUrl: string | null }>> {
  const results = new Map<string, { primaryAvatarUrl: string | null }>();

  for (const influencerId of influencerIds) {
    if (dryRun) {
      results.set(influencerId, { primaryAvatarUrl: null });
      continue;
    }
    const identity = await persistCreatorPrimaryIdentity(supabase, influencerId);
    results.set(influencerId, { primaryAvatarUrl: identity.primaryAvatarUrl });
  }

  return results;
}

function printCreatorRepairResult(
  influencerId: string,
  accounts: AffectedPlatformAccount[],
  outcome: CreatorRepairOutcome,
  dryRun: boolean
): void {
  const handles = accounts.map((a) => `${a.platform}/${displayHandle(a)}`).join(", ");
  console.log(`\n--- Creator repair: influencer=${influencerId} (${handles}) ---`);

  if (outcome.status === "repaired") {
    console.log(
      `  result: ${dryRun ? "would repair using existing data" : "repaired using existing data"}`
    );
    console.log(`  source: ${outcome.sourceLabel}`);
    console.log(`  URL:    ${outcome.sourceUrl}`);
    return;
  }

  console.log(
    `  result: ${dryRun ? "would have no replacement available" : "no replacement available"}`
  );
  console.log(`  note:   primary cleared — resolver will use placeholder`);
}

async function main(): Promise<void> {
  requireScriptEnvVars(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

  const args = parseCliArgs(process.argv.slice(2));
  const dryRun = args["dry-run"] === true || args.dryRun === true;
  const allFlag = args.all === true;
  const verboseScan = args.inline === true;
  const limitArg = parseLimitArg(args);
  const handleFilter = parseHandleArg(args);
  const handleMode = handleFilter !== null;

  const supabase = createScriptSupabase();

  const totalAffected = await countAllAffected(supabase, handleFilter);
  const safetyLimit =
    limitArg ?? (handleMode || allFlag ? Math.max(totalAffected, 1) : DEFAULT_SAFETY_LIMIT);
  const accounts = await loadAffectedPlatformAccounts(supabase, safetyLimit, handleFilter);

  console.log("\n=== Repair imported PDF avatars (DB-only, no Apify) ===\n");
  console.log(`Mode: ${dryRun ? "dry-run (no writes)" : "execute"}`);
  if (handleMode) {
    console.log(`Handle filter: @${handleFilter}`);
  }
  console.log(`Total matching platform accounts (DB): ${totalAffected}`);
  console.log(
    `Loaded for this run: ${accounts.length}${limitArg ? ` (--limit=${limitArg})` : handleMode ? " (--handle scoped)" : ""}`
  );
  console.log(
    `Strategy: clear PDF-import avatars → scan existing DB → rebuild primary identity (no external enrichment)`
  );
  if (verboseScan) {
    console.log(`Scan logging: verbose (--inline)`);
  }

  if (totalAffected === 0) {
    if (handleMode) {
      console.log(
        `\nNo platform accounts with uploaded PDF-import avatars found for handle @${handleFilter}. Nothing to do.`
      );
    } else {
      console.log("\nNo platform accounts with uploaded PDF-import avatars found. Nothing to do.");
    }
    return;
  }

  if (!handleMode && !allFlag && !limitArg && totalAffected > DEFAULT_SAFETY_LIMIT) {
    console.log(
      `\nSafety stop: ${totalAffected} accounts match — pass --all to process all, or narrow with --limit=N or --handle=<username>`
    );
    return;
  }

  if (accounts.length === 0) {
    console.log("\nNo accounts loaded after filters. Nothing to do.");
    return;
  }

  const influencerIds = [...new Set(accounts.map((account) => account.influencer_id))];
  const accountsByInfluencer = new Map<string, AffectedPlatformAccount[]>();
  const clearedUrlsByInfluencer = new Map<string, Set<string>>();

  for (const account of accounts) {
    const list = accountsByInfluencer.get(account.influencer_id) ?? [];
    list.push(account);
    accountsByInfluencer.set(account.influencer_id, list);

    const urls = clearedUrlsByInfluencer.get(account.influencer_id) ?? new Set<string>();
    urls.add(account.profile_picture_url);
    clearedUrlsByInfluencer.set(account.influencer_id, urls);
  }

  console.log("\n--- Affected platform accounts ---");
  for (const account of accounts) {
    console.log(
      `[repair] account=${account.id} influencer=${account.influencer_id} ${account.platform}/${displayHandle(account)}`
    );
    console.log(`         url=${account.profile_picture_url}`);
  }

  console.log("\n--- Phase 1: scan existing DB for replacement avatars (pre-clear) ---");
  const preClearCandidates = new Map<string, ReplacementCandidate | null>();
  for (const influencerId of influencerIds) {
    const excludeUrls = clearedUrlsByInfluencer.get(influencerId) ?? new Set<string>();
    console.log(`\n[repair] scanning influencer=${influencerId}`);
    const candidate = await findReplacementAvatar(supabase, influencerId, excludeUrls, verboseScan);
    preClearCandidates.set(influencerId, candidate);
  }

  console.log("\n--- Phase 2: clear imported avatars ---");

  let clearedPlatform = 0;
  for (let index = 0; index < accounts.length; index += UPDATE_BATCH_SIZE) {
    const batch = accounts.slice(index, index + UPDATE_BATCH_SIZE);
    for (const account of batch) {
      if (dryRun) {
        console.log(
          `[repair] would clear ${account.platform}/${displayHandle(account)} account=${account.id}`
        );
      } else {
        await clearImportedPlatformAvatar(supabase, account, dryRun);
        console.log(`[repair] cleared ${account.platform}/${displayHandle(account)} account=${account.id}`);
      }
      clearedPlatform += 1;
    }
  }

  let clearedPrimary = 0;
  for (const influencerId of influencerIds) {
    const clearedUrls = clearedUrlsByInfluencer.get(influencerId) ?? new Set<string>();
    const wouldClear = await clearMatchingInfluencerPrimaryAvatar(
      supabase,
      influencerId,
      clearedUrls,
      dryRun
    );
    if (wouldClear) {
      clearedPrimary += 1;
      console.log(
        `[repair] ${dryRun ? "would clear" : "cleared"} influencer primary avatar influencer=${influencerId}`
      );
    }
  }

  console.log("\n--- Phase 3: rebuild creator primary identity ---");
  const identityResults = await rebuildPrimaryIdentityForInfluencers(
    supabase,
    influencerIds,
    dryRun
  );
  console.log(`[repair] primary identity ${dryRun ? "would rebuild" : "rebuilt"} for ${influencerIds.length} influencer(s)`);

  console.log("\n--- Phase 4: per-creator results ---");
  let repairedCount = 0;
  let noReplacementCount = 0;

  for (const influencerId of influencerIds) {
    const influencerAccounts = accountsByInfluencer.get(influencerId) ?? [];
    const preCandidate = preClearCandidates.get(influencerId) ?? null;

    let outcome: CreatorRepairOutcome;
    if (dryRun) {
      if (preCandidate) {
        outcome = {
          status: "repaired",
          sourceUrl: preCandidate.url,
          sourceLabel: formatReplacementLabel(preCandidate),
        };
        repairedCount += 1;
      } else {
        outcome = { status: "no_replacement" };
        noReplacementCount += 1;
      }
    } else {
      const identity = identityResults.get(influencerId);
      const resolvedUrl = identity?.primaryAvatarUrl ?? null;
      if (isValidReplacementAvatarUrl(resolvedUrl)) {
        outcome = {
          status: "repaired",
          sourceUrl: resolvedUrl!,
          sourceLabel: preCandidate
            ? formatReplacementLabel(preCandidate)
            : "persistCreatorPrimaryIdentity",
        };
        repairedCount += 1;
      } else {
        outcome = { status: "no_replacement" };
        noReplacementCount += 1;
      }
    }

    printCreatorRepairResult(influencerId, influencerAccounts, outcome, dryRun);
  }

  console.log("\n=== Summary ===");
  console.log(`Affected platform accounts: ${accounts.length}`);
  console.log(`Unique influencers: ${influencerIds.length}`);
  console.log(`Influencer IDs: ${influencerIds.join(", ")}`);
  console.log(`Handles: ${accounts.map((a) => `${a.platform}/${displayHandle(a)}`).join(", ")}`);
  console.log(`Platform avatars cleared: ${clearedPlatform}`);
  console.log(`Influencer primary avatars cleared: ${clearedPrimary}`);
  console.log(
    `${dryRun ? "Would repair" : "Repaired"} using existing data: ${repairedCount}`
  );
  console.log(`No replacement available: ${noReplacementCount}`);
  if (dryRun) {
    console.log("No database writes were made. No Apify or external API calls.");
  } else {
    console.log("No Apify or external enrichment was used.");
  }
  console.log("");
}

main().catch(async (error) => {
  console.error("[repair] fatal\n", await formatScriptErrorWithDiagnostics(error));
  process.exit(1);
});
