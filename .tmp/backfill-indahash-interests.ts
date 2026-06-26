import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

import { parsePdfBuffer } from "@/lib/discovery-import/parsers";
import {
  mergeCreatorImportMetadata,
  resolveInfluencerImportCategories,
} from "@/lib/discovery-import/normalize";

const APPLY = process.argv.includes("--apply");
const PDF_PATH = "C:\\Users\\X13 Yoga G3\\Downloads\\Creator 1.pdf";

function readEnv(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2];
    }
  } catch {
    /* ignore */
  }
  return out;
}

const env = { ...readEnv(".env"), ...readEnv(".env.local") };
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

function normUser(u: string): string {
  return u.trim().replace(/^@+/, "").toLowerCase();
}

async function main() {
  const buffer = readFileSync(PDF_PATH);
  const parsed = await parsePdfBuffer(buffer, "indaHash");
  console.log(`Parsed ${parsed.rows.length} rows via parser="${parsed.parser}"`);

  const byUser = new Map(parsed.rows.map((r) => [normUser(r.username), r]));

  const { data: accounts, error } = await supabase
    .from("influencer_platform_accounts")
    .select("id, influencer_id, username, normalized_username, platform, metadata")
    .in(
      "normalized_username",
      [...byUser.keys()]
    );
  if (error) throw new Error(error.message);
  console.log(`Matched ${accounts?.length ?? 0} platform accounts`);

  let updatedAccounts = 0;
  let updatedInfluencers = 0;
  let beforeEmptyCats = 0;
  let afterNonEmptyCats = 0;

  for (const account of accounts ?? []) {
    const key = account.normalized_username ?? normUser(account.username ?? "");
    const row = byUser.get(key);
    if (!row) {
      console.log(`  no parsed row for @${account.username}`);
      continue;
    }

    const existingMeta =
      (account.metadata as Record<string, unknown> | null) ?? {};
    const mergedMetadata = mergeCreatorImportMetadata(existingMeta, row);

    const { data: influencer } = await supabase
      .from("influencers")
      .select("categories")
      .eq("id", account.influencer_id)
      .maybeSingle();

    const existingCats = (influencer?.categories as string[] | undefined) ?? [];
    if (existingCats.length === 0) beforeEmptyCats += 1;
    const mergedCategories = resolveInfluencerImportCategories(existingCats, row);
    if (mergedCategories.length > 0) afterNonEmptyCats += 1;

    console.log(
      `@${account.username}: cats ${existingCats.length} -> ${mergedCategories.length} | interests=${JSON.stringify(row.audience_interests)}`
    );

    if (APPLY) {
      const { error: accErr } = await supabase
        .from("influencer_platform_accounts")
        .update({ metadata: mergedMetadata, updated_at: new Date().toISOString() })
        .eq("id", account.id);
      if (accErr) throw new Error(`account ${account.id}: ${accErr.message}`);
      updatedAccounts += 1;

      const { error: infErr } = await supabase
        .from("influencers")
        .update({ categories: mergedCategories })
        .eq("id", account.influencer_id);
      if (infErr) throw new Error(`influencer ${account.influencer_id}: ${infErr.message}`);
      updatedInfluencers += 1;
    }
  }

  console.log("\n=== RESULT ===");
  console.log("mode:", APPLY ? "APPLIED" : "DRY-RUN");
  console.log("influencers empty-before:", beforeEmptyCats);
  console.log("influencers would-be non-empty-after:", afterNonEmptyCats);
  console.log("accounts updated:", updatedAccounts);
  console.log("influencers updated:", updatedInfluencers);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
