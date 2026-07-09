import type { SupabaseClient } from "@supabase/supabase-js";

/** Default 6h — skip repeat Apify acquisition for the same CIP within this window. */
const DEFAULT_CIP_ACQUISITION_COOLDOWN_MS = 6 * 60 * 60 * 1000;

export function getCipAcquisitionCooldownMs(): number {
  const raw = process.env.CIP_ACQUISITION_COOLDOWN_MS?.trim();
  if (!raw) return DEFAULT_CIP_ACQUISITION_COOLDOWN_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_CIP_ACQUISITION_COOLDOWN_MS;
  return parsed;
}

export type CipAcquisitionCooldownResult = {
  skip: boolean;
  reason?: string;
  lastAcquisitionAt?: string;
};

function formatCooldownReason(lastAt: string, cooldownMs: number): string {
  const hours = Math.round(cooldownMs / (60 * 60 * 1000));
  return `Apify skipped — CIP acquisition ran recently (${lastAt}); cooldown ${hours}h.`;
}

/**
 * Skip duplicate Apify runs when the same Campaign Intelligence Profile was
 * acquired recently or still has a pending acquisition job.
 */
export async function checkCipAcquisitionCooldown(
  supabase: SupabaseClient,
  profileId: string | undefined
): Promise<CipAcquisitionCooldownResult> {
  const id = profileId?.trim();
  if (!id) return { skip: false };

  const cooldownMs = getCipAcquisitionCooldownMs();
  if (cooldownMs === 0) return { skip: false };

  const since = new Date(Date.now() - cooldownMs).toISOString();

  const { data: pendingJob } = await supabase
    .from("discovery_jobs")
    .select("id, created_at")
    .in("status", ["pending", "running"])
    .filter("payload->>campaignIntelligenceProfileId", "eq", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pendingJob?.created_at) {
    return {
      skip: true,
      reason: `Apify skipped — acquisition already in progress for this brief (job ${pendingJob.id}).`,
      lastAcquisitionAt: String(pendingJob.created_at),
    };
  }

  const { data: recentAudit } = await supabase
    .from("discovery_coverage_decisions")
    .select("timestamp")
    .eq("apify_executed", true)
    .gte("timestamp", since)
    .filter("search_query->>campaignIntelligenceProfileId", "eq", id)
    .order("timestamp", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentAudit?.timestamp) {
    const lastAt = String(recentAudit.timestamp);
    return {
      skip: true,
      reason: formatCooldownReason(lastAt, cooldownMs),
      lastAcquisitionAt: lastAt,
    };
  }

  return { skip: false };
}
