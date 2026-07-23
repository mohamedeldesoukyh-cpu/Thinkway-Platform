import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { browseUnifiedCreators } from "@/lib/creators/unified-browse";
import { buildDiscoveryCreatorViewModel } from "@/features/discovery/view-models/discovery-creator-view-model";
import { inferCountriesFromProfileSignals } from "@/lib/creators/country-inference";

function loadEnv(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnv(".env.local");
loadEnv(".env");

function extractFlagEmojiCodes(text: string): string[] {
  const codes: string[] = [];
  const chars = [...text];
  for (let i = 0; i < chars.length - 1; i++) {
    const a = chars[i].codePointAt(0) ?? 0;
    const b = chars[i + 1].codePointAt(0) ?? 0;
    if (a >= 0x1f1e6 && a <= 0x1f1ff && b >= 0x1f1e6 && b <= 0x1f1ff) {
      const code = String.fromCharCode(a - 0x1f1e6 + 65, b - 0x1f1e6 + 65);
      if (!codes.includes(code)) codes.push(code);
      i += 1;
    }
  }
  return codes;
}

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const browse = await browseUnifiedCreators(sb, { page: 1, pageSize: 50 }, "trace");
  const empty = browse.creators.filter(
    (c) => buildDiscoveryCreatorViewModel(c).countryFlagCodes.length === 0
  );

  let withStoredBio = 0;
  let flagInBio = 0;
  let currentInferHits = 0;
  let flagOrPortugalHits = 0;
  const details: Array<Record<string, unknown>> = [];

  for (const c of empty) {
    const id = c.influencer_id!;
    const { data: plats } = await sb
      .from("influencer_platform_accounts")
      .select("profile_bio, audience_country, field_sources")
      .eq("influencer_id", id);
    const { data: ipl } = await sb
      .from("ipl_snapshots")
      .select("normalized_snapshot")
      .eq("influencer_id", id)
      .eq("is_latest", true)
      .limit(1)
      .maybeSingle();

    const bio =
      (plats ?? []).map((p) => p.profile_bio).filter(Boolean).join("\n") ||
      ((ipl?.normalized_snapshot as { bio?: string } | null)?.bio ?? "");

    if (!bio.trim()) continue;
    withStoredBio += 1;
    const flags = extractFlagEmojiCodes(bio);
    const current = inferCountriesFromProfileSignals({ bio, displayName: c.display_name });
    if (flags.length) flagInBio += 1;
    if (current.length) currentInferHits += 1;
    const portugal = /portugal/i.test(bio);
    if (flags.length || portugal || current.length) {
      flagOrPortugalHits += 1;
      details.push({
        name: c.display_name,
        flags,
        currentInfer: current,
        portugal,
        bioPreview: bio.slice(0, 90),
        audience_country: (plats ?? [])[0]?.audience_country ?? null,
        field_sources: (plats ?? [])[0]?.field_sources ?? null,
      });
    }
  }

  // Also dump provenance for one flagged creator field_sources
  const flagged = browse.creators.find(
    (c) => buildDiscoveryCreatorViewModel(c).countryFlagCodes.length > 0
  );
  let flaggedProvenance = null;
  if (flagged?.influencer_id) {
    const { data: plats } = await sb
      .from("influencer_platform_accounts")
      .select("audience_country, field_sources, profile_bio")
      .eq("influencer_id", flagged.influencer_id);
    flaggedProvenance = {
      name: flagged.display_name,
      country_code: flagged.country_code,
      notes: flagged.notes,
      enrichment_source: flagged.enrichment_source,
      platforms: plats,
    };
  }

  console.log(
    JSON.stringify(
      {
        page1Empty: empty.length,
        emptyWithStoredBio: withStoredBio,
        emptyBioHasFlagEmoji: flagInBio,
        emptyCurrentBioInferHits: currentInferHits,
        emptyRecoverableIfFlagOrPortugal: flagOrPortugalHits,
        details,
        flaggedProvenance,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
