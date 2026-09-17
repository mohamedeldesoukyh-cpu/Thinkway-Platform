import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyCreatorDNADocument } from "@/features/creator-dna/services/document-factory";
import { accountTransaction, createTransactionalProductionIO, dnaTransaction } from "./controlled-publication-backfill-io";
import { applyManifest, assertPublicationOnlyDnaChange, BACKFILL_BOUNDARY, BACKFILL_COMMIT,
  EXCLUDED_DATASETS, EXCLUDED_DNA, manifestBody, PRODUCTION_REF, sealManifest, validateManifest,
  type ExecutionManifest, type ManifestBody } from "./controlled-publication-backfill";

function fixture(): ExecutionManifest {
  const creators = Array.from({length:38},(_,i) => `00000000-0000-4000-8000-${String(i+1).padStart(12,"0")}`);
  const accountWrites: ManifestBody["accountWrites"] = [];
  const dnaWrites: ManifestBody["dnaWrites"] = [];
  const publications: ManifestBody["publications"] = [];
  creators.forEach((influencerId,i) => {
    const posts = Array.from({length:i<3?2:1},(_,j) => ({ platformPostId:`post-${i}-${j}`,
      url:`https://www.instagram.com/p/${i}-${j}/`, thumbnail:null,likes:null,comments:null,views:null,
      caption:"quote ' عربي",posted_at:null }));
    accountWrites.push({ id:`10000000-0000-4000-8000-${String(i+1).padStart(12,"0")}`, influencerId,
      before:{id:`10000000-0000-4000-8000-${String(i+1).padStart(12,"0")}`,influencer_id:influencerId,recent_publications:[],profile_data_version:2}, after:posts });
    const old = createEmptyCreatorDNADocument();
    const next = structuredClone(old);
    next.content.recentPublications.value = posts;
    dnaWrites.push({influencerId,before:{influencer_id:influencerId,document:old,version:4},after:next});
    posts.forEach(post => publications.push({influencerId,platformPostId:post.platformPostId,url:post.url,
      sources:[{runId:`run-${i}-${post.platformPostId}`,datasetId:`complete-${i}`,capturedAt:"2026-09-15T00:00:00.000Z"}]}));
  });
  const verifiedRuns=Array.from({length:7076},(_,i)=>({runId:`run-${i}`,datasetId:`complete-${i}`,
    finishedAt:"2026-09-15T00:00:00.000Z",status:"SUCCEEDED" as const,actorId:"test-actor"}));
  verifiedRuns.push(...EXCLUDED_DATASETS.map((datasetId,i)=>({runId:`excluded-${i}`,datasetId,
    finishedAt:"2026-09-15T00:00:00.000Z",status:"SUCCEEDED" as const,actorId:"test-actor"})));
  for(const publication of publications){publication.sources[0]!.runId=`run-${creators.indexOf(publication.influencerId)}`}
  return sealManifest({version:2,target:PRODUCTION_REF,boundary:BACKFILL_BOUNDARY,sourceCommit:BACKFILL_COMMIT,
    excludedDatasets:[...EXCLUDED_DATASETS],excludedDnaInfluencerIds:[EXCLUDED_DNA],historicalRuns:7421,
    verifiedDatasets:7079,unresolvedDatasets:342,completeDatasets:7076,actorId:"test-actor",verifiedRuns,
    unresolvedDatasetIds:Array.from({length:342},(_,i)=>`unresolved-${i}`),
    planning:{unmatchedCreators:0,unmatchedProposals:0,ambiguous:0,conflicts:0,duplicateProposals:0},
    creators,publications,accountWrites,dnaWrites,expectedWrites:76});
}

test("freshly sealed manifest validates; body hashes independently", () => {
  const m=fixture(); assert.doesNotThrow(()=>validateManifest(m));
  assert.equal(sealManifest(manifestBody(m)).digest,m.digest);
});

test("post-seal edits to totals, creators, publications, source and dataset invalidate digest", () => {
  const edits: ((m:ExecutionManifest)=>void)[] = [
    m=>{m.expectedWrites=75}, m=>{m.creators[0]="other"},
    m=>{m.publications[0]!.url="https://instagram.com/p/other/"},
    m=>{m.publications[0]!.sources[0]!.runId="other"},
    m=>{m.publications[0]!.sources[0]!.datasetId="other"},
    m=>{m.digest="0".repeat(64)},
  ];
  for(const edit of edits){const m=fixture();edit(m);assert.throws(()=>validateManifest(m),/digest/i)}
});

