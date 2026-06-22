import type { SupabaseClient } from "@supabase/supabase-js";

import { suggestCostFromRateCard } from "@/features/campaigns/line-assignment";
import { loadCreatorHistoricalMetrics } from "@/lib/creators/historical-metrics";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { getUnifiedCreatorById } from "@/lib/creators/unified-browse";

export const MAX_CREATOR_COMPARE = 4;

export type CreatorCompareEnrichment = {
  growth_rate_percent: number | null;
  previous_collaborations: number;
  audience_gender: string;
  audience_age: string;
  estimated_pricing: string;
};

export type CreatorCompareEntry = {
  creator: UnifiedCreatorResult;
  enrichment: CreatorCompareEnrichment;
};

export type CreatorCompareBundle = {
  entries: CreatorCompareEntry[];
};

function formatGenderSplit(split: Record<string, unknown> | null | undefined): string {
  if (!split || typeof split !== "object") return "—";
  const female = Number(split.female ?? split.Female ?? split.f ?? 0);
  const male = Number(split.male ?? split.Male ?? split.m ?? 0);
  if (!female && !male) return "—";
  return `${Math.round(female)}% F · ${Math.round(male)}% M`;
}

function computeGrowthRatePercent(
  points: Array<{ value: number }>
): number | null {
  if (points.length < 2) return null;
  const first = points[0]?.value ?? 0;
  const last = points[points.length - 1]?.value ?? 0;
  if (first <= 0) return null;
  return ((last - first) / first) * 100;
}

function formatGrowthRate(value: number | null): string {
  if (value == null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatPricing(amount: number | null, currency?: string): string {
  if (amount == null || amount <= 0) return "—";
  const cur = currency ?? "USD";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: cur,
    maximumFractionDigits: 0,
  }).format(amount);
}

function audienceAgeFromPersona(persona: string | null): string {
  if (!persona?.trim()) return "—";
  const ageMatch = persona.match(/\b(\d{1,2})\s*[-–]\s*(\d{1,2})\b/);
  if (ageMatch) return `${ageMatch[1]}–${ageMatch[2]}`;
  if (/gen\s*z|18\s*[-–]\s*24|young/i.test(persona)) return "18–24";
  if (/millennial|25\s*[-–]\s*34/i.test(persona)) return "25–34";
  return persona.length > 32 ? `${persona.slice(0, 32)}…` : persona;
}

async function loadEnrichmentForCreator(
  supabase: SupabaseClient,
  creator: UnifiedCreatorResult
): Promise<CreatorCompareEnrichment> {
  const [history, collabCount, profileExtras, influencerExtras] = await Promise.all([
    loadCreatorHistoricalMetrics(supabase, creator.unified_id),
    creator.influencer_id
      ? supabase
          .from("campaign_influencers")
          .select("id", { count: "exact", head: true })
          .eq("influencer_id", creator.influencer_id)
      : Promise.resolve({ count: 0 }),
    creator.discovered_profile_id
      ? supabase
          .from("discovered_profiles")
          .select("audience_persona, audience_type")
          .eq("id", creator.discovered_profile_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    creator.influencer_id
      ? supabase
          .from("influencers")
          .select("rate_card, payment_details")
          .eq("id", creator.influencer_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const growth_rate_percent = computeGrowthRatePercent(history.followers);

  let audience_gender = "—";
  let audience_age = "—";
  let estimated_pricing = "—";

  if (creator.influencer_id) {
    const { data: account } = await supabase
      .from("influencer_platform_accounts")
      .select("audience_gender_split, metadata")
      .eq("influencer_id", creator.influencer_id)
      .order("is_primary", { ascending: false })
      .limit(1)
      .maybeSingle();

    audience_gender = formatGenderSplit(
      account?.audience_gender_split as Record<string, unknown> | undefined
    );

    const meta = account?.metadata as Record<string, unknown> | undefined;
    const ageBand = meta?.audience_age_band ?? meta?.audience_age;
    audience_age =
      typeof ageBand === "string" && ageBand.trim()
        ? ageBand
        : audienceAgeFromPersona(null);

    const rateCard = (influencerExtras.data?.rate_card ?? {}) as Record<string, unknown>;
    const payment = (influencerExtras.data?.payment_details ?? {}) as Record<string, unknown>;
    const currency =
      typeof payment.currency === "string" ? payment.currency : creator.suggested_currency;
    const amount = suggestCostFromRateCard(rateCard, []);
    estimated_pricing = formatPricing(amount > 0 ? amount : null, currency);
  }

  if (creator.discovered_profile_id && profileExtras.data) {
    const persona = profileExtras.data.audience_persona as string | null;
    if (audience_gender === "—" && persona) {
      if (/female|women|f\s*%/i.test(persona)) audience_gender = persona.slice(0, 40);
    }
    if (audience_age === "—") {
      audience_age = audienceAgeFromPersona(persona);
    }
  }

  return {
    growth_rate_percent,
    previous_collaborations: collabCount.count ?? 0,
    audience_gender,
    audience_age,
    estimated_pricing,
  };
}

export async function loadCreatorCompareBundle(
  supabase: SupabaseClient,
  unifiedIds: string[]
): Promise<CreatorCompareBundle> {
  const ids = [...new Set(unifiedIds)].slice(0, MAX_CREATOR_COMPARE);
  const creators = (
    await Promise.all(ids.map((id) => getUnifiedCreatorById(supabase, id)))
  ).filter((c): c is UnifiedCreatorResult => c != null);

  const entries = await Promise.all(
    creators.map(async (creator) => ({
      creator,
      enrichment: await loadEnrichmentForCreator(supabase, creator),
    }))
  );

  return { entries };
}

export { formatGrowthRate };
