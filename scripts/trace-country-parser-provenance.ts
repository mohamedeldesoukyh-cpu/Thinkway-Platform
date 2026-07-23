/**
 * Trace how country_code was populated for a flagged creator, and whether
 * stored raw payloads still contain enough signal for offline re-parse.
 *
 *   npx tsx scripts/trace-country-parser-provenance.ts
 */
import fs from "node:fs";

import { createClient } from "@supabase/supabase-js";

import {
  normalizeApifyProfileData,
  pickApifyAudienceCountry,
} from "@/lib/creator-enrichment/apify-profile";
import { persistCountryFromApifyProfile } from "@/lib/creators/country-persistence";
import { collectCountryCodesFromExistingData } from "@/lib/creators/country-backfill";
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

const FLAGGED_ID = "dab5e61e-e82b-4fa4-a587-a2ee580d6cd8"; // ahmed_elbadawy EG
const EMPTY_ID = "f1d9187c"; // will resolve full uuid — Flavio with PT bio

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // Resolve empty sample by display name from audit
  const { data: emptyHit } = await sb
    .from("influencers")
    .select("id, display_name")
    .ilike("display_name", "%Flavio Mesquita%")
    .limit(1)
    .maybeSingle();

  const emptyId = emptyHit?.id ?? null;

  for (const [label, id] of [
    ["FLAGGED_ahmed_elbadawy", FLAGGED_ID],
    ["EMPTY_flavio", emptyId],
  ] as const) {
    if (!id) {
      console.log(`\n==== ${label}: not found ====`);
      continue;
    }

    const { data: inf } = await sb
      .from("influencers")
      .select(
        "id, display_name, country_code, country_codes, enrichment_status, enrichment_source, notes, metadata, last_enriched_at, created_at, field_sources"
      )
      .eq("id", id)
      .single();

    const { data: plats } = await sb
      .from("influencer_platform_accounts")
      .select(
        "platform, handle, audience_country, profile_bio, follower_count, field_sources, enrichment_status"
      )
      .eq("influencer_id", id);

    const { data: dna } = await sb
      .from("creator_dna")
      .select("document, updated_at")
      .eq("influencer_id", id)
      .maybeSingle();

    const { data: iplRows } = await sb
      .from("ipl_snapshots")
      .select("id, fetched_at, is_latest, normalized_snapshot, raw_snapshot")
      .eq("influencer_id", id)
      .order("fetched_at", { ascending: false })
      .limit(3);

    const { data: runs } = await sb
      .from("creator_enrichment_runs")
      .select(
        "id, status, source, fields_updated, trigger, created_at, completed_at, error_message"
      )
      .eq("influencer_id", id)
      .order("created_at", { ascending: false })
      .limit(8);

    const doc = dna?.document as {
      audience?: { country?: { value?: unknown; source?: string; history?: unknown[] } };
    } | null;
    const dnaCountry = doc?.audience?.country ?? null;

    const reparse = (iplRows ?? []).map((snap) => {
      const raw = (snap.raw_snapshot ?? {}) as {
        platformKey?: string;
        profileUrl?: string;
        username?: string;
        profileRows?: Record<string, unknown>[];
        postRows?: Record<string, unknown>[];
        apifyRunId?: string | null;
      };
      const profileRows = raw.profileRows ?? [];
      const postRows = raw.postRows ?? [];
      const platformKey = raw.platformKey ?? "instagram";
      const head = profileRows[0] ?? postRows[0] ?? {};
      const owner =
        (head.owner as Record<string, unknown>) ||
        (head.author as Record<string, unknown>) ||
        (head.authorMeta as Record<string, unknown>) ||
        head;

      const picked = pickApifyAudienceCountry(
        platformKey,
        head,
        owner,
        [...profileRows, ...postRows]
      );

      const normalized = normalizeApifyProfileData({
        platformKey,
        username: raw.username ?? null,
        profileUrl: raw.profileUrl ?? "",
        profileRows,
        postRows,
        apifyRunId: raw.apifyRunId ?? null,
      });

      const countryWrite = normalized
        ? persistCountryFromApifyProfile({
            audienceCountry: normalized.audienceCountry,
            bio: normalized.bio,
            displayName: normalized.displayName,
            handle: normalized.username,
            hashtags: normalized.hashtags,
            mentions: normalized.mentions,
          })
        : null;

      const bioInfer = inferCountriesFromProfileSignals({
        bio: normalized?.bio ?? (plats ?? [])[0]?.profile_bio,
        displayName: inf?.display_name,
        hashtags: normalized?.hashtags,
        mentions: normalized?.mentions,
      });

      // Nested locationName scan (posts)
      const locationNames = postRows
        .map((r) => r.locationName)
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
        .slice(0, 5);

      return {
        snapshotId: snap.id,
        fetched_at: snap.fetched_at,
        is_latest: snap.is_latest,
        profileRows: profileRows.length,
        postRows: postRows.length,
        pickApifyAudienceCountry: picked,
        normalizedAudienceCountry: normalized?.audienceCountry ?? null,
        normalizedBio: normalized?.bio?.slice(0, 120) ?? null,
        persistCountryFromApifyProfile: countryWrite,
        bioInfer,
        locationNames,
        normStoredAudience: (snap.normalized_snapshot as { audienceCountry?: string | null })
          ?.audienceCountry,
        normStoredBio: (
          (snap.normalized_snapshot as { bio?: string | null })?.bio ?? ""
        ).slice(0, 120),
      };
    });

    const collected = collectCountryCodesFromExistingData({
      influencer: {
        id: inf!.id,
        display_name: inf!.display_name,
        country_code: inf!.country_code,
        country_codes: inf!.country_codes,
        city: null,
        nationality: null,
        audience_top_countries: null,
      },
      platforms: (plats ?? []).map((p) => ({
        audience_country: p.audience_country,
        profile_bio: p.profile_bio,
        profile_display_name: null,
        hashtags: null,
        mentions: null,
      })),
      dnaDocument: dna?.document,
      iplAudienceCountries: (iplRows ?? []).map(
        (s) =>
          (s.normalized_snapshot as { audienceCountry?: string | null })?.audienceCountry ??
          null
      ),
    });

    console.log(
      `\n==== ${label} ${id.slice(0, 8)} ====\n`,
      JSON.stringify(
        {
          influencer: {
            display_name: inf?.display_name,
            country_code: inf?.country_code,
            country_codes: inf?.country_codes,
            enrichment_status: inf?.enrichment_status,
            enrichment_source: inf?.enrichment_source,
            notes: inf?.notes,
            metadata: inf?.metadata,
            field_sources: inf?.field_sources,
            last_enriched_at: inf?.last_enriched_at,
          },
          platforms: plats,
          dnaCountry,
          collected,
          reparseFromStoredRaw: reparse,
          recentRuns: (runs ?? []).map((r) => ({
            status: r.status,
            source: r.source,
            trigger: r.trigger,
            fields_updated: r.fields_updated,
            created_at: r.created_at,
            error_message: r.error_message,
          })),
        },
        null,
        2
      )
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
