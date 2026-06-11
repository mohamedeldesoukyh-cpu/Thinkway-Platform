import { searchDiscoveredProfiles } from "@/lib/discovery/search";
import type {
  DiscoveryJobRow,
  DiscoveryJobStats,
  DiscoverySearchFilters,
} from "@/lib/discovery/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const JOB_SELECT =
  "id, job_type, method, status, payload, result, profiles_discovered, profiles_enriched, error_message, started_at, completed_at, created_by, created_at";

export async function getDiscoverySearch(filters: DiscoverySearchFilters) {
  const supabase = await createSupabaseServerClient();
  return searchDiscoveredProfiles(supabase, filters);
}

export async function getDiscoveryShortlists() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("discovery_shortlists")
    .select("id, name, description, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
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
