/** Read-only: find canonical accounts for "yaser" handles and count orphan influencers (no platform accounts). */
import fs from "node:fs";

import { createClient } from "@supabase/supabase-js";

function loadEnv(path: string) {
  if (!fs.existsSync(path)) return;
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv(".env.local");
loadEnv(".env");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const { data: yaserAccounts, error } = await supabase
    .from("influencer_platform_accounts")
    .select("influencer_id, platform, handle, follower_count, engagement_rate, avg_likes")
    .or("handle.ilike.%yaser%,username.ilike.%yaser%");
  if (error) throw new Error(error.message);
  console.log("Accounts with yaser handle:", JSON.stringify(yaserAccounts, null, 2));

  // Count influencers with zero platform accounts (orphan shells).
  const { data: allInfluencers, error: infError } = await supabase
    .from("influencers")
    .select("id, display_name, status, created_at, notes")
    .eq("status", "active");
  if (infError) throw new Error(infError.message);

  const ids = (allInfluencers ?? []).map((row) => row.id);
  const accountOwners = new Set<string>();
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    let attempt = 0;
    for (;;) {
      const { data: accounts, error: accError } = await supabase
        .from("influencer_platform_accounts")
        .select("influencer_id")
        .in("influencer_id", chunk);
      if (!accError) {
        for (const account of accounts ?? []) accountOwners.add(account.influencer_id);
        break;
      }
      if (++attempt >= 4) throw new Error(accError.message);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }

  const orphans = (allInfluencers ?? []).filter((row) => !accountOwners.has(row.id));
  console.log(`Active influencers: ${allInfluencers?.length}`);
  console.log(`Orphans (no platform accounts): ${orphans.length}`);
  const byNote = new Map<string, number>();
  for (const orphan of orphans) {
    const note = (orphan.notes ?? "(none)").slice(0, 60);
    byNote.set(note, (byNote.get(note) ?? 0) + 1);
  }
  console.log("Orphans by notes:", JSON.stringify([...byNote.entries()], null, 2));
  console.log(
    "Sample orphans:",
    JSON.stringify(
      orphans.slice(0, 15).map((o) => ({ id: o.id, name: o.display_name, created: o.created_at })),
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
