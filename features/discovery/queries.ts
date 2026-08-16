import { searchDiscoveredProfiles } from "@/lib/discovery/search";
import {
  mapDiscoveryDatabaseStatsRows,
  type DiscoveryDatabaseStats,
  type DiscoveryDatabaseStatsRpcRow,
} from "@/lib/discovery/database-stats";
import type {
  DiscoveryJobRow,
  DiscoveryJobStats,
  DiscoverySearchFilters,
} from "@/lib/discovery/types";
import { captureException } from "@/lib/observability/error-reporter";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const JOB_SELECT =
  "id, job_type, method, status, payload, result, profiles_discovered, profiles_enriched, error_message, started_at, completed_at, created_by, created_at";

export async function getDiscoverySearch(filters: DiscoverySearchFilters) {
  const supabase = await createSupabaseServerClient();
  return searchDiscoveredProfiles(supabase, filters);
}

export async function getDiscoveryShortlists() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("discovery_shortlists")
      .select("id, name, description, created_at, updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      captureException(error, {
        route: "/discovery/search",
        service: "discovery-search",
        extra: { query: "getDiscoveryShortlists" },
      });
      return [];
    }
    return data ?? [];
  } catch (error) {
    captureException(error, {
      route: "/discovery/search",
      service: "discovery-search",
      extra: { query: "getDiscoveryShortlists" },
    });
    return [];
  }
}

export type ShortlistCampaignOption = {
  id: string;
  name: string;
  document_number: string | null;
};

export async function getCampaignOptionsForShortlist(): Promise<ShortlistCampaignOption[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("campaign_headers")
      .select("id, name, document_number")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      captureException(error, {
        route: "/discovery/search",
        service: "discovery-search",
        extra: { query: "getCampaignOptionsForShortlist" },
      });
      return [];
    }
    return (data as ShortlistCampaignOption[]) ?? [];
  } catch (error) {
    captureException(error, {
      route: "/discovery/search",
      service: "discovery-search",
      extra: { query: "getCampaignOptionsForShortlist" },
    });
    return [];
  }
}

export async function getDiscoveryStats(): Promise<DiscoveryJobStats> {
  const supabase = await createSupabaseServerClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [profiles, runningJobs, shortlists, completedJobs, failedJobs, recentJobs] =
    await Promise.all([
      supabase.from("discovered_profiles").select("id", { count: "exact", head: true }),
      supabase
        .from("discovery_jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", "running"),
      supabase.from("discovery_shortlists").select("id", { count: "exact", head: true }),
      supabase
        .from("discovery_jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed"),
      supabase
        .from("discovery_jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed"),
      supabase
        .from("discovery_jobs")
        .select("profiles_discovered, completed_at")
        .eq("status", "completed")
        .gte("completed_at", todayStart.toISOString()),
    ]);

  const profilesAddedToday = (recentJobs.data ?? []).reduce(
    (sum, row) => sum + Number(row.profiles_discovered ?? 0),
    0
  );

  return {
    profiles: profiles.count ?? 0,
    runningJobs: runningJobs.count ?? 0,
    shortlists: shortlists.count ?? 0,
    completedJobs: completedJobs.count ?? 0,
    failedJobs: failedJobs.count ?? 0,
    profilesAddedToday,
  };
}

export async function getDiscoveryJob(jobId: string): Promise<DiscoveryJobRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("discovery_jobs")
    .select(JOB_SELECT)
    .eq("id", jobId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as DiscoveryJobRow | null) ?? null;
}

const DISCOVERY_CATEGORY_STAT_LIMIT = 8;

export async function getDiscoveryDatabaseStats(): Promise<DiscoveryDatabaseStats> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("get_discovery_database_stats", {
    category_limit: DISCOVERY_CATEGORY_STAT_LIMIT,
  });

  if (!error && data) {
    return mapDiscoveryDatabaseStatsRows(data as DiscoveryDatabaseStatsRpcRow[]);
  }

  const rpcMissing =
    error?.message.includes("get_discovery_database_stats") ||
    error?.code === "PGRST202" ||
    error?.code === "42883";

  if (!rpcMissing) {
    throw new Error(error?.message ?? "Failed to load creator database stats.");
  }

  const { count, error: countError } = await supabase
    .from("influencers")
    .select("id", { count: "exact", head: true })
    .neq("status", "archived");

  if (countError) {
    throw new Error(countError.message);
  }

  return {
    totalCreators: count ?? 0,
    categorizedCreators: 0,
    uncategorizedCreators: count ?? 0,
    topCategories: [],
  };
}

export async function getRecentDiscoveryJobs(limit = 8): Promise<DiscoveryJobRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("discovery_jobs")
    .select(JOB_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data as DiscoveryJobRow[]) ?? [];
}
