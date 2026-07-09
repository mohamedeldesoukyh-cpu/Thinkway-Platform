import { requirePermission } from "@/lib/auth/permissions-server";
import {
  getDefaultDiscoveryControlSettings,
  getDiscoveryApifyDailyUsage,
  getDiscoveryControlSettings,
} from "@/lib/discovery/control-center/discovery-control-service";
import type { DiscoveryControlSettings } from "@/lib/discovery/control-center/discovery-control-types";
import { isDiscoveryCoverageApifyFallbackEnabled } from "@/lib/creators/discovery-coverage";
import { isInlineDiscoveryBackfillEnabled } from "@/lib/discovery/coverage-backfill";
import { isDiscoveryQueueAvailable } from "@/lib/discovery/queue";
import { getMetricsCollectorEnv } from "@/lib/performance/metrics-collector/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DiscoveryCoverageDecisionRow = {
  id: string;
  search_id: string;
  timestamp: string;
  coverage_score: number;
  coverage_level: string;
  database_creators_count: number;
  apify_executed: boolean;
  reason: string;
  duration_ms: number | null;
};

export type DiscoveryDiagnosticsSnapshot = {
  settings: DiscoveryControlSettings;
  queue: {
    redisConfigured: boolean;
    hint: string;
  };
  apify: {
    fallbackEnabled: boolean;
    inlineBackfillEnabled: boolean;
    tokenConfigured: boolean;
    creditsUsedToday: number;
    requestsUsedToday: number;
  };
  database: {
    activeInfluencers: number;
    discoveredProfiles: number;
    creatorsWithDna: number;
    dnaCompletenessAverage: number | null;
    missingDna: number;
    pendingDiscoveryJobs: number;
  };
  jobs: {
    lastDiscoveryJob: Record<string, unknown> | null;
    lastEnrichmentJob: Record<string, unknown> | null;
  };
  coverageDecisions: DiscoveryCoverageDecisionRow[];
};

export async function getDiscoveryEngineSettings(): Promise<DiscoveryControlSettings> {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "discovery.admin");
  if ("error" in auth) {
    return getDefaultDiscoveryControlSettings();
  }
  return getDiscoveryControlSettings(supabase);
}

export async function getDiscoveryDiagnosticsSnapshot(): Promise<DiscoveryDiagnosticsSnapshot> {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "discovery.admin");
  const settings =
    "error" in auth
      ? getDefaultDiscoveryControlSettings()
      : await getDiscoveryControlSettings(supabase);

  const env = getMetricsCollectorEnv();
  const usage = "error" in auth ? { requestCount: 0, creditsUsed: 0 } : await getDiscoveryApifyDailyUsage(supabase);

  const [
    influencerCount,
    discoveredCount,
    pendingJobs,
    dnaRows,
    lastDiscoveryJob,
    coverageDecisions,
  ] = await Promise.all([
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
    supabase.from("creator_dna").select("dna_completeness_score"),
    supabase
      .from("discovery_jobs")
      .select("id, job_type, status, created_at, completed_at, profiles_discovered")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("discovery_coverage_decisions")
      .select(
        "id, search_id, timestamp, coverage_score, coverage_level, database_creators_count, apify_executed, reason, duration_ms"
      )
      .order("timestamp", { ascending: false })
      .limit(20),
  ]);

  const dnaScores = (dnaRows.data ?? [])
    .map((row) => Number((row as { dna_completeness_score?: number | null }).dna_completeness_score))
    .filter((value) => Number.isFinite(value));
  const dnaAverage =
    dnaScores.length > 0
      ? Math.round(dnaScores.reduce((sum, value) => sum + value, 0) / dnaScores.length)
      : null;
  const activeInfluencers = influencerCount.count ?? 0;
  const creatorsWithDna = dnaScores.length;
  const missingDna = Math.max(0, activeInfluencers - creatorsWithDna);

  return {
    settings,
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
      creditsUsedToday: usage.creditsUsed,
      requestsUsedToday: usage.requestCount,
    },
    database: {
      activeInfluencers,
      discoveredProfiles: discoveredCount.count ?? 0,
      creatorsWithDna,
      dnaCompletenessAverage: dnaAverage,
      missingDna,
      pendingDiscoveryJobs: pendingJobs.count ?? 0,
    },
    jobs: {
      lastDiscoveryJob: (lastDiscoveryJob.data as Record<string, unknown> | null) ?? null,
      lastEnrichmentJob: null,
    },
    coverageDecisions: (coverageDecisions.data ?? []) as DiscoveryCoverageDecisionRow[],
  };
}
