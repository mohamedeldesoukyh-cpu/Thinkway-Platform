import { createHash } from "node:crypto";
import { canonicalPublicationUrl, mergeCreatorRecentPublications } from "./publication-evidence";
import { matchAccount, planPublicationBackfill, semanticJson, TARGETS, type Account, type DnaRow, type Evidence } from "./apify-publication-preflight";
import type { CreatorRecentPublication } from "./types";

export const BACKFILL_BOUNDARY = "2026-09-16T00:00:00.000Z";
export const BACKFILL_COMMIT = "9fcf2b831fbe52f118834e5b86302488e9564090";
export const EXCLUDED_DATASETS = ["2Rv8XvdShVHnCq7G3", "qmh9fnCYBP2gr2eeJ", "SicIxoHu6GfV8Itfv"] as const;
export const EXCLUDED_DNA = "bbbbbbbb-00c1-4000-8000-000000000001";
export const PRODUCTION_REF = TARGETS.production;

export type Source = { runId: string; datasetId: string; capturedAt: string };
export type VerifiedRun = { runId: string; datasetId: string; finishedAt: string; status: "SUCCEEDED"; actorId: string };
export type PublicationSource = { influencerId: string; platformPostId: string | null; url: string | null; sources: Source[] };
export type AccountWrite = { id: string; influencerId: string; before: Record<string, unknown>; after: CreatorRecentPublication[] };
export type DnaWrite = { influencerId: string; before: Record<string, unknown>; after: unknown };
export type ManifestBody = {
  version: 2; target: typeof PRODUCTION_REF; boundary: typeof BACKFILL_BOUNDARY; sourceCommit: typeof BACKFILL_COMMIT;
  excludedDatasets: string[]; excludedDnaInfluencerIds: string[];
  historicalRuns: number; verifiedDatasets: number; unresolvedDatasets: number; completeDatasets: number;
  actorId: string; verifiedRuns: VerifiedRun[]; unresolvedDatasetIds: string[];
  planning: { unmatchedCreators: number; unmatchedProposals: number; ambiguous: number; conflicts: number; duplicateProposals: number };
  creators: string[]; publications: PublicationSource[];
  accountWrites: AccountWrite[]; dnaWrites: DnaWrite[]; expectedWrites: number;
};
export type ExecutionManifest = ManifestBody & { digest: string };
const sha = (value: unknown) => createHash("sha256").update(semanticJson(value)).digest("hex");
const unique = <T>(values: T[]) => new Set(values).size === values.length;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

/** Only the publication envelope and required document version may differ. */
export function assertPublicationOnlyDnaChange(write: DnaWrite): void {
  const before = write.before.document;
  const after = write.after;
  if (!object(before) || !object(after) || !object(before.meta) || !object(after.meta) ||
      !object(before.content) || !object(after.content) || !object(before.content.recentPublications) ||
      !object(after.content.recentPublications) || !Number.isSafeInteger(write.before.version))
    throw new Error("DNA document envelope is not safe for controlled backfill");
  const clean = (document: Record<string, unknown>) => {
    const copy = structuredClone(document);
    const meta = copy.meta as Record<string, unknown>;
    const content = copy.content as Record<string, unknown>;
    delete meta.documentVersion;
    delete content.recentPublications;
    return copy;
  };
  if (semanticJson(clean(before)) !== semanticJson(clean(after)) ||
      semanticJson(before.content.recentPublications) === semanticJson(after.content.recentPublications))
    throw new Error("DNA proposal changes unrelated fields or no publications");
}

function samePublication(a: CreatorRecentPublication, b: CreatorRecentPublication) {
  return Boolean(a.platformPostId && b.platformPostId && a.platformPostId === b.platformPostId) ||
    Boolean(canonicalPublicationUrl(a.url) && canonicalPublicationUrl(a.url) === canonicalPublicationUrl(b.url));
}