test("freshly sealed excluded dataset and malformed DNA are rejected by business validation", () => {
  const m=manifestBody(fixture());m.publications[0]!.sources[0]!.datasetId=EXCLUDED_DATASETS[0];
  assert.throws(()=>sealManifest(m),/excluded/i);
  const n=manifestBody(fixture());n.dnaWrites[0]!.influencerId=EXCLUDED_DNA;
  assert.throws(()=>sealManifest(n),/excluded/i);
});

test("DNA proposal may change only publication envelope and documentVersion", () => {
  const good=fixture().dnaWrites[0]!;assert.doesNotThrow(()=>assertPublicationOnlyDnaChange(good));
  const changed=structuredClone(good);(changed.after as {meta:{provider?:string}}).meta.provider="other";
  assert.throws(()=>assertPublicationOnlyDnaChange(changed),/unrelated/i);
  const missing=structuredClone(good);delete (missing.after as {meta?:unknown}).meta;
  assert.throws(()=>assertPublicationOnlyDnaChange(missing),/envelope/i);
});

test("apply requires explicit flag, Production ref, exact digest before IO", async () => {
  const m=fixture();const io={executeAccount:async()=>{throw new Error("IO reached")},executeDna:async()=>{throw new Error("IO reached")}};
  for(const auth of [{apply:false,target:PRODUCTION_REF,digest:m.digest},{apply:true,target:"development",digest:m.digest},
    {apply:true,target:PRODUCTION_REF,digest:"0".repeat(64)}])
    await assert.rejects(applyManifest(m,auth,io),/explicit production apply/i);
  assert.throws(()=>createTransactionalProductionIO("development",m.digest),/production/i);
});

test("second pass reports already-applied with zero target and audit writes", async () => {
  const m=fixture();let first=true;const visited:string[]=[];
  const io={executeAccount:async(w:{id:string})=>{visited.push(w.id);return first?"written" as const:"already-applied" as const},
    executeDna:async(w:{influencerId:string})=>{visited.push(w.influencerId);return first?"written" as const:"already-applied" as const}};
  const auth={apply:true,target:PRODUCTION_REF,digest:m.digest};
  const one=await applyManifest(m,auth,io);assert.equal(one.actualTargetWrites,76);
  assert.equal(one.versionInserts,38);assert.equal(one.lineageInserts,38);
  first=false;const two=await applyManifest(m,auth,io);
  assert.equal(two.actualTargetWrites,0);assert.equal(two.versionInserts,0);assert.equal(two.lineageInserts,0);
  assert.equal(two.skipped.length,76);assert.equal(visited.length,152);
});

test("concurrent account change suppresses its DNA operation without touching other creators", async () => {
  const m=fixture();const blocked=m.creators[0];const dnaVisited:string[]=[];
  const io={executeAccount:async(w:{influencerId:string})=>w.influencerId===blocked?"concurrent-change" as const:"written" as const,
    executeDna:async(w:{influencerId:string})=>{dnaVisited.push(w.influencerId);return "written" as const}};
  const result=await applyManifest(m,{apply:true,target:PRODUCTION_REF,digest:m.digest},io);
  assert.equal(result.accountWrites,37);assert.equal(result.dnaWrites,37);
  assert.equal(result.versionInserts,37);assert.equal(result.lineageInserts,37);
  assert.ok(!dnaVisited.includes(blocked));assert.equal(dnaVisited.length,37);
});

test("generated SQL locks and compares exact row, commits only exact audit counts", () => {
  const m=fixture();const account=accountTransaction(m.accountWrites[0]!);
  const dna=dnaTransaction(m.dnaWrites[0]!,m.digest);
  assert.match(account,/FOR UPDATE/);assert.match(account,/to_jsonb\(l\)=/);
  assert.match(account,/profile_data_version=COALESCE\(a.profile_data_version,0\)\+1/);
  assert.match(account,/counts.updated=1 AS written/);
  assert.match(dna,/counts.updated=1 AND counts.versions=1 AND counts.events=1 AS written/);
  assert.match(dna,/creator_dna_versions/);assert.match(dna,/creator_dna_lineage_events/);
  assert.match(dna,/documentVersion/);assert.match(dna,/jsonb_typeof/);
  assert.match(dna,/\\bind/);assert.match(dna,/ROLLBACK;/);
});
