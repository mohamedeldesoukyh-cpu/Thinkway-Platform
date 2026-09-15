/**
 * Development-only, idempotent backfill of retained Apify Instagram post
 * evidence. Reads Apify dataset storage only; it never launches an actor.
 *
 * Default: dry run. Add --apply only after reviewing the printed plan.
 */
import { createClient } from "@supabase/supabase-js";

import { normalizeApifyProfileData } from "@/lib/creator-enrichment/apify-profile";
import { mergeCreatorRecentPublications } from "@/lib/creators/publication-evidence";
import type { CreatorRecentPublication } from "@/lib/creators/types";
import { CreatorDNAService } from "@/features/creator-dna/services/creator-dna-service";
import { mergeCandidatesIntoDocument } from "@/features/creator-dna/services/dna-merge-engine";
import { createEmptyCreatorDNADocument } from "@/features/creator-dna/services/document-factory";
import type { CreatorDNADocument } from "@/features/creator-dna/types";

const DEVELOPMENT_REF = "hsxrewjcbvmbkqdlzjhs";
const INSTAGRAM_ACTOR_ID = process.env.APIFY_INSTAGRAM_ACTOR_ID?.trim() ?? "";
const apply = process.argv.includes("--apply");
const snapshotBeforeArg = process.argv.find((argument) => argument.startsWith("--before="));
const snapshotBefore = snapshotBeforeArg ? snapshotBeforeArg.slice("--before=".length) : null;

if (snapshotBefore && Number.isNaN(Date.parse(snapshotBefore))) {
  fail(`Invalid fixed snapshot boundary: ${snapshotBefore}.`);
}

// The established normalizer traces every historical item. This one-off
// backfill deliberately reports only progress and its aggregate plan.
const writeLog = console.log.bind(console);
console.log = (...args: unknown[]) => {
  if (typeof args[0] === "string" && args[0].startsWith("[creator-enrichment:apify]")) return;
  writeLog(...args);
};

type Account = {
  id: string;
  influencer_id: string;
  platform: string | null;
  handle: string | null;
  username: string | null;
  recent_publications: unknown;
  field_sources: Record<string, unknown> | null;
};

type ApifyRun = {
  id: string;
  actId?: string;
  actorId?: string;
  defaultDatasetId?: string;
  finishedAt?: string | null;
  status?: string;
};

type Plan = {
  account: Account;
  document: CreatorDNADocument | undefined;
  publications: CreatorRecentPublication[];
  accountPublications: CreatorRecentPublication[];
  dnaPublications: CreatorRecentPublication[];
  accountChanged: boolean;
  dnaChanged: boolean;
  dnaWillCreate: boolean;
  freshestAt: string;
};

function resolveDnaPublicationCandidate(
  document: CreatorDNADocument | undefined,
  publications: CreatorRecentPublication[],
  updatedAt: string
) {
  const draft = structuredClone(document ?? createEmptyCreatorDNADocument());
  mergeCandidatesIntoDocument(draft, [{
    path: "content.recentPublications",
    value: publications,
    confidence: 0.7,
    source: "ipl",
    sourceVersion: "apify-historical-publication-evidence-v1",
    updatedAt,
  }]);
  return draft.content.recentPublications;
}

function fail(message: string): never {
  console.error(`[apify-rich-publication-backfill] ${message}`);
  process.exit(1);
}

function normalizeHandle(value: string | null | undefined): string | null {
  const normalized = value?.replace(/^@+/, "").trim().toLowerCase();
  return normalized || null;
}

function stableJson(value: unknown): string {
  if (value == null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(",")}}`;
}

function sameJson(left: unknown, right: unknown): boolean {
  return stableJson(left) === stableJson(right);
}

function publicationDiff(
  existing: CreatorRecentPublication[],
  proposed: CreatorRecentPublication[]
): Array<{ identity: string; existing: CreatorRecentPublication | null; proposed: CreatorRecentPublication | null }> {
  const key = (publication: CreatorRecentPublication) =>
    publication.platformPostId ? `post:${publication.platformPostId}` : `url:${publication.url ?? "unknown"}`;
  const existingByKey = new Map(existing.map((publication) => [key(publication), publication]));
  const proposedByKey = new Map(proposed.map((publication) => [key(publication), publication]));
  return [...new Set([...existingByKey.keys(), ...proposedByKey.keys()])]
    .map((identity) => ({
      identity,
      existing: existingByKey.get(identity) ?? null,
      proposed: proposedByKey.get(identity) ?? null,
    }))
    .filter((item) => !sameJson(item.existing, item.proposed));
}

async function fetchApify<T>(token: string, path: string): Promise<T> {
  let lastStatus: number | null = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`https://api.apify.com/v2/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) return (await response.json()) as T;
    lastStatus = response.status;
    if (response.status !== 429 && response.status < 500) break;
    await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
  }
  throw new Error(`Apify storage request failed (${lastStatus ?? "unknown"}).`);
}

