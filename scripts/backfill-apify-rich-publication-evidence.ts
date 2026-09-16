/** READ ONLY. No apply/write mode, database writer, actor execution, or implicit target. */
import { normalizeApifyProfileData } from "@/lib/creator-enrichment/apify-profile";
import {
  createReadOnlyStorage, normalizeUsername, planPublicationBackfill, readAllPages,
  stableId, TARGETS, splitPreflightDnaRows, type Account, type RawDnaRow, type Evidence,
} from "@/lib/creators/apify-publication-preflight";
import { ApifyPreflightCache } from "@/lib/creators/apify-preflight-cache";
import { scanDatasets } from "@/lib/creators/apify-preflight-scan";
import type { ReadOptions, ReadProgress } from "@/lib/creators/preflight-get";

type Run = { id: string; actId?: string; actorId?: string; defaultDatasetId?: string; finishedAt?: string; status: string };
type Snapshot = { platform_account_id: string; influencer_id: string; raw_snapshot: { platformKey?: string; username?: string; profileRows?: Record<string, unknown>[] } };

/** Configuration compatibility only; never decode URLs or accept endpoint paths. */
export function normalizePreflightActorReference(reference: string | undefined): string {
  const value = reference?.trim();
  if (!value) throw new Error("Configured Instagram actor required");
  const normalized = /^[A-Za-z0-9][A-Za-z0-9_-]*\/[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value)
    ? value.replace("/", "~") : value;
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*(?:~[A-Za-z0-9][A-Za-z0-9_-]*)?$/.test(normalized)) {
    throw new Error("Invalid configured Instagram actor reference");
  }
  return normalized;
}

