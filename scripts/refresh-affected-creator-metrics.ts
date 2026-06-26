#!/usr/bin/env node
/**
 * Refresh metrics for creators with incomplete publication data.
 *
 * Run:
 *   npm run refresh:affected-creator-metrics
 *   npm run refresh:affected-creator-metrics -- --creator="Shimaa Saber"
 *   npm run refresh:affected-creator-metrics -- --campaign="<campaignId>"
 *   npm run refresh:affected-creator-metrics -- --all
 */
import "@/lib/performance/script-env-preload";

import {
  collectPublicationMetricsById,
  requestMetricsCollection,
} from "@/lib/performance/metrics-collector";
import { enqueuePublicationScreenshotJob } from "@/lib/performance/screenshot-capture/queue";
import { createScriptSupabase, parseCliArgs } from "@/lib/performance/script-env";

const DEFAULT_CREATOR_PATTERNS = [/shimaa/i, /hussein/i, /shaiban/i];

type MetricSnapshot = {
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  metrics_refresh_status: string | null;
  screenshot_url: string | null;
};

function snapshotFromRow(row: Record<string, unknown>): MetricSnapshot {
  return {
    views: (row.views as number | null) ?? null,
    likes: (row.likes as number | null) ?? null,
    comments: (row.comments as number | null) ?? null,
    shares: (row.shares as number | null) ?? null,
    saves: (row.saves as number | null) ?? null,
    metrics_refresh_status: (row.metrics_refresh_status as string | null) ?? null,
    screenshot_url: (row.screenshot_url as string | null) ?? null,
  };
}

function formatSnapshot(s: MetricSnapshot): string {
  return JSON.stringify({
    views: s.views,
    likes: s.likes,
    comments: s.comments,
    shares: s.shares,
    saves: s.saves,
    status: s.metrics_refresh_status,
    screenshot: s.screenshot_url ? "yes" : "no",
  });
}

function metricsLost(before: MetricSnapshot, after: MetricSnapshot): string[] {
  const lost: string[] = [];
  for (const key of ["views", "likes", "comments", "shares", "saves"] as const) {
    const b = before[key];
    const a = after[key];
    if (b != null && b > 0 && (a == null || a === 0)) {
      lost.push(key);
    }
  }
  return lost;
}

function isIncomplete(row: MetricSnapshot): boolean {
  const hasMetrics = [row.views, row.likes, row.comments, row.shares, row.saves].some(
    (v) => v != null && v > 0
  );
  const needsScreenshot = !row.screenshot_url;
  const needsStatus = ["pending", "failed", "partial", "queued"].includes(
    row.metrics_refresh_status ?? "pending"
  );
  return !hasMetrics || needsScreenshot || needsStatus;
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  const supabase = createScriptSupabase();

  const creatorArg = typeof args.creator === "string" ? args.creator : null;
  const campaignArg = typeof args.campaign === "string" ? args.campaign : null;
  const allFlag = args.all === true;

  let influencerIds: string[] | null = null;

  if (!allFlag && !campaignArg) {
    const patterns = creatorArg
      ? [new RegExp(creatorArg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")]
      : DEFAULT_CREATOR_PATTERNS;

    const { data: influencers, error: infError } = await supabase
      .from("influencers")
      .select("id, display_name");

    if (infError) throw new Error(infError.message);

    const matched = (influencers ?? []).filter((inf) =>
      patterns.some((p) => p.test(inf.display_name))
    );

    if (matched.length === 0) {
      console.log("No matching creators found.");
      return;
    }

    console.log(`Matched creators: ${matched.map((m) => m.display_name).join(", ")}`);
    influencerIds = matched.map((m) => m.id);
  } else if (allFlag) {
    console.log("Mode: --all (all publications with content_url)");
  } else if (campaignArg) {
    console.log(`Mode: campaign ${campaignArg}`);
  }

  let query = supabase
    .from("campaign_publications")
    .select(
      "id, campaign_header_id, influencer_id, platform, content_url, views, likes, comments, shares, saves, metrics_refresh_status, screenshot_url, thumbnail_url"
    )
    .not("content_url", "is", null);

  if (campaignArg) {
    query = query.eq("campaign_header_id", campaignArg);
  }
  if (influencerIds) {
    query = query.in("influencer_id", influencerIds);
  }

  const { data: publications, error: pubError } = await query;
  if (pubError) throw new Error(pubError.message);

  const rows = (publications ?? []).filter((row) =>
    isIncomplete(snapshotFromRow(row as Record<string, unknown>))
  );

  if (rows.length === 0) {
    console.log("No incomplete publications found.");
    return;
  }

  console.log(`Refreshing ${rows.length} incomplete publication(s)...\n`);

  let refreshed = 0;
  let nullRegressions = 0;
  let screenshotsQueued = 0;

  const influencerNames = new Map<string, string>();
  if (influencerIds?.length) {
    const { data: infs } = await supabase
      .from("influencers")
      .select("id, display_name")
      .in("id", influencerIds);
    for (const inf of infs ?? []) {
      influencerNames.set(inf.id, inf.display_name);
    }
  }

  for (const row of rows) {
    const creator =
      (row.influencer_id ? influencerNames.get(row.influencer_id) : null) ??
      row.influencer_id ??
      "Unknown";
    const before = snapshotFromRow(row as Record<string, unknown>);

    console.log(`--- ${creator} · ${row.platform} · ${row.id}`);
    console.log(`  BEFORE: ${formatSnapshot(before)}`);

    const queueResult = await requestMetricsCollection(supabase, {
      publicationId: row.id,
      campaignHeaderId: row.campaign_header_id,
      triggeredBy: "refresh_affected_creator_metrics",
    });

    let outcomeStatus: string = queueResult.mode;
    if (queueResult.mode === "inline" && queueResult.outcome) {
      outcomeStatus = queueResult.outcome.status;
    }

    if (!before.screenshot_url && !row.thumbnail_url) {
      const shot = await enqueuePublicationScreenshotJob({
        publicationId: row.id,
        campaignHeaderId: row.campaign_header_id,
        triggeredBy: "refresh_affected_creator_metrics",
      });
      if (shot.enqueued) screenshotsQueued += 1;
    }

    if (row.metrics_refresh_status === "partial") {
      await collectPublicationMetricsById(supabase, {
        publicationId: row.id,
        campaignHeaderId: row.campaign_header_id,
        triggeredBy: "refresh_partial_repair",
      });
    }

    const { data: afterRow } = await supabase
      .from("campaign_publications")
      .select(
        "views, likes, comments, shares, saves, metrics_refresh_status, screenshot_url"
      )
      .eq("id", row.id)
      .single();

    const after = snapshotFromRow((afterRow ?? {}) as Record<string, unknown>);
    console.log(`  AFTER:  ${formatSnapshot(after)}`);
    console.log(`  MODE:   ${queueResult.mode} (status: ${outcomeStatus})`);

    const lost = metricsLost(before, after);
    if (lost.length > 0) {
      nullRegressions += 1;
      console.log(`  ⚠ NULL REGRESSION on: ${lost.join(", ")}`);
    } else {
      console.log(`  ✓ No null overwrite`);
    }

    refreshed += 1;
  }

  console.log(
    `\nDone: ${refreshed} refreshed, ${screenshotsQueued} screenshot(s) queued, ${nullRegressions} null regressions.`
  );
  if (nullRegressions > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
