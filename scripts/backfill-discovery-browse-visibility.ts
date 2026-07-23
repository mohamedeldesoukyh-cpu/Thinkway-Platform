/**
 * One-time backfill: activate discovery-sourced prospect influencers and bump recency
 * so they appear in Discovery Search default browse.
 *
 * Run: npx tsx scripts/backfill-discovery-browse-visibility.ts
 */
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or Supabase key in env.");
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  const nowIso = new Date().toISOString();

  const { data: linkedProfiles, error: profileError } = await supabase
    .from("discovered_profiles")
    .select("id, influencer_id")
    .not("influencer_id", "is", null);

  if (profileError) throw profileError;

  const influencerIds = [
    ...new Set(
      (linkedProfiles ?? [])
        .map((row) => row.influencer_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  let activated = 0;
  let recencyTouched = 0;

  for (const influencerId of influencerIds) {
    const { data: row, error } = await supabase
      .from("influencers")
      .select("id, status")
      .eq("id", influencerId)
      .maybeSingle();
    if (error) throw error;
    if (!row) continue;

    const patch: Record<string, string> = { updated_at: nowIso };
    if (row.status === "prospect") {
      patch.status = "active";
      activated += 1;
    }

    const { error: updateError } = await supabase
      .from("influencers")
      .update(patch as never)
      .eq("id", influencerId);
    if (updateError) throw updateError;
    recencyTouched += 1;
  }

  const { data: shortlistProfiles, error: shortlistError } = await supabase
    .from("discovery_shortlist_items")
    .select("profile_id")
    .not("profile_id", "is", null);

  if (shortlistError) throw shortlistError;

  const profileIds = [
    ...new Set(
      (shortlistProfiles ?? [])
        .map((row) => row.profile_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  if (profileIds.length > 0) {
    const { error: touchError } = await supabase
      .from("discovered_profiles")
      .update({ updated_at: nowIso } as never)
      .in("id", profileIds)
      .is("influencer_id", null);
    if (touchError) throw touchError;
  }

  console.log(
    JSON.stringify(
      {
        linkedInfluencers: influencerIds.length,
        activatedProspects: activated,
        influencersRecencyTouched: recencyTouched,
        unlinkedShortlistProfilesTouched: profileIds.length,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
