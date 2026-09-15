/** READ ONLY. No apply/write mode, database writer, actor execution, or implicit target. */
import { normalizeApifyProfileData } from "@/lib/creator-enrichment/apify-profile";
import {
  createReadOnlyStorage, normalizeUsername, planPublicationBackfill, readAllPages,
  stableId, TARGETS, type Account, type DnaRow, type Evidence,
} from "@/lib/creators/apify-publication-preflight";

type Run = { id: string; actId?: string; actorId?: string; defaultDatasetId?: string; finishedAt?: string; status: string };
type Snapshot = { platform_account_id: string; influencer_id: string; raw_snapshot: { platformKey?: string; username?: string; profileRows?: Record<string, unknown>[] } };

export async function runPreflight(args: string[], env: Record<string, string | undefined>, transport: typeof fetch = fetch) {
  if (args.some(a => !/^--(target=(development|production)|preflight|before=.+|explain)$/.test(a))) throw new Error("Unsupported option. This command has no write mode.");
  const targets = args.filter(a => a.startsWith("--target="));
  if (targets.length !== 1 || !args.includes("--preflight")) throw new Error("Require --preflight --target=development|production");
  const target = targets[0]!.split("=")[1] as keyof typeof TARGETS;
  const before = args.find(a => a.startsWith("--before="))?.slice(9) ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(before))) throw new Error("Invalid snapshot boundary");
  const boundary = new Date(before).toISOString();
  const reader = createReadOnlyStorage(target, env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "", env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "", env.APIFY_TOKEN?.trim() ?? "", transport);
  // Authenticate all required reads before touching Apify storage.
  const accounts = (await reader.table<Omit<Account, "stableIds">>("influencer_platform_accounts", "select=id,influencer_id,platform,handle,username,normalized_username,recent_publications,field_sources&platform=ilike.instagram&order=id.asc"))
    .map(a => ({ ...a, stableIds: [] as string[] }));
  if (!accounts.length) throw new Error("No Instagram accounts visible; refusing an unverifiable empty preflight");
  const dna = await reader.table<DnaRow>("creator_dna", "select=*&order=influencer_id.asc");
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
  const actorName = env.APIFY_INSTAGRAM_ACTOR_ID?.trim();
  if (!actorName) throw new Error("Configured Instagram actor required");
  const actor = await reader.apify<{ data: { id: string } }>(`acts/${encodeURIComponent(actorName)}`);
  if (!actor.data?.id) throw new Error("Instagram actor identity unavailable");
  const runs = (await readAllPages<Run>(async (offset, limit) => {
    const page = await reader.apify<{ data: { total: number; items: Run[] } }>(`actor-runs?offset=${offset}&limit=${limit}&desc=1`);
    return page.data;
  })).filter(r => r.status === "SUCCEEDED" && [r.actId, r.actorId].some(id => id === actor.data.id || id === actorName) && r.defaultDatasetId && r.finishedAt && new Date(r.finishedAt).toISOString() <= boundary)
    .sort((a,b) => b.finishedAt!.localeCompare(a.finishedAt!) || a.id.localeCompare(b.id));
  const evidence: Evidence[] = [];
  let invalidRows = 0;
  let scannedRows = 0;
  for (const run of runs) {
    const path = `datasets/${encodeURIComponent(run.defaultDatasetId!)}`;
    const metadata = await reader.apify<{ data: { itemCount: number } }>(path);
    const rows = await readAllPages<unknown>(async (offset, limit) => ({
      items: await reader.apify<unknown[]>(`${path}/items?format=json&offset=${offset}&limit=${limit}&clean=false`), total: metadata.data.itemCount,
    }));
    const after = await reader.apify<{ data: { itemCount: number } }>(path);
    if (after.data.itemCount !== metadata.data.itemCount) throw new Error("Dataset changed during read");
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
  }
  const plan = planPublicationBackfill(accounts, dna, evidence);
  return { target, mode: "read-only-preflight", boundary, instagramRuns: runs.length, scannedRows, invalidRows,
    ...plan.summary, skipped: plan.summary.skipped + invalidRows,
    recommendation: plan.summary.conflicts || plan.summary.ambiguous || invalidRows ? "BLOCKED" : "REVIEW_REQUIRED_NO_WRITE_MODE",
    skippedDetails: plan.skipped, identityIssues: plan.identityIssues,
    ...(args.includes("--explain") ? { accountPlans: plan.accountPlans, dnaPlans: plan.dnaPlans } : {}),
  };
}
if (require.main === module) {
  const log = console.log.bind(console);
  console.log = (...values: unknown[]) => { if (!(typeof values[0] === "string" && values[0].startsWith("[creator-enrichment:apify]"))) log(...values); };
  runPreflight(process.argv.slice(2), process.env).then(report => console.log(JSON.stringify(report, null, 2)))
    .catch(error => { console.error(`[apify-publication-preflight] ${error instanceof Error ? error.message : "Failed"}`); process.exitCode = 1; });
}