async function loadAllInstagramAccounts(supabase: ReturnType<typeof createClient>): Promise<Account[]> {
  const rows: Account[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("influencer_platform_accounts")
      .select("id,influencer_id,platform,handle,username,recent_publications,field_sources")
      .ilike("platform", "instagram")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as Account[]));
    if (!data || data.length < 1000) return rows;
  }
}

async function loadRuns(token: string): Promise<ApifyRun[]> {
  const first = await fetchApify<{ data: { total: number; items: ApifyRun[] } }>(
    token,
    "actor-runs?limit=1000&offset=0&desc=1"
  );
  const runs = [...first.data.items];
  for (let offset = 1000; offset < first.data.total; offset += 1000) {
    const page = await fetchApify<{ data: { items: ApifyRun[] } }>(
      token,
      `actor-runs?limit=1000&offset=${offset}&desc=1`
    );
    runs.push(...page.data.items);
  }
  return runs;
}

async function resolveInstagramActorRunIds(token: string): Promise<Set<string>> {
  const actor = await fetchApify<{ data?: { id?: string } }>(
    token,
    `acts/${encodeURIComponent(INSTAGRAM_ACTOR_ID)}`
  );
  const resolved = actor.data?.id?.trim();
  if (!resolved) throw new Error("Configured Instagram actor could not be resolved through Apify storage API.");
  return new Set([INSTAGRAM_ACTOR_ID, resolved]);
}

async function mapWithConcurrency<T, R>(
  values: T[],
  limit: number,
  fn: (value: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(values.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, async () => {
      while (true) {
        const index = next++;
        if (index >= values.length) return;
        results[index] = await fn(values[index]!, index);
      }
    })
  );
  return results;
}

function historicalPublication(row: Record<string, unknown>, run: ApifyRun): CreatorRecentPublication | null {
  const username = normalizeHandle(typeof row.ownerUsername === "string" ? row.ownerUsername : null);
  if (!username || !run.defaultDatasetId) return null;
  const normalized = normalizeApifyProfileData({
    platformKey: "instagram",
    username,
    profileUrl: `https://www.instagram.com/${username}/`,
    profileRows: [],
    postRows: [row],
    apifyRunId: run.id,
    apifyDatasetId: run.defaultDatasetId,
    fetchedAt: run.finishedAt ?? null,
  });
  return normalized?.recentPublications[0] ?? null;
}

