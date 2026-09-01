import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import type { CampaignPublicationRow } from "@/lib/domains/campaign/types";
import { renderPcard } from "@/lib/performance/report/performance-report-v2-parts";
import { PERFORMANCE_REPORT_DESIGN_V2_STYLES } from "@/lib/performance/report/performance-report-design-v2-styles";

function pub(overrides: Partial<CampaignPublicationRow>): CampaignPublicationRow {
  return {
    id: "p1",
    campaign_header_id: "c1",
    campaign_line_id: null,
    assignment_deliverable_id: null,
    assignment_post_schedule_id: null,
    influencer_id: "i1",
    influencer_name: "Fatma Usama",
    influencer_handle: "fatma",
    influencer_profile_url: "https://www.tiktok.com/@fatma",
    creator_profile_image_url: "https://p16.tiktokcdn.com/blocked-avatar.jpg",
    influencer_avatar_url: null,
    social_profile_picture_url: "https://p16.tiktokcdn.com/blocked-avatar.jpg",
    apify_author_avatar_url: null,
    creator_avatar_url: null,
    platform: "tiktok",
    publication_type: "tiktok_video",
    publication_type_label: "TikTok video",
    platform_label: "TikTok",
    content_url: "https://www.tiktok.com/@fatma/video/1",
    publication_date: "2024-07-26",
    status: "live",
    assignee_id: null,
    assignee_name: null,
    caption: "Caption",
    hashtags: null,
    mentions: null,
    hashtag_count: null,
    mention_count: null,
    thumbnail_url: null,
    screenshot_url: null,
    screenshot_captured_at: null,
    screenshot_source: null,
    notes: null,
    auto_detected: false,
    created_at: "2024-07-26T00:00:00Z",
    updated_at: null,
    last_synced_at: null,
    sync_status: null,
    sync_source: null,
    metrics_refresh_status: null,
    metrics_refresh_attempted_at: null,
    metrics_collection_source: null,
    metrics_provider: null,
    metrics_confidence: null,
    stored_engagements: null,
    impressions: 0,
    impressions_source: "actual",
    actual_impressions: 0,
    forecast_impressions: null,
    forecast_impressions_formula: null,
    reach: 0,
    reach_source: "actual",
    actual_reach: 0,
    forecast_reach: null,
    views: 0,
    unique_views: null,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    clicks: null,
    plays: null,
    watch_time_seconds: null,
    average_watch_time_seconds: null,
    completion_rate: null,
    engagement_rate: 0,
    engagement_rate_method: null,
    platform_follower_count: null,
    view_rate: null,
    cpm: null,
    cpv: null,
    cpe: null,
    cpc: null,
    sentiment_score: null,
    brand_safety_score: null,
    authenticity_score: null,
    cost: null,
    currency: null,
    total_engagements: 0,
    ...overrides,
  } as CampaignPublicationRow;
}

test("publication cards prefer embedded avatar data URIs over blocked CDN URLs", () => {
  const dataUri = "data:image/jpeg;base64,/9j/4AAQ";
  const html = renderPcard(
    pub({
      creator_avatar_url: dataUri,
      screenshot_url: dataUri,
      thumbnail_url: dataUri,
    })
  );
  assert.match(html, /src="data:image\/jpeg;base64,/);
  assert.doesNotMatch(html, /p16\.tiktokcdn\.com\/blocked-avatar/);
  assert.doesNotMatch(html, /No preview/);
});

test("publication cards show No preview only when no still is available", () => {
  const html = renderPcard(pub({ screenshot_url: null, thumbnail_url: null }));
  assert.match(html, /No preview/);
});

test("report sheets clip body overflow so metrics cannot paint over the footer", () => {
  assert.match(PERFORMANCE_REPORT_DESIGN_V2_STYLES, /\.sheet__body\{[^}]*overflow:hidden/);
  assert.match(PERFORMANCE_REPORT_DESIGN_V2_STYLES, /\.pgrid\{[^}]*minmax\(0,1fr\)/);
  assert.match(PERFORMANCE_REPORT_DESIGN_V2_STYLES, /\.pcard\{[^}]*min-height:0/);
  assert.match(PERFORMANCE_REPORT_DESIGN_V2_STYLES, /\.pcard__media\{[^}]*flex:1 1 0/);
  assert.match(PERFORMANCE_REPORT_DESIGN_V2_STYLES, /\.sheet__foot\{[^}]*z-index:2/);
});

test("report document data embeds avatars via fetchCreatorAvatarImage, not a naive CDN fetch", () => {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "performance-report-document-data.ts"),
    "utf8"
  );
  assert.match(source, /embedReportCreatorAvatar/);
  assert.match(source, /preview \?\? row\.screenshot_url/);
  assert.doesNotMatch(source, /embedReportImageDataUri\(resolvedAvatar\)/);
});