/** Builds only the attributable subset; no database or Apify access here. */
export function buildSafeSubsetManifest(input: {
  accounts: Account[]; accountBefore: Record<string, unknown>[]; dna: DnaRow[];
  evidence: Evidence[]; verifiedRuns: VerifiedRun[]; unresolvedDatasetIds: string[]; actorId: string;
  completeDatasets: number;
}): ExecutionManifest {
  const excluded = new Set<string>([...EXCLUDED_DATASETS,...input.unresolvedDatasetIds]);
  const verified = new Map(input.verifiedRuns.map(run => [run.datasetId,run]));
  const evidence = input.evidence.filter(e => {
    const source = e.publication.source;
    return source?.provider === "apify" && !!source.apifyDatasetId && !excluded.has(source.apifyDatasetId) &&
      !!source.apifyRunId && !!source.capturedAt && new Date(source.capturedAt).toISOString() <= BACKFILL_BOUNDARY &&
      verified.get(source.apifyDatasetId)?.runId === source.apifyRunId &&
      verified.get(source.apifyDatasetId)?.finishedAt === e.capturedAt;
  });
  if (evidence.length !== input.evidence.length) throw new Error("Excluded or unprovenanced evidence supplied to manifest builder");
  const plan = planPublicationBackfill(input.accounts, input.dna, evidence, new Set([EXCLUDED_DNA]));
  if (plan.summary.ambiguous || plan.summary.conflicts ||
      plan.summary.skippedPublicationProposals || plan.dnaPlans.some(p => p.creates))
    throw new Error("Verified subset contains unresolved identity or duplicate proposals");
  const beforeAccounts = new Map(input.accountBefore.map(row => [row.id, row]));
  const beforeDna = new Map(input.dna.map(row => [row.influencer_id, row]));
  const accountWrites: AccountWrite[] = plan.accountPlans.filter(p => p.changed).map(p => {
    const before = beforeAccounts.get(p.id);
    if (!before || before.influencer_id !== p.influencerId) throw new Error("Missing account before-state");
    return { id: p.id, influencerId: p.influencerId, before, after: p.publications };
  });
  const dnaWrites: DnaWrite[] = plan.dnaPlans.filter(p => p.changed).map(p => {
    const before = beforeDna.get(p.influencerId);
    if (!before) throw new Error("Missing DNA before-state");
    return { influencerId: p.influencerId, before, after: p.document };
  });
  const changed = new Map<string,{influencerId:string;post:CreatorRecentPublication}>();
  const collect = (influencerId:string,before:CreatorRecentPublication[],after:CreatorRecentPublication[]) => {
    for(const post of after){
      const old=before.find(p=>samePublication(p,post));
      if(old && semanticJson(old)===semanticJson(post)) continue;
      const key=`${influencerId}:${post.platformPostId ?? canonicalPublicationUrl(post.url)}`;
      changed.set(key,{influencerId,post});
    }
  };
  for(const write of accountWrites) collect(write.influencerId,
    Array.isArray(write.before.recent_publications)?write.before.recent_publications as CreatorRecentPublication[]:[],write.after);
  for(const write of dnaWrites){
    const prior=(write.before.document as DnaRow["document"]).content.recentPublications.value;
    const after=(write.after as DnaRow["document"]).content.recentPublications.value;
    collect(write.influencerId,prior,after);
  }
  const publications: PublicationSource[]=[...changed.values()].map(({influencerId,post})=>{
    const sources=evidence.filter(e=>{
      const match=matchAccount(input.accounts,e.ownerId,e.username);
      return match.kind==="matched" && match.account.influencer_id===influencerId && samePublication(e.publication,post);
    }).map(e=>({runId:e.publication.source!.apifyRunId!,datasetId:e.publication.source!.apifyDatasetId!,capturedAt:e.capturedAt}));
    return {influencerId,platformPostId:post.platformPostId??null,url:post.url,
      sources:[...new Map(sources.map(s=>[`${s.runId}:${s.datasetId}`,s])).values()]};
  });
  if(publications.length!==plan.summary.publicationsEnriched) throw new Error("Publication count diverges from safe plan");
  const unmatched = plan.skipped.filter(row => row.reason === "unmatched");
  const unmatchedCreators = new Set(unmatched.map(row => row.ownerId ?? row.username ?? "unknown")).size;
  return sealManifest({ version: 2, target: PRODUCTION_REF, boundary: BACKFILL_BOUNDARY, sourceCommit: BACKFILL_COMMIT,
    excludedDatasets: [...EXCLUDED_DATASETS], excludedDnaInfluencerIds: [EXCLUDED_DNA],
    historicalRuns: 7421, verifiedDatasets: input.verifiedRuns.length,
    unresolvedDatasets: input.unresolvedDatasetIds.length, completeDatasets: input.completeDatasets,
    actorId: input.actorId, verifiedRuns: input.verifiedRuns, unresolvedDatasetIds: [...input.unresolvedDatasetIds].sort(),
    planning: { unmatchedCreators, unmatchedProposals: unmatched.length,
      ambiguous: plan.summary.ambiguous, conflicts: plan.summary.conflicts, duplicateProposals: plan.summary.skippedPublicationProposals },
    creators: [...new Set([...accountWrites.map(w => w.influencerId),...dnaWrites.map(w => w.influencerId)])].sort(), publications,
    accountWrites, dnaWrites, expectedWrites: accountWrites.length+dnaWrites.length });
}

