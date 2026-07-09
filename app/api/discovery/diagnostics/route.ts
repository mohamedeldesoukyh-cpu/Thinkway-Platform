import { NextResponse } from "next/server";

import { isDiscoveryCoverageApifyFallbackEnabled } from "@/lib/creators/discovery-coverage";
import {
  buildCoverageBackfillJobPayloadFromBrowseFilters,
  browseFiltersHaveBackfillIntent,
  isInlineDiscoveryBackfillEnabled,
} from "@/lib/discovery/coverage-backfill";
import {
  getDiscoveryApifyDailyUsage,
  getDiscoveryControlSettings,
} from "@/lib/discovery/control-center/discovery-control-service";
import { isDiscoveryQueueAvailable } from "@/lib/discovery/queue";
import { getMetricsCollectorEnv } from "@/lib/performance/metrics-collector/config";
import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "discovery.admin");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 403 });
  }

  const settings = await getDiscoveryControlSettings(supabase);
  const usage = await getDiscoveryApifyDailyUsage(supabase);
  const env = getMetricsCollectorEnv();
  const samplePayload = buildCoverageBackfillJobPayloadFromBrowseFilters({
    search: "adidas running sportswear",
    country: "EG",
    categories: ["Sports", "Fitness"],
    platforms: ["instagram"],
    page: 1,
    pageSize: 20,
  });

  const [{ count: influencerCount }, { count: discoveredCount }, { count: pendingJobs }] =
    await Promise.all([
      supabase
        .from("influencers")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      supabase
        .from("discovered_profiles")
        .select("id", { count: "exact", head: true })
        .is("influencer_id", null),
      supabase
        .from("discovery_jobs")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "running"]),
    ]);

  return NextResponse.json({
    controlCenter: settings,
    queue: {
      redisConfigured: isDiscoveryQueueAvailable(),
      hint: isDiscoveryQueueAvailable()
        ? "Run npm run discovery:worker:dev to process backfill jobs."
        : "Set REDIS_URL and start discovery-worker, or enable DISCOVERY_INLINE_BACKFILL with APIFY_TOKEN.",
    },
    apify: {
      fallbackEnabled: isDiscoveryCoverageApifyFallbackEnabled(settings),
      inlineBackfillEnabled: isInlineDiscoveryBackfillEnabled(),
      tokenConfigured: Boolean(env.apifyToken),
      instagramActor: env.apifyInstagramActorId,
      tiktokActor: env.apifyTikTokActorId,
      requestsUsedToday: usage.requestCount,
      creditsUsedToday: usage.creditsUsed,
    },
    database: {
      activeInfluencers: influencerCount ?? 0,
      discoveredProfiles: discoveredCount ?? 0,
      pendingDiscoveryJobs: pendingJobs ?? 0,
    },
    sampleBackfillPayload: samplePayload,
    browseBackfillIntentExample: browseFiltersHaveBackfillIntent({
      search: "adidas",
      country: "EG",
      categories: ["Sports"],
    }),
  });
}
