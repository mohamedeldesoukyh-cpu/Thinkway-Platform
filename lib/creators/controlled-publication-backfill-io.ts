import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertPublicationOnlyDnaChange, PRODUCTION_REF, type AccountWrite, type BackfillIO, type DnaWrite } from "./controlled-publication-backfill";

export type Outcome = "written" | "already-applied" | "concurrent-change";
const encoded = (value: unknown) => `'${Buffer.from(JSON.stringify(value), "utf8").toString("base64")}'`;
const decoded = (n: number) => `convert_from(decode($${n}::text,'base64'),'UTF8')::jsonb`;
const uuid = (n: number) => `(${decoded(n)}#>>'{}')::uuid`;
const finish = (query: string, values: unknown[]) => `BEGIN;\n${query}\n\\bind ${values.map(encoded).join(" ")}\n\\gset\n\\if :written\nCOMMIT;\n\\else\nROLLBACK;\n\\endif\n\\echo __BACKFILL_STATUS__ :result\n`;

export function accountTransaction(write: AccountWrite): string {
  return finish(`WITH locked AS MATERIALIZED (
  SELECT a.* FROM public.influencer_platform_accounts a WHERE a.id=${uuid(1)} FOR UPDATE
), changed AS (
  UPDATE public.influencer_platform_accounts a
  SET recent_publications=${decoded(3)}, profile_data_version=COALESCE(a.profile_data_version,0)+1
  FROM locked l WHERE a.id=l.id AND to_jsonb(l)=${decoded(2)}
  RETURNING a.id
), counts AS (SELECT (SELECT count(*) FROM changed) AS updated)
SELECT CASE WHEN counts.updated=1 THEN 'written'
  WHEN counts.updated=0 AND EXISTS(SELECT 1 FROM locked l WHERE l.recent_publications IS NOT DISTINCT FROM ${decoded(3)}) THEN 'already-applied'
  ELSE 'concurrent-change' END AS result,
  counts.updated=1 AS written FROM counts`, [write.id, write.before, write.after]);
}

export function dnaTransaction(write: DnaWrite, digest: string): string {
  assertPublicationOnlyDnaChange(write);
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error("Invalid manifest digest");
  return finish(`WITH locked AS MATERIALIZED (
  SELECT d.* FROM public.creator_dna d WHERE d.influencer_id=${uuid(1)} FOR UPDATE
), proposed AS (
  SELECT l.influencer_id,l.version+1 AS next_version,
    jsonb_set(${decoded(3)},'{meta,documentVersion}',to_jsonb(l.version+1),true) AS next_document
  FROM locked l WHERE to_jsonb(l)=${decoded(2)}
    AND jsonb_typeof(l.document->'meta')='object'
    AND jsonb_typeof(${decoded(3)}->'meta')='object'
), changed AS (
  UPDATE public.creator_dna d SET document=p.next_document,version=p.next_version
  FROM proposed p WHERE d.influencer_id=p.influencer_id
  RETURNING d.influencer_id,d.document,d.version
), history AS (
  INSERT INTO public.creator_dna_versions
    (influencer_id,version,document,change_reason,changed_fields,snapshot_id)
  SELECT c.influencer_id,c.version,c.document,
    'controlled_production_publication_backfill',ARRAY['content.recentPublications']::text[],NULL
  FROM changed c RETURNING id
), lineage AS (
  INSERT INTO public.creator_dna_lineage_events
    (influencer_id,event_type,field_paths,metadata)
  SELECT c.influencer_id,'controlled_publication_backfill',
    ARRAY['content.recentPublications']::text[],
    jsonb_build_object('version',c.version,
      'intelligenceSource','historical_publication_backfill',
      'source','apify-historical-publication-evidence-v1',
      'reason','controlled_production_publication_backfill',
      'manifestDigest',${decoded(4)}#>>'{}',
      'lifecycle',c.document->'meta'->>'lifecycle',
      'sources',c.document->'meta'->'sources')
  FROM changed c RETURNING id
), counts AS (
  SELECT (SELECT count(*) FROM changed) AS updated,
    (SELECT count(*) FROM history) AS versions,
    (SELECT count(*) FROM lineage) AS events
)
SELECT CASE WHEN counts.updated=1 AND counts.versions=1 AND counts.events=1 THEN 'written'
  WHEN counts.updated=0 AND EXISTS(SELECT 1 FROM locked l
    WHERE l.version=((${decoded(2)})->>'version')::int+1
      AND l.document=jsonb_set(${decoded(3)},'{meta,documentVersion}',to_jsonb(l.version),true)) THEN 'already-applied'
  ELSE 'concurrent-change' END AS result,
  counts.updated=1 AND counts.versions=1 AND counts.events=1 AS written FROM counts`,
    [write.influencerId, write.before, write.after, digest]);
}

export function createTransactionalProductionIO(target: string, digest: string,
  runSql: (script: string) => Outcome = productionPsql): BackfillIO {
  if (target !== PRODUCTION_REF || !/^[a-f0-9]{64}$/.test(digest)) throw new Error("Explicit Production target and digest required");
  return {
    executeAccount: async write => runSql(accountTransaction(write)),
    executeDna: async write => runSql(dnaTransaction(write,digest)),
  };
}

/** One psql connection per row; any SQL error closes the connection and rolls back. */
export function productionPsql(script: string): Outcome {
  const config = readFileSync(resolve("scripts/.env.migration"), "utf8");
  const urls = config.split(/postgresql:\/\//i).filter(Boolean).map(part => `postgresql://${part.trim().split(/\s+/)[0]}`);
  const raw = urls.find(url => url.includes(PRODUCTION_REF));
  const match = raw?.match(/^postgresql:\/\/([^:]+):(.+)@(aws-[^/\s]+)\/([^\s]+)$/);
  if (!match) throw new Error("Explicit Production database connection unavailable");
  const [, user, password, hostPort, database] = match;
  if (!user!.includes(PRODUCTION_REF) || !hostPort!.startsWith("aws-") ||
      ["hsxrewjcbvmbkqdlzjhs", "pkozxsvdyswgmcqzohqd", "dmcpbsripfjrzqznwtss"].some(ref => raw!.includes(ref)))
    throw new Error("Production database target mismatch");
  const [host, port = "5432"] = hostPort!.split(":");
  const psql = process.env.PSQL_PATH || "C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe";
  const result = spawnSync(psql, ["-X","-q","-A","-t","-h",host!,"-p",port,"-U",user!,"-d",database!.split("?")[0]!,"-v","ON_ERROR_STOP=1","-f","-"], {
    input: script, encoding: "utf8", maxBuffer: 1024 * 1024,
    env: { ...process.env, PGPASSWORD: password! }, windowsHide: true,
  });
  if (result.status !== 0) throw new Error("Controlled PostgreSQL transaction failed and was rolled back");
  const statuses = [...result.stdout.matchAll(/^__BACKFILL_STATUS__ (written|already-applied|concurrent-change)\r?$/gm)];
  if (statuses.length !== 1) throw new Error("Unverifiable PostgreSQL transaction outcome");
  return statuses[0]![1] as Outcome;
}
