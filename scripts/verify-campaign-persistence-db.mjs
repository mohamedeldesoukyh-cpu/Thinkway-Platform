/**
 * Verify campaign_objects persistence tables via service role.
 * Run: node scripts/verify-campaign-persistence-db.mjs [conversationId]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(path.join(ROOT, ".env.local"));
loadEnvFile(path.join(ROOT, ".env"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const conversationId = process.argv[2];

async function countTable(table) {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  return { table, count: count ?? 0, error: error?.message ?? null };
}

async function main() {
  const tables = [
    "campaign_objects",
    "campaign_object_versions",
    "audit_logs",
    "ipl_refresh_policies",
    "creator_dna",
  ];

  console.log("\n=== Campaign Persistence DB Verification ===\n");
  for (const table of tables) {
    const result = await countTable(table);
    if (result.error) {
      console.log(`${result.table}: ERROR — ${result.error}`);
    } else {
      console.log(`${result.table}: ${result.count} rows`);
    }
  }

  if (conversationId) {
    console.log(`\n--- Lookup conversation ${conversationId} ---`);
    const { data: obj, error: objErr } = await supabase
      .from("campaign_objects")
      .select("*")
      .eq("conversation_id", conversationId)
      .maybeSingle();
    if (objErr) {
      console.log("campaign_objects lookup:", objErr.message);
    } else if (!obj) {
      console.log("campaign_objects: NOT FOUND");
    } else {
      console.log("campaign_objects:", JSON.stringify(obj, null, 2));
      const { data: versions, error: verErr } = await supabase
        .from("campaign_object_versions")
        .select("id, version, created_at")
        .eq("campaign_object_id", obj.id)
        .order("version", { ascending: false });
      if (verErr) {
        console.log("campaign_object_versions:", verErr.message);
      } else {
        console.log(`campaign_object_versions: ${versions?.length ?? 0} rows`);
        for (const v of versions ?? []) {
          console.log(`  v${v.version} ${v.id} @ ${v.created_at}`);
        }
      }
      const { data: audits, error: auditErr } = await supabase
        .from("audit_logs")
        .select("id, action, entity_type, metadata, created_at")
        .eq("entity_id", obj.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (auditErr) {
        console.log("audit_logs:", auditErr.message);
      } else {
        console.log(`audit_logs (entity_id=${obj.id}): ${audits?.length ?? 0} recent`);
        for (const a of audits ?? []) {
          console.log(`  ${a.action} ${a.entity_type} @ ${a.created_at}`);
        }
      }
    }
  }

  const { data: recentConvos } = await supabase
    .from("ai_conversations")
    .select("id, title, created_at")
    .ilike("title", "%babyjoy%")
    .order("created_at", { ascending: false })
    .limit(3);

  if (recentConvos?.length) {
    console.log("\n--- Recent BabyJoy conversations ---");
    for (const c of recentConvos) {
      const { count } = await supabase
        .from("campaign_objects")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", c.id);
      console.log(`  ${c.id} "${c.title}" — campaign_objects: ${count ?? 0}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
