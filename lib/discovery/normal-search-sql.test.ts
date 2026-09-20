/** Isolated loopback PostgreSQL fixture. Never loads .env or connects to Supabase. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runNormalSearchTransport } from "./normal-search-transport";
import { cloneCreatorSearchFilters, type CreatorSearchFilters } from "@/features/discovery/components/creator-search/creator-search-types";
import type { SupabaseClient } from "@supabase/supabase-js";
const bin = "C:/Program Files/PostgreSQL/17/bin";
const root = path.resolve(".tmp/discovery-phase1-pg");
const port = "55446";
const uuid = (n:number) => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
function command(name:string,args:string[],input?:string) {
  const result=spawnSync(path.join(bin,`${name}.exe`),args,{input,encoding:"utf8",windowsHide:true,maxBuffer:16*1024*1024, ...(name === "pg_ctl" ? {stdio: "ignore" as const} : {}),timeout:30000});
  assert.equal(result.status,0,result.stderr || result.error?.message);
  return result.stdout?.trim() ?? "";
}
function sql(text:string) { return command("psql",["-X","-q","-A","-t","-h","127.0.0.1","-p",port,"-U","discovery_fixture","-d","postgres","-v","ON_ERROR_STOP=1","-f","-"],text); }

test("real PostgreSQL: existing lexical functions + compact RPC, read-only transaction and permission gate",{skip:!existsSync(path.join(bin,"initdb.exe"))},async()=>{
  mkdirSync(root,{recursive:true});
  const data=path.join(root,"db");
  if(!existsSync(path.join(data,"PG_VERSION"))) command("initdb",["-D",data,"-U","discovery_fixture","-A","trust","--encoding=UTF8","--locale=C"]);
  command("pg_ctl",["-D",data,"-l",path.join(root,"server.log"),"-o",`-h 127.0.0.1 -p ${port}`,"-w","start"]);
  try {
    sql(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;
      DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      GRANT USAGE ON SCHEMA public TO authenticated,anon;
      CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
      CREATE SCHEMA IF NOT EXISTS extensions; CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
      CREATE FUNCTION has_permission(text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT coalesce(current_setting('fixture.allowed',true),'yes')='yes' $$;
      CREATE TYPE public.discovery_platform AS ENUM ('instagram','tiktok','youtube','twitter');
      CREATE TABLE influencers(id uuid PRIMARY KEY,document_number text,display_name text,legal_name text,email text,status text DEFAULT 'active',country_code text,country_codes text[],city text,nationality text,languages text[],categories text[],notes text,influencer_url text,metadata jsonb DEFAULT '{}',search_vector tsvector,primary_avatar_url text,default_metrics_platform_account_id uuid,thinkway_score numeric,source_confidence numeric,last_enriched_at timestamptz,updated_at timestamptz DEFAULT now(),demographic_source text,audience_top_countries jsonb,audience_gender_male numeric,audience_gender_female numeric,audience_gender_unknown numeric,audience_age_13_17 numeric,audience_age_18_24 numeric,audience_age_25_34 numeric,audience_age_35_44 numeric,audience_age_45_54 numeric,audience_age_55_plus numeric);
      CREATE TABLE influencer_platform_accounts(id uuid PRIMARY KEY,influencer_id uuid,platform text,handle text,username text,normalized_username text,profile_url text,profile_display_name text,profile_bio text,follower_count numeric,engagement_rate numeric,avg_likes numeric,avg_comments numeric,avg_views numeric,audience_country text,is_verified boolean,is_primary boolean,profile_picture_url text,hashtags text[],mentions text[],interest_categories text[],metrics_source text,sync_status text,metadata jsonb DEFAULT '{}',recent_publications jsonb DEFAULT '[]',contact_email text,contact_links jsonb);
      CREATE TABLE creator_sources(influencer_id uuid);
      CREATE TABLE creator_dna(influencer_id uuid PRIMARY KEY, document jsonb);
      CREATE TABLE discovered_profiles(id uuid PRIMARY KEY,influencer_id uuid,platform public.discovery_platform,username text,profile_url text,display_name text,bio text,profile_image_url text,country_code text,city text,language_codes text[],category_tags text[],stage text,thinkway_score numeric,source_confidence numeric,last_enriched_at timestamptz,updated_at timestamptz,search_vector tsvector,metadata jsonb DEFAULT '{}');
      CREATE TABLE profile_metrics(id uuid,profile_id uuid,followers numeric,engagement_rate numeric,avg_likes numeric,avg_comments numeric,avg_views numeric,captured_at timestamptz);
      CREATE TABLE profile_ai_scores(id uuid,profile_id uuid,niche text,scored_at timestamptz);`);
    for(const file of ["20260630170000_discovery_search_modernization.sql","20260709020000_discovery_search_performance.sql","20260710060000_discovery_search_bio_hashtag.sql","20260718070000_discovery_browse_recency.sql"]) {
      const source=readFileSync(`supabase/migrations/${file}`,"utf8");
      for(const definition of source.match(/CREATE OR REPLACE FUNCTION[\s\S]*?\$\$;/g) ?? []) {
        if (/FUNCTION public.search_creators\(/.test(definition)) sql("DROP FUNCTION IF EXISTS search_creators(text,integer,integer);");
        sql(definition);
      }
    }
    sql("ALTER FUNCTION search_creators(text,integer,integer) RENAME TO search_creators_impl;");
    const retrievalDefinition=sql("SELECT md5(pg_get_functiondef('search_creators_impl(text,integer,integer)'::regprocedure));");
    sql(readFileSync("supabase/migrations/20260920100000_discovery_normal_candidate_window.sql","utf8"));
    sql(`INSERT INTO influencers(id,display_name,country_code,categories,languages,search_vector) VALUES('${uuid(1)}','Amina Beauty','EG',ARRAY['Beauty'],ARRAY['ar'],to_tsvector('simple','Amina Beauty makeup جمال'));
      INSERT INTO influencer_platform_accounts(id,influencer_id,platform,handle,normalized_username,follower_count,engagement_rate,avg_views,profile_bio,recent_publications) VALUES('${uuid(2)}','${uuid(1)}','instagram','amina','amina',600000,5,90000,'Beauty makeup Cairo','[{"caption":"makeup جمال","posted_at":"2026-09-18T00:00:00Z","raw_secret":"not projected"}]');
      INSERT INTO creator_dna VALUES('${uuid(1)}','{"scores":{"aiNiche":{"value":"Beauty tutorials"}},"raw_apify_snapshot":"not projected"}');`);
    for(const q of ["@amina","amin","Amina Beauty","makeup","جمال",""]) {
      const r=JSON.parse(sql(`BEGIN READ ONLY; SELECT discovery_normal_candidate_window('${q}',0,200,true,true); COMMIT;`));
      assert.equal(r.items.length,1,q);assert.equal(r.exhausted,true);assert.equal(r.items[0].ai_niche,"Beauty tutorials");assert.equal(r.items[0].platforms[0].follower_count,600000);assert.ok(!JSON.stringify(r).includes("not projected"));
    }
    // Real multiwindow offsets and canonical identity suppression.
    sql(`INSERT INTO influencers(id,display_name,country_code,categories,languages,search_vector)
      SELECT ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Window '||n,'EG',ARRAY['Beauty'],ARRAY['ar'],to_tsvector('simple','window makeup') FROM generate_series(10,259) n;
      INSERT INTO discovered_profiles(id,platform,username,display_name,search_vector) VALUES('${uuid(500)}','instagram','amina','Amina duplicate',to_tsvector('simple','amina'));
      INSERT INTO creator_sources VALUES('${uuid(1)}');`);
    const first=JSON.parse(sql("SELECT discovery_normal_candidate_window('',0,200,false,false);"));
    const second=JSON.parse(sql("SELECT discovery_normal_candidate_window('',200,200,false,false);"));
    assert.equal(first.exhausted,false); assert.equal(second.exhausted,true);
    assert.equal(first.scannedCount+second.scannedCount,252);
    const all=[...first.items,...second.items]; assert.equal(all.length,251);
    assert.equal(new Set(all.map((r:{unified_id:string})=>r.unified_id)).size,251);
    const kept=all.find((r:{unified_id:string})=>r.unified_id===`inf:${uuid(1)}`);
    assert.equal(kept.source_type,'imported'); assert.equal(kept.platforms[0].recent_publications.length,1);
    sql(`UPDATE influencer_platform_accounts SET handle='___',normalized_username='___' WHERE id='${uuid(2)}';`);
    const fallback=JSON.parse(sql("SELECT discovery_normal_candidate_window('@___',0,200,false,false);"));
    assert.equal(fallback.items[0].unified_id,`inf:${uuid(1)}`);
    // Matches lie beyond both the first 200 rows and the former 10,000 raw-candidate budget.
    sql(`INSERT INTO influencers(id,display_name,country_code,categories,languages,notes)
      SELECT ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Catalog '||n,
      CASE WHEN n>=25000 THEN 'EG' ELSE 'US' END,
      ARRAY[CASE WHEN n>=25000 THEN 'Beauty' ELSE 'Travel' END],ARRAY['en'],'makeup tips'
      FROM generate_series(1000,25249) n;
      INSERT INTO influencer_platform_accounts(id,influencer_id,platform,handle,normalized_username,follower_count,engagement_rate,avg_views)
      SELECT id,id,CASE WHEN country_code='EG' THEN 'instagram' ELSE 'youtube' END,'catalog'||id,'catalog'||id,
      CASE WHEN country_code='EG' THEN 600000 ELSE 100 END,
      CASE WHEN country_code='EG' THEN 8 ELSE 0.5 END,CASE WHEN country_code='EG' THEN 20000 ELSE 10 END
      FROM influencers WHERE display_name LIKE 'Catalog %';
      INSERT INTO influencers(id,display_name,categories,notes) VALUES('${uuid(30000)}','Inferred',ARRAY['Beauty'],'Cairo Egypt beauty');
      UPDATE influencers SET country_code='Egypt',categories=ARRAY['Beauty & Cosmetics'] WHERE id='${uuid(1)}';
      CREATE INDEX fixture_account_owner ON influencer_platform_accounts(influencer_id);
      CREATE INDEX fixture_account_platform ON influencer_platform_accounts(platform);
      CREATE INDEX fixture_country ON influencers(country_code);
      CREATE INDEX fixture_metrics_latest ON profile_metrics(profile_id,captured_at DESC);
      ANALYZE;`);
    const scenarios: Array<[string,Partial<CreatorSearchFilters>]> = [
      ['Egypt',{countries:['EG']}], ['Egypt Beauty',{countries:['EG'],categories:['Beauty']}],
      ['Egypt Beauty Macro',{countries:['EG'],categories:['Beauty'],minFollowers:'500000'}],
      ['Platform followers',{platforms:['instagram'],minFollowers:'500000'}],
      ['Engagement',{minEngagement:'4'}],
      ['Combined',{countries:['EG'],categories:['Beauty'],platforms:['instagram'],minFollowers:'500000',minEngagement:'4',minViews:'10000'}],
    ];
    const evidence: unknown[]=[];
    for(const [name,patch] of scenarios) {
      const windows: number[]=[]; let filtersArg: unknown;
      const client={rpc:async(_name:string,args:Record<string,unknown>)=>{
        filtersArg=args.p_filters;
        const literal=JSON.stringify(args.p_filters).replace(/'/g,"''");
        const data=JSON.parse(sql(`BEGIN READ ONLY; SELECT discovery_normal_candidate_window('',${args.p_offset},${args.p_limit},false,false,'${literal}'::jsonb); COMMIT;`));
        windows.push(data.scannedCount);return {data,error:null};
      }} as unknown as Pick<SupabaseClient,'rpc'>;
      const started=Date.now();
      const request={filters:{...cloneCreatorSearchFilters(),...patch},sort:{field:'engagement' as const,direction:'desc' as const},page:1,pageSize:24};
      const result=await runNormalSearchTransport(client,request);
      assert.equal(result.completeness.status,'complete',name);
      assert.equal(result.total,name==='Egypt' || name==='Egypt Beauty' ? 502 : 251,name);
      assert.ok(result.total>=250,name);assert.equal(result.creators.length,24,name);
      assert.ok(result.completeness.examined<600,`${name}: scanned ${result.completeness.examined}`);
      const next=await runNormalSearchTransport(client,{...request,page:2});
      assert.equal(new Set([...result.creators,...next.creators].map(c=>c.unified_id)).size,48,name);
      // Explain the exact private helper body, exposing scans/joins hidden by a Function Scan.
      const migration=readFileSync('supabase/migrations/20260920100000_discovery_normal_candidate_window.sql','utf8');
      const body=migration.split('AS $$')[1].split('$$;')[0]
        .replace(/\bp_filters\b/g,()=>`'${JSON.stringify(filtersArg).replace(/'/g,"''")}'::jsonb`)
        .replace(/\bp_limit\b/g,'200').replace(/\bp_offset\b/g,'0');
      const plan=JSON.parse(sql(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ${body}`));
      evidence.push({name,total:result.total,examined:result.completeness.examined,windows,elapsedMs:Date.now()-started,plan});
    }
    writeFileSync('.tmp/discovery-closure-explain.json',JSON.stringify(evidence,null,2));
    sql(`INSERT INTO influencers(id,display_name,country_code) VALUES('${uuid(31002)}','Split accounts','EG');
      INSERT INTO influencer_platform_accounts(id,influencer_id,platform,follower_count,engagement_rate) VALUES
      ('${uuid(31003)}','${uuid(31002)}','instagram',600000,1),('${uuid(31004)}','${uuid(31002)}','instagram',100,9);`);
    assert.equal(sql(`SELECT count(*) FROM discovery_normal_filter_candidates('{"platforms":["instagram"],"ranges":[{"min":500000,"max":null}],"minEngagement":4}',200,200) WHERE creator_id='${uuid(31002)}';`),'0');
    assert.equal(sql("SELECT has_function_privilege('authenticated','discovery_normal_filter_candidates(jsonb,integer,integer)','EXECUTE');"),'f');
    assert.equal(sql("SELECT provolatile FROM pg_proc WHERE oid='discovery_normal_candidate_window(text,integer,integer,boolean,boolean,jsonb)'::regprocedure;"),'s');
    assert.equal(sql("SELECT has_function_privilege('anon','discovery_normal_candidate_window(text,integer,integer,boolean,boolean,jsonb)','EXECUTE');"),"f");
    assert.equal(sql("SET ROLE authenticated; BEGIN READ ONLY; SELECT jsonb_typeof(discovery_normal_candidate_window('',0,1,false,false,'{}')->'items'); COMMIT; RESET ROLE;"),'array');
    const attack={categories:["Beauty'); DROP TABLE influencers; --"]};
    const attacked=JSON.parse(sql(`BEGIN READ ONLY; SELECT discovery_normal_candidate_window('',0,200,false,false,'${JSON.stringify(attack).replace(/'/g,"''")}'::jsonb); COMMIT;`));
    assert.equal(attacked.items.length,0);
    assert.ok(Number(sql('SELECT count(*) FROM influencers;'))>24000);
    const denied=spawnSync(path.join(bin,"psql.exe"),["-X","-h","127.0.0.1","-p",port,"-U","discovery_fixture","-d","postgres","-v","ON_ERROR_STOP=1","-c","SET fixture.allowed='no'; SELECT discovery_normal_candidate_window();"],{encoding:"utf8",windowsHide:true});
    assert.notEqual(denied.status,0);assert.match(denied.stderr,/Insufficient permissions/);
    assert.throws(()=>sql("SELECT discovery_normal_candidate_window('',0,NULL);"),/Invalid Discovery window/);
    assert.throws(()=>sql("SELECT discovery_normal_candidate_window('',0,1,false,false,'[]');"),/Invalid Discovery filters/);
    sql(readFileSync('supabase/rollbacks/20260920100000_discovery_normal_candidate_window.sql','utf8'));
    assert.equal(sql("SELECT to_regprocedure('discovery_normal_candidate_window(text,integer,integer,boolean,boolean,jsonb)') IS NULL;"),'t');
    assert.equal(sql("SELECT to_regprocedure('discovery_normal_filter_candidates(jsonb,integer,integer)') IS NULL;"),'t');
    assert.equal(sql("SELECT md5(pg_get_functiondef('search_creators_impl(text,integer,integer)'::regprocedure));"),retrievalDefinition);
    // Reapply after rollback, retaining the real Production platform type contract.
    sql(readFileSync('supabase/migrations/20260920100000_discovery_normal_candidate_window.sql','utf8'));
    assert.equal(sql("SELECT atttypid::regtype::text FROM pg_attribute WHERE attrelid='discovered_profiles'::regclass AND attname='platform';"),'discovery_platform');
    const platforms=['instagram','tiktok','youtube','twitter'];
    assert.deepEqual(JSON.parse(sql("SELECT to_json(enum_range(NULL::public.discovery_platform));")),platforms);
    for (const [index,platform] of platforms.entries()) {
      const id=uuid(40000+index);
      const handle=`enumcreator${index}`;
      sql(`INSERT INTO discovered_profiles(id,platform,username,display_name,search_vector) VALUES('${id}','${platform}','${handle}','${handle}',to_tsvector('simple','${handle}'));
        INSERT INTO profile_metrics(id,profile_id,followers,engagement_rate,avg_views,captured_at) VALUES('${id}','${id}',600000,8,20000,now());`);
      const filters=JSON.stringify({platforms:[platform],ranges:[{min:500000,max:1000000}],minEngagement:4});
      for (const query of [`@${handle}`,handle.slice(0,-1),'']) {
        const response=JSON.parse(sql(`SET ROLE authenticated; BEGIN READ ONLY; SELECT discovery_normal_candidate_window('${query}',0,200,false,false,'${filters}'); COMMIT; RESET ROLE;`));
        const creator=response.items.find((item:{unified_id:string})=>item.unified_id===`dis:${id}`);
        assert.ok(creator,`${platform}: ${query || 'filter-only'}`);
        assert.equal(creator.platforms[0].platform,platform);
      }
    }
    assert.throws(()=>sql("SET ROLE anon; SELECT discovery_normal_candidate_window();"),/permission denied/);
    assert.throws(()=>sql("SET ROLE authenticated; SELECT * FROM discovery_normal_filter_candidates('{}',1,0);"),/permission denied/);
    sql(readFileSync('supabase/rollbacks/20260920100000_discovery_normal_candidate_window.sql','utf8'));
  } finally { command("pg_ctl",["-D",data,"-m","fast","-w","stop"]); }
});