export function manifestBody(manifest: ExecutionManifest): ManifestBody {
  const { digest: _digest, ...body } = manifest;
  void _digest;
  return body;
}

export function sealManifest(body: ManifestBody): ExecutionManifest {
  const manifest = { ...body, digest: sha(body) };
  validateManifest(manifest);
  return manifest;
}

export function validateManifest(m: ExecutionManifest): void {
  if (m.digest !== sha(manifestBody(m))) throw new Error("Manifest digest mismatch");
  if (m.version !== 2 || m.target !== PRODUCTION_REF || m.boundary !== BACKFILL_BOUNDARY || m.sourceCommit !== BACKFILL_COMMIT ||
      semanticJson([...m.excludedDatasets].sort()) !== semanticJson([...EXCLUDED_DATASETS].sort()) ||
      semanticJson(m.excludedDnaInfluencerIds) !== semanticJson([EXCLUDED_DNA]) ||
      m.historicalRuns !== 7421 || m.verifiedDatasets !== 7079 || m.unresolvedDatasets !== 342 ||
      m.completeDatasets !== 7076 || m.verifiedRuns.length !== m.verifiedDatasets ||
      m.unresolvedDatasetIds.length !== m.unresolvedDatasets || !unique(m.creators) ||
      !unique(m.unresolvedDatasetIds) || !unique(m.verifiedRuns.map(run => run.runId)) ||
      !unique(m.verifiedRuns.map(run => run.datasetId)) ||
      m.expectedWrites !== m.accountWrites.length+m.dnaWrites.length ||
      m.creators.some(id=>!m.accountWrites.some(w=>w.influencerId===id)&&!m.dnaWrites.some(w=>w.influencerId===id)) ||
      m.planning.ambiguous !== 0 || m.planning.conflicts !== 0 || m.planning.duplicateProposals !== 0)
    throw new Error("Manifest does not match verified safe-subset scope");
  const creators = new Set(m.creators);
  const excluded = new Set<string>([...m.excludedDatasets,...m.unresolvedDatasetIds]);
  const verified = new Map(m.verifiedRuns.map(run => [run.datasetId,run]));
  if (!m.actorId || m.verifiedRuns.some(run => run.status !== "SUCCEEDED" || run.actorId !== m.actorId ||
      !Number.isFinite(Date.parse(run.finishedAt)) || new Date(run.finishedAt).toISOString() > BACKFILL_BOUNDARY ||
      excluded.has(run.datasetId) && !m.excludedDatasets.includes(run.datasetId)) ||
      m.unresolvedDatasetIds.some(id => verified.has(id)) ||
      !m.excludedDatasets.every(id => verified.has(id)))
    throw new Error("Manifest run provenance is not independently verified");
  if (creators.has(EXCLUDED_DNA) || !unique(m.accountWrites.map(w => w.id)) || !unique(m.dnaWrites.map(w => w.influencerId)) ||
      !unique(m.publications.map(p => `${p.influencerId}:${p.platformPostId || p.url}`)) ||
      m.accountWrites.some(w => !creators.has(w.influencerId) || w.before.id !== w.id || w.before.influencer_id !== w.influencerId) ||
      m.dnaWrites.some(w => !creators.has(w.influencerId) || w.influencerId === EXCLUDED_DNA ||
        w.before.influencer_id !== w.influencerId || !w.before.document) ||
      m.publications.some(p => !creators.has(p.influencerId) || !p.sources.length ||
        p.sources.some(s => excluded.has(s.datasetId) || !s.runId || !Number.isFinite(Date.parse(s.capturedAt)) ||
          new Date(s.capturedAt).toISOString() > BACKFILL_BOUNDARY ||
          verified.get(s.datasetId)?.runId !== s.runId || verified.get(s.datasetId)?.finishedAt !== s.capturedAt)))
    throw new Error("Manifest contains excluded, duplicate, or unverifiable evidence");
  for (const write of m.accountWrites) {
    const prior = Array.isArray(write.before.recent_publications) ? write.before.recent_publications as CreatorRecentPublication[] : [];
    if (semanticJson(mergeCreatorRecentPublications(prior,write.after)) !== semanticJson(write.after))
      throw new Error("Account proposal drops or weakens existing publications");
  }
  for (const publication of m.publications) {
    const matching=(post:CreatorRecentPublication)=>(publication.platformPostId && post.platformPostId === publication.platformPostId) ||
      (canonicalPublicationUrl(publication.url) && canonicalPublicationUrl(publication.url) === canonicalPublicationUrl(post.url));
    if (!m.accountWrites.some(write => write.influencerId === publication.influencerId && write.after.some(matching)) &&
        !m.dnaWrites.some(write=>write.influencerId===publication.influencerId &&
          ((write.after as DnaRow["document"]).content.recentPublications.value as CreatorRecentPublication[]).some(matching)))
      throw new Error("Publication provenance has no proposed account publication");
  }
  for (const write of m.dnaWrites) assertPublicationOnlyDnaChange(write);
}

