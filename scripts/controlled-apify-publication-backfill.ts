/** Manifest mode is GET-only and cache-only. Apply is a separate explicit command. */
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { normalizeApifyProfileData } from "@/lib/creator-enrichment/apify-profile";
import { createReadOnlyStorage, normalizeUsername, readAllPages, splitPreflightDnaRows, stableId,
  type Account, type Evidence, type RawDnaRow } from "@/lib/creators/apify-publication-preflight";
import { ApifyPreflightCache } from "@/lib/creators/apify-preflight-cache";
import { applyManifest, BACKFILL_BOUNDARY, EXCLUDED_DATASETS, EXCLUDED_DNA, PRODUCTION_REF,
  buildSafeSubsetManifest, validateManifest, type ExecutionManifest } from "@/lib/creators/controlled-publication-backfill";
import { createTransactionalProductionIO } from "@/lib/creators/controlled-publication-backfill-io";
import { normalizePreflightActorReference } from "./backfill-apify-rich-publication-evidence";

type Run = { id: string; actId?: string; actorId?: string; defaultDatasetId?: string; finishedAt?: string; status: string };
type Snapshot = { platform_account_id: string; influencer_id: string; raw_snapshot: { platformKey?: string; username?: string; profileRows?: Record<string, unknown>[] } };
const cachePath = ".tmp/apify-publication-preflight-cache";
const manifestPath = ".tmp/controlled-backfill/manifest.json";

export async function generateRealManifest(env: Record<string,string|undefined>, transport: typeof fetch = fetch) {
  if (!(await stat(cachePath)).isDirectory()) throw new Error("Existing cache is required");
  const reader = createReadOnlyStorage("production", `https://${PRODUCTION_REF}.supabase.co`,
    env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "", env.APIFY_TOKEN?.trim() ?? "", transport);
  const accountBefore = await reader.table<Record<string,unknown>>("influencer_platform_accounts",
    "select=*&platform=ilike.instagram&order=id.asc");
  const accounts: Account[] = accountBefore.map(row => ({ ...row, id: String(row.id), influencer_id: String(row.influencer_id),
    platform: row.platform as string | null, stableIds: [], recent_publications: row.recent_publications }));
  if (!accounts.length) throw new Error("No Production Instagram accounts visible");
  const rawDna = await reader.table<RawDnaRow>("creator_dna", "select=*&order=influencer_id.asc");
  const { valid: dna, malformed } = splitPreflightDnaRows(rawDna);
  if (malformed.length !== 1 || malformed[0]?.influencerId !== EXCLUDED_DNA) throw new Error("Malformed DNA exclusion differs from approved preflight");
  const snapshots = await reader.table<Snapshot>("ipl_snapshots",
    "select=platform_account_id,influencer_id,raw_snapshot&provider=eq.apify&platform=ilike.instagram&order=id.asc");
  const byAccount = new Map(accounts.map(a => [a.id,a]));
  for (const snapshot of snapshots) {
    const account = byAccount.get(snapshot.platform_account_id);
    if (!account || account.influencer_id !== snapshot.influencer_id || snapshot.raw_snapshot?.platformKey !== "instagram") continue;
    for (const row of snapshot.raw_snapshot.profileRows ?? []) {
      const id = stableId(row.id);
      if (id && normalizeUsername(row.username) === normalizeUsername(snapshot.raw_snapshot.username))
        account.stableIds = [...new Set([...account.stableIds,id])];
    }
  }
  const actorName = normalizePreflightActorReference(env.APIFY_INSTAGRAM_ACTOR_ID);
  const actor = await reader.apify<{data:{id:string}}>(`acts/${encodeURIComponent(actorName)}`);
  if (!actor.data?.id) throw new Error("Actor identity unavailable");
  // Run inventory only: no dataset metadata or items HTTP requests.
  const rawRuns = await readAllPages<Run>(async (offset,limit) => {
    const response = await reader.apify<{data:{total:number;items:Run[]}}>(
      `actor-runs?offset=${offset}&limit=${limit}&desc=0`);
    return response.data;
  });
  const listedRuns = rawRuns.filter(run => run.status === "SUCCEEDED" && [run.actId,run.actorId].some(id => id === actor.data.id || id === actorName) &&
    run.defaultDatasetId && run.finishedAt && new Date(run.finishedAt).toISOString() <= BACKFILL_BOUNDARY)
    .sort((a,b) => b.finishedAt!.localeCompare(a.finishedAt!) || a.id.localeCompare(b.id));
  const cachedIds = (await readdir(cachePath)).filter(name => name.endsWith(".json") && !name.endsWith(".page.json"))
    .map(name => name.slice(0,-5));
  if (cachedIds.length !== 7421 || new Set(cachedIds).size !== 7421) throw new Error("Existing cache inventory differs from approved preflight");
  const listedIds = new Set(listedRuns.map(run => run.defaultDatasetId!));
  const missingIds = cachedIds.filter(id => !listedIds.has(id));
  const runs=listedRuns;
  const datasets = new Set(runs.map(run => run.defaultDatasetId!));
  if (runs.length !== 7079 || missingIds.length !== 342 ||
      new Set(runs.map(run => run.id)).size !== runs.length || datasets.size !== runs.length ||
      EXCLUDED_DATASETS.some(id => !datasets.has(id))) throw new Error("Current run inventory is inconsistent");
  const cache = await ApifyPreflightCache.open(cachePath, [env.SUPABASE_SERVICE_ROLE_KEY ?? "",env.APIFY_TOKEN ?? ""]);
  const evidence: Evidence[] = [];
  let completeDatasets = 0;
  const excluded = new Set<string>(EXCLUDED_DATASETS);
  // All 342 unresolved datasets are recorded by ID but their cached rows are
  // never opened or normalized. They contribute zero evidence by construction.
  for (const run of runs) {
    const datasetId = run.defaultDatasetId!;
    if (excluded.has(datasetId)) continue;
    const cached = await cache.load(datasetId);
    if (!cached || cached.rows.length !== cached.revision.itemCount) throw new Error(`Missing complete validated cache: ${datasetId}`);
    completeDatasets++;
    for (const raw of cached.rows) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const row = raw as Record<string,unknown>;
      const ownerId = stableId(row.ownerId);
      if (row.ownerId != null && !ownerId) continue;
      const username = normalizeUsername(row.ownerUsername);
      const accountMatch = ownerId ? accounts.filter(a => a.stableIds.includes(ownerId)) : [];
      const normalizationName = username ?? (accountMatch.length === 1 ? normalizeUsername(accountMatch[0]!.username ?? accountMatch[0]!.handle) : null);
      if (!normalizationName) continue;
      const publication = normalizeApifyProfileData({ platformKey: "instagram", username: normalizationName,
        profileUrl: `https://www.instagram.com/${normalizationName}/`, profileRows: [], postRows: [row],
        apifyRunId: run.id, apifyDatasetId: datasetId, fetchedAt: run.finishedAt!,
      })?.recentPublications[0];
      if (!publication || (!publication.platformPostId && !publication.url)) continue;
      evidence.push({ ownerId, username, publication, capturedAt: run.finishedAt! });
    }
  }
  if (completeDatasets !== 7076) throw new Error("Complete verified-cache count differs from safe subset");
  return buildSafeSubsetManifest({ accounts, accountBefore, dna, evidence,
    verifiedRuns: runs.map(run => ({runId:run.id,datasetId:run.defaultDatasetId!,finishedAt:run.finishedAt!,status:"SUCCEEDED",actorId:actor.data.id})),
    unresolvedDatasetIds: missingIds, actorId: actor.data.id, completeDatasets });
}