export async function runPreflight(args: string[], env: Record<string, string | undefined>, transport: typeof fetch = fetch, options: ReadOptions = {}) {
  if (args.some(a => !/^--(target=(development|production)|preflight|before=.+|explain|no-cache|cache-dir=.+|concurrency=\d+|page-size=\d+)$/.test(a))) throw new Error("Unsupported option. This command has no write mode.");
  const optionNames = args.map(a => a.split("=")[0]);
  if (new Set(optionNames).size !== optionNames.length || (args.includes("--no-cache") && args.some(a => a.startsWith("--cache-dir=")))) throw new Error("Duplicate or conflicting options");
  const targets = args.filter(a => a.startsWith("--target="));
  if (targets.length !== 1 || !args.includes("--preflight")) throw new Error("Require --preflight --target=development|production");
  const target = targets[0]!.split("=")[1] as keyof typeof TARGETS;
  const before = args.find(a => a.startsWith("--before="))?.slice(9) ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(before))) throw new Error("Invalid snapshot boundary");
  const boundary = new Date(before).toISOString();
  const actorName = normalizePreflightActorReference(env.APIFY_INSTAGRAM_ACTOR_ID);
  const concurrency = Number(args.find(a => a.startsWith("--concurrency="))?.split("=")[1] ?? 4);
  const pageSize = Number(args.find(a => a.startsWith("--page-size="))?.split("=")[1] ?? 10_000);
  if (concurrency < 1 || concurrency > 8 || pageSize < 1 || pageSize > 50_000) throw new Error("Invalid bounded scan options");
  const readStats = { apifyRequests: 0, supabaseRequests: 0, retries: 0, cachedDatasets: 0, cachedRows: 0, downloadedPages: 0 };
  const progress = (event: ReadProgress) => {
    if (event.event === "request") {
      if (event.service === "apify") readStats.apifyRequests++;
      else readStats.supabaseRequests++;
    }
    if (event.event === "retry") readStats.retries++;
    if (event.event === "cache-hit") { readStats.cachedDatasets++; readStats.cachedRows += Number(event.rows); }
    if (event.event === "dataset-page") readStats.downloadedPages++;
    options.progress?.({ ...event, apifyRequests: readStats.apifyRequests, supabaseRequests: readStats.supabaseRequests });
  };
  const reader = createReadOnlyStorage(target, env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "", env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "", env.APIFY_TOKEN?.trim() ?? "", transport, { ...options, progress });
  progress({ event: "start", boundary, concurrency, pageSize });
  // Authenticate all required reads before touching Apify storage.
  const accounts = (await reader.table<Omit<Account, "stableIds">>("influencer_platform_accounts", "select=id,influencer_id,platform,handle,username,normalized_username,recent_publications,field_sources&platform=ilike.instagram&order=id.asc"))
    .map(a => ({ ...a, stableIds: [] as string[] }));
  if (!accounts.length) throw new Error("No Instagram accounts visible; refusing an unverifiable empty preflight");
  const dnaRows = await reader.table<RawDnaRow>("creator_dna", "select=*&order=influencer_id.asc");
  const { valid: dna, malformed: malformedDnaRows } = splitPreflightDnaRows(dnaRows);
  const malformedDnaIds = new Set(malformedDnaRows.map(row => row.influencerId));
  for (const row of malformedDnaRows) progress({ event: "dna-quarantined", influencerId: row.influencerId, reason: row.reason });
  const snapshots = await reader.table<Snapshot>("ipl_snapshots", "select=platform_account_id,influencer_id,raw_snapshot&provider=eq.apify&platform=ilike.instagram&order=id.asc");
  for (const snapshot of snapshots) {
    const account = accounts.find(a => a.id === snapshot.platform_account_id);
    if (!account || account.influencer_id !== snapshot.influencer_id) continue;
    // Account-linked profile IDs only; never post IDs or display names.
    if (snapshot.raw_snapshot?.platformKey !== "instagram") continue;
    for (const row of snapshot.raw_snapshot.profileRows ?? []) {
      const id = stableId(row.id);
      const username = normalizeUsername(row.username);
      if (id && username && username === normalizeUsername(snapshot.raw_snapshot.username)) account.stableIds = [...new Set([...account.stableIds, id])];
    }
  }
  const actor = await reader.apify<{ data: { id: string } }>(`acts/${encodeURIComponent(actorName)}`);
  if (!actor.data?.id) throw new Error("Instagram actor identity unavailable");
  const runs = (await readAllPages<Run>(async (offset, limit) => {
    const page = await reader.apify<{ data: { total: number; items: Run[] } }>(`actors/${encodeURIComponent(actor.data.id)}/runs?offset=${offset}&limit=${limit}&desc=0&status=SUCCEEDED&startedBefore=${encodeURIComponent(boundary)}`);
    progress({ event: "runs-page", offset, total: page.data.total });
    return page.data;
  })).filter(r => r.status === "SUCCEEDED" && [r.actId, r.actorId].some(id => id === actor.data.id || id === actorName) && r.defaultDatasetId && r.finishedAt && new Date(r.finishedAt).toISOString() <= boundary)
    .sort((a,b) => b.finishedAt!.localeCompare(a.finishedAt!) || a.id.localeCompare(b.id));
  if (new Set(runs.map(r => r.id)).size !== runs.length) throw new Error("Run inventory changed during pagination");
  const cache = args.includes("--no-cache") ? undefined : await ApifyPreflightCache.open(
    args.find(a => a.startsWith("--cache-dir="))?.slice(12) ?? ".tmp/apify-publication-preflight-cache",
    [env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "", env.APIFY_TOKEN?.trim() ?? ""],
  );
  const evidenceByRun = new Map<string, Evidence[]>();
  const runsByDataset = new Map<string, Run[]>();
  for (const run of runs) runsByDataset.set(run.defaultDatasetId!, [...(runsByDataset.get(run.defaultDatasetId!) ?? []), run]);
  let invalidRows = 0;
  let scannedRows = 0;
  const scan = await scanDatasets(reader, [...runsByDataset.keys()], (datasetId, rows) => {
    for (const run of runsByDataset.get(datasetId)!) {
      const evidence: Evidence[] = [];
      for (const raw of rows) {
        scannedRows++;
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) { invalidRows++; continue; }
        const row = raw as Record<string, unknown>;
        const ownerId = stableId(row.ownerId);
        if (row.ownerId != null && !ownerId) { invalidRows++; continue; }
        const username = normalizeUsername(row.ownerUsername);
        const accountMatch = ownerId ? accounts.filter(a => a.stableIds.includes(ownerId)) : [];
        const normalizationName = username ?? (accountMatch.length === 1 ? normalizeUsername(accountMatch[0]!.username ?? accountMatch[0]!.handle) : null);
        if (!normalizationName) { invalidRows++; continue; }
        const publication = normalizeApifyProfileData({ platformKey: "instagram", username: normalizationName,
          profileUrl: `https://www.instagram.com/${normalizationName}/`, profileRows: [], postRows: [row],
          apifyRunId: run.id, apifyDatasetId: run.defaultDatasetId!, fetchedAt: run.finishedAt!,
        })?.recentPublications[0];
        if (!publication || (!publication.platformPostId && !publication.url)) { invalidRows++; continue; }
        evidence.push({ ownerId, username, publication, capturedAt: run.finishedAt! });
      }
      evidenceByRun.set(run.id, evidence);
    }
  }, { cache, concurrency, pageSize, progress });
  // Restore the original newest-run-first evidence order, independently of
  // concurrent download completion. Matching and merge semantics stay unchanged.
  const evidence = runs.flatMap(run => evidenceByRun.get(run.id) ?? []);
  progress({ event: "planning", scannedRows, invalidRows });
  const plan = planPublicationBackfill(accounts, dna, evidence, malformedDnaIds);
  const quarantinedDatasets = scan.quarantined.map(dataset => ({ ...dataset,
    runIds: runsByDataset.get(dataset.datasetId)!.map(run => run.id).sort(),
  }));
  return { complete: scan.complete && malformedDnaRows.length === 0, evidenceScope: "complete-datasets-only",
    completeDatasetIds: scan.completeDatasetIds, quarantinedDatasets, unresolvedDatasets: scan.unresolvedDatasets,
    malformedDnaRows, unresolvedMalformedDna: malformedDnaRows.length,
    target, mode: "read-only-preflight", boundary, instagramRuns: runs.length, scannedRows, invalidRows, readStats: { ...readStats, ...scan },
    ...plan.summary, skipped: plan.summary.skipped + invalidRows,
    recommendation: scan.unresolvedDatasets || malformedDnaRows.length || plan.summary.conflicts || plan.summary.ambiguous || invalidRows ? "BLOCKED" : "REVIEW_REQUIRED_NO_WRITE_MODE",
    skippedDetails: plan.skipped, identityIssues: plan.identityIssues,
    ...(args.includes("--explain") ? { accountPlans: plan.accountPlans, dnaPlans: plan.dnaPlans } : {}),
  };
}
if (require.main === module) {
  const log = console.log.bind(console);
  console.log = (...values: unknown[]) => { if (!(typeof values[0] === "string" && values[0].startsWith("[creator-enrichment:apify]"))) log(...values); };
  let latest: ReadProgress = { event: "starting" }, lastPrinted = 0;
  const print = () => { console.error(`[apify-preflight-progress] ${JSON.stringify(latest)}`); lastPrinted = Date.now(); };
  const heartbeat = setInterval(print, 20_000);
  heartbeat.unref();
  runPreflight(process.argv.slice(2), process.env, fetch, { progress(event) {
    latest = event;
    if (event.event === "retry" || Date.now() - lastPrinted >= 2_000) print();
  } }).then(report => console.log(JSON.stringify(report, null, 2)))
    .catch(error => {
      let message = error instanceof Error ? error.message : "Failed";
      for (const secret of [process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.APIFY_TOKEN]) if (secret) message = message.split(secret).join("[REDACTED]");
      console.error(`[apify-publication-preflight] BLOCKED: ${message}`); process.exitCode = 1;
    }).finally(() => clearInterval(heartbeat));
}
