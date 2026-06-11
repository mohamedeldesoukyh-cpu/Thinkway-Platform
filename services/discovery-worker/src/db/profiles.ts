import { supabase } from "./supabase.js";
import type { CrawledProfile, CrawledPost, CrawledRelationship } from "../crawlers/types.js";

export type DiscoveryMethod = "hashtag" | "competitor" | "location" | "trend" | "manual";

export type ProfileUpsertExtras = {
  countryCode?: string;
  city?: string;
  categoryTags?: string[];
  thinkwayScore?: number;
  sourceConfidence?: number;
  metricConfidence?: Record<string, string>;
  languageCodes?: string[];
  stage?: string;
};

export async function upsertDiscoveredProfile(
  profile: CrawledProfile,
  method: DiscoveryMethod,
  sourceRef?: string,
  extras?: ProfileUpsertExtras
): Promise<string> {
  const { data, error } = await supabase
    .from("discovered_profiles")
    .upsert(
      {
        platform: profile.platform,
        username: profile.username,
        profile_url: profile.profileUrl,
        display_name: profile.displayName ?? null,
        bio: profile.bio ?? null,
        profile_image_url: profile.profileImageUrl ?? null,
        email_in_bio: profile.emailInBio ?? null,
        country_code: extras?.countryCode ?? null,
        city: extras?.city ?? null,
        category_tags: extras?.categoryTags ?? [],
        language_codes: extras?.languageCodes ?? [],
        thinkway_score: extras?.thinkwayScore ?? null,
        source_confidence: extras?.sourceConfidence ?? null,
        metric_confidence: extras?.metricConfidence ?? {},
        metadata: profile.metadata ?? {},
        stage: extras?.stage ?? "discovered",
      },
      { onConflict: "platform,username" }
    )
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  const profileId = data.id as string;

  await supabase.from("discovery_sources").insert({
    profile_id: profileId,
    method,
    source_ref: sourceRef ?? null,
    metadata: {},
  });

  return profileId;
}

export async function saveProfileMetrics(
  profileId: string,
  metrics: {
    followers?: number;
    following?: number;
    postsCount?: number;
    avgLikes?: number;
    avgComments?: number;
    engagementRate?: number;
    avgViews?: number;
    postingFrequencyPerWeek?: number;
    reelsViewsAvg?: number;
  }
): Promise<void> {
  const followers = metrics.followers ?? 0;
  const avgLikes = metrics.avgLikes ?? null;
  const avgComments = metrics.avgComments ?? null;
  const engagementRate =
    metrics.engagementRate ??
    (followers > 0 && avgLikes != null
      ? Number((((avgLikes + (avgComments ?? 0)) / followers) * 100).toFixed(3))
      : null);

  const { error } = await supabase.from("profile_metrics").insert({
    profile_id: profileId,
    followers,
    following: metrics.following ?? 0,
    posts_count: metrics.postsCount ?? 0,
    avg_likes: avgLikes,
    avg_comments: avgComments,
    engagement_rate: engagementRate,
    avg_views: metrics.avgViews ?? null,
    posting_frequency_per_week: metrics.postingFrequencyPerWeek ?? null,
    reels_views_avg: metrics.reelsViewsAvg ?? null,
    source: "public_crawl",
  });
  if (error) throw new Error(error.message);
}

export async function saveProfilePosts(profileId: string, posts: CrawledPost[]): Promise<void> {
  if (posts.length === 0) return;
  const rows = posts.slice(0, 20).map((post) => ({
    profile_id: profileId,
    platform_post_id: post.platformPostId ?? null,
    post_url: post.postUrl ?? null,
    caption: post.caption ?? null,
    likes: post.likes ?? 0,
    comments: post.comments ?? 0,
    views: post.views ?? null,
    hashtags: post.hashtags ?? [],
    posted_at: post.postedAt ?? null,
  }));
  const { error } = await supabase.from("profile_posts").upsert(rows, {
    onConflict: "profile_id,platform_post_id",
    ignoreDuplicates: true,
  });
  if (error) throw new Error(error.message);
}

export async function saveRelationships(
  sourceProfileId: string,
  platform: string,
  relationships: CrawledRelationship[]
): Promise<void> {
  for (const rel of relationships.slice(0, 25)) {
    const { data: target } = await supabase
      .from("discovered_profiles")
      .select("id")
      .eq("platform", platform)
      .eq("username", rel.targetUsername)
      .maybeSingle();

    if (!target?.id) continue;

    await supabase.from("profile_relationships").upsert(
      {
        source_profile_id: sourceProfileId,
        target_profile_id: target.id,
        relationship_type: rel.relationshipType,
        strength: rel.strength ?? 1,
      },
      { onConflict: "source_profile_id,target_profile_id,relationship_type" }
    );
  }
}

export async function updateProfileStage(
  profileId: string,
  stage: string,
  patch: Record<string, unknown> = {}
): Promise<void> {
  const { error } = await supabase
    .from("discovered_profiles")
    .update({
      stage,
      last_enriched_at: new Date().toISOString(),
      ...patch,
    })
    .eq("id", profileId);
  if (error) throw new Error(error.message);
}
