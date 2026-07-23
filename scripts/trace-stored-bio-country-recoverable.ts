/**
 * Count how many offline-missing-country creators have country signal in stored bio
 * once flag-emoji + expanded aliases are applied (no Apify).
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { COUNTRY_OPTIONS } from "@/lib/master-data/constants";
import { COUNTRY_ALIASES, resolveCountryCode } from "@/lib/creators/country-code";
import { normalizeCountryCode } from "@/lib/creators/creator-display-utils";

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

/** ISO-2 from regional-indicator flag emojis in text. */
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

function normalizePhrase(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const EXTRA_ALIASES: Record<string, string> = {
  portugal: "PT",
  lisbon: "PT",
  porto: "PT",
  brazil: "BR",
  brasil: "BR",
  argentina: "AR",
  mexico: "MX",
  colombia: "CO",
  chile: "CL",
  peru: "PE",
  lebanon: "LB",
  beirut: "LB",
  ...COUNTRY_ALIASES,
};

const NAME_INDEX = [
  ...COUNTRY_OPTIONS.map((o) => ({ code: o.value, phrase: normalizePhrase(o.label) })),
  ...Object.entries(EXTRA_ALIASES).map(([phrase, code]) => ({
    code,
    phrase: normalizePhrase(phrase),
  })),
].sort((a, b) => b.phrase.length - a.phrase.length);

function extractFromText(text: string): string[] {
  const out: string[] = [];
  for (const flag of extractFlagEmojiCodes(text)) {
    const n = normalizeCountryCode(flag);
    if (n && !out.includes(n)) out.push(n);
  }
  const normalized = normalizePhrase(text);
  for (const match of NAME_INDEX) {
    if (!match.phrase) continue;
    const pattern = new RegExp(
      `(?:^|\\s)${match.phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$)`,
      "i"
    );
    if (pattern.test(normalized)) {
      const code = normalizeCountryCode(resolveCountryCode(match.code)) || match.code;
      // accept even if not in COUNTRY_OPTIONS (PT etc.)
      if (code.length === 2 && !out.includes(code)) out.push(code);
    }
  }
  return out;
}

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: rows } = await sb
    .from("influencers")
    .select("id, display_name, country_code")
    .eq("status", "active")
    .is("country_code", null)
    .ilike("notes", "%Apify dataset export (offline)%")
    .limit(80);

  let withBio = 0;
  let recoverable = 0;
  const samples: Array<{ name: string; bio: string; codes: string[] }> = [];

  for (const row of rows ?? []) {
    const { data: plats } = await sb
      .from("influencer_platform_accounts")
      .select("profile_bio")
      .eq("influencer_id", row.id);
    const bio = (plats ?? []).map((p) => p.profile_bio).filter(Boolean).join("\n");
    if (!bio.trim()) continue;
    withBio += 1;
    const codes = extractFromText(bio);
    if (codes.length) {
      recoverable += 1;
      if (samples.length < 12) {
        samples.push({ name: row.display_name, bio: bio.slice(0, 100), codes });
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        scanned: (rows ?? []).length,
        withBio,
        recoverableWithFlagOrNameParser: recoverable,
        samples,
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
