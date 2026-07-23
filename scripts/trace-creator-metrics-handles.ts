/** Trace metrics for specific handles through DB + browse hydration. */
import fs from "node:fs";

import { createClient } from "@supabase/supabase-js";

import { parseCreatorDNADocument } from "@/features/creator-dna/services/document-factory";
import { hydrateCreatorsWithDna } from "@/lib/creators/dna-browse-hydration";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

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

const HANDLES = ["square_stock", "angelika.beautyexpert", "wassoufspecial2"];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function envelopeValue(envelope: { value?: unknown } | undefined): unknown {
  if (!envelope) return null;
  return envelope.value ?? null;
}

async function main() {
  for (const handle of HANDLES) {
    console.log("\n==========", handle, "==========");

    const { data: accounts, error: accErr } = await supabase
      .from("influencer_platform_accounts")
      .select(
        "id, influencer_id, platform, handle, follower_count, engagement_rate, avg_likes, avg_comments, avg_views, enrichment_status, updated_at"
      )
      .or(`handle.ilike.${handle},username.ilike.${handle}`)
      .limit(5);
    if (accErr) {
      console.error("accounts error:", accErr.message);
      continue;
    }

    if (!accounts?.length) {
      const { data: influencers } = await supabase
        .from("influencers")
        .select("id, display_name, primary_avatar_url, notes, created_at")
        .ilike("display_name", handle)
        .limit(3);
      console.log("NO platform account — influencers by display_name:", JSON.stringify(influencers, null, 2));
      continue;
    }

    for (const account of accounts) {
      console.log("--- platform account ---");
      console.log(JSON.stringify(account, null, 2));

      const { data: influencer } = await supabase
        .from("influencers")
        .select(
          "id, display_name, primary_avatar_url, default_metrics_platform_account_id, notes"
        )
        .eq("id", account.influencer_id)
        .maybeSingle();
      console.log("--- influencer ---");
      console.log(JSON.stringify(influencer, null, 2));

      const { data: dnaRow } = await supabase
        .from("creator_dna")
        .select("influencer_id, document, updated_at")
        .eq("influencer_id", account.influencer_id)
        .maybeSingle();

      if (dnaRow?.document) {
        const doc = parseCreatorDNADocument(dnaRow.document);
        console.log("--- creator_dna ---");
        console.log(
          JSON.stringify(
            {
              updated_at: dnaRow.updated_at,
              platform: envelopeValue(doc.identity.platform),
              followers: envelopeValue(doc.metrics.followers),
              engagementRate: envelopeValue(doc.metrics.engagementRate),
              avgLikes: envelopeValue(doc.metrics.avgLikes),
              avgComments: envelopeValue(doc.metrics.avgComments),
              avgViews: envelopeValue(doc.metrics.avgViews),
              avatar: String(envelopeValue(doc.identity.avatarUrl) ?? "").slice(0, 80),
            },
            null,
            2
          )
        );
      } else {
        console.log("--- creator_dna: NONE ---");
      }

      const stub: UnifiedCreatorResult = {
        unified_id: `inf:${account.influencer_id}`,
        influencer_id: account.influencer_id,
        discovered_profile_id: null,
        display_name: influencer?.display_name ?? handle,
        profile_image_url: influencer?.primary_avatar_url ?? null,
        primaryAvatarUrl: influencer?.primary_avatar_url ?? null,
        platforms: [
          {
            id: account.id,
            platform: account.platform,
            handle: account.handle,
            profile_url: null,
            follower_count: account.follower_count,
            engagement_rate: account.engagement_rate,
            avg_likes: account.avg_likes,
            avg_comments: account.avg_comments,
            avg_views: account.avg_views,
            audience_country: null,
            is_verified: false,
          },
        ],
        metrics: {
          followers: { value: account.follower_count, confidence: "inferred" },
          engagement_rate: { value: account.engagement_rate, confidence: "inferred" },
          avg_likes: { value: account.avg_likes, confidence: "inferred" },
          avg_comments: { value: account.avg_comments, confidence: "inferred" },
          avg_views: { value: account.avg_views, confidence: "inferred" },
          posting_frequency_per_week: { value: null, confidence: "estimated" },
        },
        enrichment_status: account.enrichment_status ?? "never",
        last_enriched_at: account.updated_at,
        country_code: null,
        estimated_country: null,
        categories: [],
        browse_category_tags: [],
        audience_interests: [],
        language_codes: [],
        hashtags: [],
        mentions: [],
        recent_publications: [],
        contact_email: null,
        contact_phone: null,
        contact_links: [],
        ai_category: null,
        ai_niche: null,
        authenticity_score: null,
        thinkway_score: null,
        brand_fit_score: null,
        is_platform_verified: false,
        source_confidence: 0.35,
        dna_completeness: 0,
        historical_performance_score: 0.35,
        dna_verification_required: false,
        notes: null,
        suggested_currency: "EGP",
      };

      const [hydrated] = await hydrateCreatorsWithDna(supabase, [stub]);
      console.log("--- after hydrateCreatorsWithDna ---");
      console.log(
        JSON.stringify(
          {
            platform_followers: hydrated.platforms[0]?.follower_count,
            platform_er: hydrated.platforms[0]?.engagement_rate,
            platform_avg_likes: hydrated.platforms[0]?.avg_likes,
            metrics_followers: hydrated.metrics.followers.value,
            metrics_er: hydrated.metrics.engagement_rate.value,
            metrics_avg_likes: hydrated.metrics.avg_likes.value,
            thinkway_score: hydrated.thinkway_score,
          },
          null,
          2
        )
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