export interface BackfillIO {
  executeAccount(write: AccountWrite): Promise<"written" | "already-applied" | "concurrent-change">;
  executeDna(write: DnaWrite): Promise<"written" | "already-applied" | "concurrent-change">;
}

/** The adapter must lock, re-read, compare and update inside one transaction per operation. */
export async function applyManifest(m: ExecutionManifest, authorization: { apply: boolean; target: string; digest: string }, io: BackfillIO) {
  validateManifest(m);
  if (!authorization.apply || authorization.target !== PRODUCTION_REF || authorization.digest !== m.digest)
    throw new Error("Explicit Production apply and exact manifest digest required");
  const skipped: { kind: "account" | "dna"; id: string; reason: "already-applied" | "concurrent-change" }[] = [];
  let accountWrites = 0, dnaWrites = 0;
  const accounts = new Map(m.accountWrites.map(w => [w.influencerId, w]));
  const dna = new Map(m.dnaWrites.map(w => [w.influencerId, w]));
  for (const influencerId of m.creators) {
    const account = accounts.get(influencerId);
    const document = dna.get(influencerId);
    if (!account && !document) throw new Error("Creator has no proposed write");
    const accountResult = account ? await io.executeAccount(account) : null;
    if (accountResult === "written") accountWrites++;
    else if (accountResult) skipped.push({ kind: "account", id: account!.id, reason: accountResult });
    if (accountResult === "concurrent-change") {
      if (document) skipped.push({ kind: "dna", id: document.influencerId, reason: "concurrent-change" });
      continue;
    }
    if (document) {
      const dnaResult = await io.executeDna(document);
      if (dnaResult === "written") dnaWrites++;
      else skipped.push({ kind: "dna", id: document.influencerId, reason: dnaResult });
    }
  }
  return { accountWrites, dnaWrites, versionInserts: dnaWrites, lineageInserts: dnaWrites,
    skipped, actualTargetWrites: accountWrites + dnaWrites };
}