async function main() {
  const apifyToken = process.env.APIFY_TOKEN?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!apifyToken || !supabaseUrl || !serviceKey || !INSTAGRAM_ACTOR_ID) {
    fail("APIFY_TOKEN, APIFY_INSTAGRAM_ACTOR_ID, NEXT_PUBLIC_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  if (ref !== DEVELOPMENT_REF) fail(`Refusing non-Development Supabase target: ${ref}.`);

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const accounts = await loadAllInstagramAccounts(supabase);
  const accountsByHandle = new Map<string, Account[]>();
  for (const account of accounts) {
    for (const handle of [normalizeHandle(account.handle), normalizeHandle(account.username)]) {
      if (!handle) continue;
      const values = accountsByHandle.get(handle) ?? [];
      if (!values.some((value) => value.id === account.id)) values.push(account);
      accountsByHandle.set(handle, values);
    }
  }

  const [allRuns, instagramActorRunIds] = await Promise.all([
    loadRuns(apifyToken),
    resolveInstagramActorRunIds(apifyToken),
  ]);
  const runs = allRuns.filter(
    (run) =>
      run.status === "SUCCEEDED" &&
      (instagramActorRunIds.has(run.actId ?? "") || instagramActorRunIds.has(run.actorId ?? "")) &&
      Boolean(run.defaultDatasetId) &&
      (!snapshotBefore || (run.finishedAt != null && run.finishedAt <= snapshotBefore))
  );
  console.log(
    `[apify-rich-publication-backfill] target=${ref} mode=${apply ? "apply" : "dry-run"} instagramRuns=${runs.length}` +
      (snapshotBefore ? ` snapshotBefore=${snapshotBefore}` : "")
  );

  let invalidRows = 0;
  let unmatchedRows = 0;
  let ambiguousRows = 0;
  let datasetFailures = 0;
  const incomingByAccount = new Map<string, { account: Account; publications: CreatorRecentPublication[]; freshestAt: string }>();

  await mapWithConcurrency(runs, 2, async (run, index) => {
    try {
      const rows = await fetchApify<unknown[]>(
        apifyToken,
        `datasets/${encodeURIComponent(run.defaultDatasetId!)}/items?format=json&limit=1000`
      );
      for (const raw of rows) {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
          invalidRows += 1;
          continue;
        }
        const row = raw as Record<string, unknown>;
        const handle = normalizeHandle(typeof row.ownerUsername === "string" ? row.ownerUsername : null);
        const publication = historicalPublication(row, run);
        if (!handle || !publication) {
          invalidRows += 1;
          continue;
        }
        const matches = accountsByHandle.get(handle) ?? [];
        if (matches.length === 0) {
          unmatchedRows += 1;
          continue;
        }
        if (matches.length !== 1) {
          ambiguousRows += 1;
          continue;
        }
        const account = matches[0]!;
        const current = incomingByAccount.get(account.id) ?? {
          account,
          publications: [],
          freshestAt: run.finishedAt ?? new Date(0).toISOString(),
        };
        current.publications = mergeCreatorRecentPublications(current.publications, [publication]);
        if ((run.finishedAt ?? "") > current.freshestAt) current.freshestAt = run.finishedAt!;
        incomingByAccount.set(account.id, current);
      }
    } catch {
      datasetFailures += 1;
    }
    if ((index + 1) % 250 === 0 || index + 1 === runs.length) {
      console.log(`[apify-rich-publication-backfill] scanned=${index + 1}/${runs.length}`);
    }
  });

  const influencerIds = [...new Set([...incomingByAccount.values()].map((entry) => entry.account.influencer_id))];
  const dnaByInfluencer = new Map<string, CreatorDNADocument>();
  for (let from = 0; from < influencerIds.length; from += 500) {
    const { data, error } = await supabase
      .from("creator_dna")
      .select("influencer_id,document")
      .in("influencer_id", influencerIds.slice(from, from + 500));
    if (error) throw new Error(error.message);
    for (const row of data ?? []) dnaByInfluencer.set(row.influencer_id as string, row.document as CreatorDNADocument);
  }

  const plans: Plan[] = [...incomingByAccount.values()].map(({ account, publications, freshestAt }) => {
    const accountPublications = mergeCreatorRecentPublications(account.recent_publications, publications);
    const document = dnaByInfluencer.get(account.influencer_id);
    const dnaExisting = document?.content.recentPublications.value ?? [];
    const dnaCandidate = mergeCreatorRecentPublications(dnaExisting, publications);
    const resolvedDna = resolveDnaPublicationCandidate(document, dnaCandidate, freshestAt);
    return {
      account,
      document,
      publications,
      accountPublications,
      dnaPublications: dnaCandidate,
      accountChanged: !sameJson(account.recent_publications, accountPublications),
      dnaChanged:
        !sameJson(dnaExisting, resolvedDna.value) ||
        document?.content.recentPublications.source !== resolvedDna.source,
      dnaWillCreate: !document,
      freshestAt,
    };
  });

  const fieldCounts: Record<string, number> = {};
  for (const plan of plans) {
    for (const publication of plan.publications) {
      for (const field of ["paidPartnership", "taggedUsers", "coauthorProducers", "locationName", "locationId", "music", "contentType", "productType", "video", "media"] as const) {
        const value = publication[field];
        const present = Array.isArray(value) ? value.length > 0 : value != null;
        if (present) fieldCounts[field] = (fieldCounts[field] ?? 0) + 1;
      }
    }
  }
  const accountWrites = plans.filter((plan) => plan.accountChanged);
  const dnaWrites = plans.filter((plan) => plan.dnaChanged);
  if (process.argv.includes("--explain")) {
    console.log(JSON.stringify({
      accountConvergence: accountWrites.map((plan) => ({
        accountId: plan.account.id,
        influencerId: plan.account.influencer_id,
        handle: plan.account.handle ?? plan.account.username,
        publications: publicationDiff(
          Array.isArray(plan.account.recent_publications)
            ? (plan.account.recent_publications as CreatorRecentPublication[])
            : [],
          plan.accountPublications
        ),
      })),
    }, null, 2));
  }
  console.log(JSON.stringify({
    proposed: {
      matchedCreators: plans.length,
      accountRowsToUpdate: accountWrites.length,
      creatorDnaRowsToUpdateOrCreate: dnaWrites.length,
      creatorDnaRowsToCreate: dnaWrites.filter((plan) => plan.dnaWillCreate).length,
      publicationsEnriched: plans.reduce((sum, plan) => sum + plan.publications.length, 0),
      fieldCoverage: fieldCounts,
    },
    skipped: { unmatchedRows, ambiguousRows, invalidRows, datasetFailures },
  }, null, 2));

  if (!apply) return;

  const dnaService = new CreatorDNAService(supabase);
  let accountUpdated = 0;
  let dnaUpdated = 0;
  let skippedCurrentChanged = 0;
  const errors: string[] = [];
  for (const plan of plans) {
    try {
      if (plan.accountChanged) {
        const { data: currentAccount, error: currentAccountError } = await supabase
          .from("influencer_platform_accounts")
          .select("id,influencer_id,platform,handle,username,recent_publications,field_sources")
          .eq("id", plan.account.id)
          .maybeSingle();
        if (currentAccountError) throw new Error(currentAccountError.message);
        if (
          !currentAccount ||
          !sameJson(currentAccount.influencer_id, plan.account.influencer_id) ||
          !sameJson(currentAccount.platform, plan.account.platform) ||
          !sameJson(currentAccount.handle, plan.account.handle) ||
          !sameJson(currentAccount.username, plan.account.username) ||
          !sameJson(currentAccount.recent_publications, plan.account.recent_publications) ||
          !sameJson(currentAccount.field_sources, plan.account.field_sources)
        ) {
          skippedCurrentChanged += 1;
          continue;
        }
        const fieldSources = { ...(plan.account.field_sources ?? {}) };
        if (fieldSources.recent_publications == null) fieldSources.recent_publications = "apify";
        const { error } = await supabase
          .from("influencer_platform_accounts")
          .update({
            recent_publications: plan.accountPublications,
            field_sources: fieldSources,
            updated_at: new Date().toISOString(),
          })
          .eq("id", plan.account.id);
        if (error) throw new Error(error.message);
        accountUpdated += 1;
      }
      if (plan.dnaChanged) {
        const { data: currentDna, error: currentDnaError } = await supabase
          .from("creator_dna")
          .select("document")
          .eq("influencer_id", plan.account.influencer_id)
          .maybeSingle();
        if (currentDnaError) throw new Error(currentDnaError.message);
        if (!sameJson(currentDna?.document, plan.document)) {
          skippedCurrentChanged += 1;
          continue;
        }
        const result = await dnaService.mergeEvidence(plan.account.influencer_id, {
          snapshotId: null,
          fields: [{
            path: "content.recentPublications",
            value: plan.dnaPublications,
            confidence: 0.7,
            source: "ipl",
            sourceVersion: "apify-historical-publication-evidence-v1",
            updatedAt: plan.freshestAt,
          }],
          intelligenceSource: "apify_enrichment",
          lifecycleContext: { hasEnrichmentSnapshot: true },
          ensureRow: true,
        });
        if (!result.ok) throw new Error(result.message);
        dnaUpdated += 1;
      }
    } catch (error) {
      errors.push(`${plan.account.id}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }
  console.log(
    JSON.stringify(
      { applied: { accountUpdated, dnaUpdated, skippedCurrentChanged, errors: errors.length }, errors },
      null,
      2
    )
  );
  if (errors.length > 0) process.exitCode = 1;
}

main().catch((error) => fail(error instanceof Error ? error.message : "unexpected failure"));