export async function runControlledCommand(args: string[], env: Record<string,string|undefined>) {
  if (args.length === 1 && args[0] === "--manifest") {
    const manifest = await generateRealManifest(env);
    const path = resolve(manifestPath);
    await mkdir(resolve(".tmp/controlled-backfill"), { recursive: true });
    await writeFile(path, JSON.stringify(manifest,null,2), { flag: "wx", mode: 0o600 });
    return { mode: "manifest-only", path, digest: manifest.digest, creators: manifest.creators.length,
      publications: manifest.publications.length, accountUpdates: manifest.accountWrites.length,
      dnaUpdates: manifest.dnaWrites.length, expectedTargetWrites: manifest.expectedWrites,
      expectedVersionInserts: manifest.dnaWrites.length, expectedLineageInserts: manifest.dnaWrites.length,
      verifiedDatasets: manifest.verifiedDatasets, unresolvedDatasets: manifest.unresolvedDatasets,
      unmatched: manifest.planning.unmatchedCreators, ambiguous: manifest.planning.ambiguous,
      conflicts: manifest.planning.conflicts, duplicateProposals: manifest.planning.duplicateProposals,
      creatorsLost: 38-manifest.creators.length, publicationsLost: 41-manifest.publications.length,
      actualTargetWrites: 0 };
  }
  if (args.length !== 3 || !args.includes("--apply") || !args.includes(`--target=${PRODUCTION_REF}`) ||
      args.filter(arg => /^--digest=[a-f0-9]{64}$/.test(arg)).length !== 1)
    throw new Error("Require separate --apply, exact Production target and sealed manifest digest");
  const digest = args.find(arg => arg.startsWith("--digest="))!.slice(9);
  const manifest = JSON.parse(await readFile(resolve(manifestPath), "utf8")) as ExecutionManifest;
  validateManifest(manifest);
  if (manifest.digest !== digest) throw new Error("Manifest digest authorization mismatch");
  return applyManifest(manifest, { apply: true, target: PRODUCTION_REF, digest },
    createTransactionalProductionIO(PRODUCTION_REF,digest));
}

if (require.main === module) {
  const originalLog = console.log.bind(console);
  console.log = (...values: unknown[]) => {
    if (!(typeof values[0] === "string" && values[0].startsWith("[creator-enrichment:apify]"))) originalLog(...values);
  };
  runControlledCommand(process.argv.slice(2),process.env)
    .then(result => console.log(JSON.stringify(result,null,2)))
    .catch(error => { console.error(`Controlled backfill stopped: ${error instanceof Error ? error.message : "Failure"}`); process.exitCode=1; });
}
