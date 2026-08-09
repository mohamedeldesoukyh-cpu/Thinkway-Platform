import OpenAI from "openai";

import { config } from "../config.js";
import { crawlPublicProfile } from "../crawlers/platform-crawler.js";
import { supabase } from "../db/supabase.js";
import {
  saveProfileMetrics,
  saveProfilePosts,
  saveRelationships,
  updateProfileStage,
} from "../db/profiles.js";

function estimateAuthenticity(input: {
  followers: number;
  following: number;
  avgLikes: number;
  avgComments: number;
  engagementRate: number;
  postsCount: number;
}): number {
  let score = 100;
  if (input.followers > 10_000 && input.engagementRate < 0.5) score -= 25;
  if (input.following / Math.max(input.followers, 1) > 1.5) score -= 10;
  if (input.postsCount < 5 && input.followers > 20_000) score -= 12;
  return Math.max(0, Math.min(100, score));
}

async function runAiClassification(profile: {
  id: string;
  display_name: string | null;
  bio: string | null;
  platform: string;
  username: string;
  category_tags: string[];
}): Promise<void> {
  if (!config.openAiApiKey) {
    await updateProfileStage(profile.id, "ai_scored");
    return;
  }

  const openai = new OpenAI({ apiKey: config.openAiApiKey });
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "Classify influencer from public profile. Return JSON with category, niche, audience_type, content_quality_score, luxury_level_score, brand_fit_score, professionalism_score, influencer_summary, audience_persona, content_style (all scores 0-100).",
      },
      {
        role: "user",
        content: JSON.stringify({
          platform: profile.platform,
          username: profile.username,
          display_name: profile.display_name,
          bio: profile.bio,
          category_tags: profile.category_tags,
        }),
      },
    ],
    response_format: { type: "json_object" },
  });

  const parsed = JSON.parse(response.choices[0]?.message?.content ?? "{}") as Record<
    string,
    string | number | null
  >;

  await supabase.from("profile_ai_scores").insert({
    profile_id: profile.id,
    category: (parsed.category as string) ?? null,
    niche: (parsed.niche as string) ?? null,
    audience_type: (parsed.audience_type as string) ?? null,
    content_quality_score: Number(parsed.content_quality_score ?? 0),
    luxury_level_score: Number(parsed.luxury_level_score ?? 0),
    brand_fit_score: Number(parsed.brand_fit_score ?? 0),
    professionalism_score: Number(parsed.professionalism_score ?? 0),
    influencer_summary: (parsed.influencer_summary as string) ?? null,
    audience_persona: (parsed.audience_persona as string) ?? null,
    content_style: (parsed.content_style as string) ?? null,
  });

  await updateProfileStage(profile.id, "ai_scored", {
    category_tags: parsed.category ? [String(parsed.category)] : profile.category_tags,
  });
}

export async function runEnrichmentPipeline(profileId: string): Promise<void> {
  const { data: profile, error } = await supabase
    .from("discovered_profiles")
    .select("*")
    .eq("id", profileId)
    .single();

  if (error || !profile) throw new Error(error?.message ?? "Profile not found");

  const crawl = await crawlPublicProfile(
    profile.platform as "instagram" | "tiktok" | "youtube" | "twitter",
    profile.username as string
  );

  await supabase
    .from("discovered_profiles")
    .update({
      display_name: crawl.profile.displayName ?? profile.display_name,
      bio: crawl.profile.bio ?? profile.bio,
      profile_image_url: crawl.profile.profileImageUrl ?? profile.profile_image_url,
      email_in_bio: crawl.profile.emailInBio ?? profile.email_in_bio,
      stage: "basic_enriched",
      last_enriched_at: new Date().toISOString(),
    })
    .eq("id", profileId);

  const posts = crawl.posts;
  const avgLikes =
    posts.length > 0
      ? posts.reduce((sum, p) => sum + (p.likes ?? 0), 0) / posts.length
      : null;
  const avgComments =
    posts.length > 0
      ? posts.reduce((sum, p) => sum + (p.comments ?? 0), 0) / posts.length
      : null;
  const videoPosts = posts.filter((p) => (p.views ?? null) != null && (p.views ?? 0) > 0);
  const reelsViewsAvg =
    videoPosts.length > 0
      ? videoPosts.reduce((sum, p) => sum + (p.views ?? 0), 0) / videoPosts.length
      : null;
  const avgViews =
    posts.length > 0
      ? posts.reduce((sum, p) => sum + (p.views ?? 0), 0) / posts.length
      : null;
  const followers = crawl.profile.followers ?? 0;
  const following = crawl.profile.following ?? 0;
  const engagementRate =
    followers > 0 && avgLikes != null
      ? Number((((avgLikes + (avgComments ?? 0)) / followers) * 100).toFixed(3))
      : null;

  await saveProfilePosts(profileId, posts);
  await saveProfileMetrics(profileId, {
    followers,
    following,
    postsCount: posts.length,
    avgLikes: avgLikes ?? undefined,
    avgComments: avgComments ?? undefined,
    avgViews: avgViews ?? undefined,
    engagementRate: engagementRate ?? undefined,
    reelsViewsAvg: reelsViewsAvg ?? undefined,
  });
  await saveRelationships(profileId, profile.platform as string, crawl.relationships);

  const authenticityScore = estimateAuthenticity({
    followers,
    following,
    avgLikes: avgLikes ?? 0,
    avgComments: avgComments ?? 0,
    engagementRate: engagementRate ?? 0,
    postsCount: posts.length,
  });

  const refreshTier =
    followers >= 500_000 ? "top" : followers >= 50_000 ? "medium" : "inactive";
  const refreshDays = refreshTier === "top" ? 1 : refreshTier === "medium" ? 7 : 30;
  const nextRefresh = new Date();
  nextRefresh.setDate(nextRefresh.getDate() + refreshDays);

  await updateProfileStage(profileId, "metrics_enriched", {
    authenticity_score: authenticityScore,
    refresh_tier: refreshTier,
    next_refresh_at: nextRefresh.toISOString(),
  });

  await runAiClassification({
    id: profileId,
    display_name: crawl.profile.displayName ?? profile.display_name,
    bio: crawl.profile.bio ?? profile.bio,
    platform: profile.platform as string,
    username: profile.username as string,
    category_tags: (profile.category_tags as string[]) ?? [],
  });
}
