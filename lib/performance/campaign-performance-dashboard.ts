import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";

import { runCampaignPerformanceExtendedAudit } from "@/lib/performance/campaign-performance-audit";
import { getAllCampaignPerformanceQueueStats, totalQueueBacklog } from "@/lib/performance/campaign-performance-queues";

export type CampaignPerformanceDashboard = {
  campaigns: number;
  publications: number;
  synced: number;
  partial: number;
  failed: number;
  screenshotsMissing: number;
  staleMetrics: number;
  queueBacklog: number;
  queues: Array<{
    name: string;
    active: number;
    waiting: number;
    delayed: number;
    failed: number;
  }>;
  lastCronRun: string | null;
  lastAuditRun: string | null;
  timestamp: string;
};

function readLastAuditRun(): string | null {
  const statePath = path.join(process.cwd(), "docs/.campaign-performance-audit-state.json");
  if (existsSync(statePath)) {
    try {
      const parsed = JSON.parse(readFileSync(statePath, "utf8")) as { scannedAt?: string };
      return parsed.scannedAt ?? null;
    } catch {
      return null;
    }
  }

  const auditDoc = path.join(process.cwd(), "docs/CAMPAIGN_PERFORMANCE_FINAL_AUDIT.md");
  if (!existsSync(auditDoc)) return null;
  const content = readFileSync(auditDoc, "utf8");
  const match = content.match(/Generated:\s*(.+)/);
  return match?.[1]?.trim() ?? null;
}

export async function buildCampaignPerformanceDashboard(
  supabase: SupabaseClient
): Promise<CampaignPerformanceDashboard> {
  const [audit, queueStats] = await Promise.all([
    runCampaignPerformanceExtendedAudit(supabase),
    getAllCampaignPerformanceQueueStats(),
  ]);

  const statusCounts = await Promise.all(
    (["completed", "partial", "failed"] as const).map(async (status) => {
      const { count } = await supabase
        .from("campaign_publications")
        .select("id", { count: "exact", head: true })
        .eq("metrics_refresh_status", status);
      return { status, count: count ?? 0 };
    })
  );

  const synced = statusCounts.find((s) => s.status === "completed")?.count ?? 0;
  const partial = statusCounts.find((s) => s.status === "partial")?.count ?? 0;
  const failed = statusCounts.find((s) => s.status === "failed")?.count ?? 0;

  const { data: lastCronPub } = await supabase
    .from("campaign_publications")
    .select("metrics_refresh_attempted_at")
    .not("metrics_refresh_attempted_at", "is", null)
    .order("metrics_refresh_attempted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    campaigns: audit.totalCampaigns,
    publications: audit.totalPublications,
    synced,
    partial,
    failed,
    screenshotsMissing: audit.publicationsMissingScreenshots,
    staleMetrics: audit.staleMetricsCount,
    queueBacklog: totalQueueBacklog(queueStats),
    queues: queueStats.map((q) => ({
      name: q.name,
      active: q.active,
      waiting: q.waiting,
      delayed: q.delayed,
      failed: q.failed,
    })),
    lastCronRun: lastCronPub?.metrics_refresh_attempted_at ?? null,
    lastAuditRun: readLastAuditRun(),
    timestamp: new Date().toISOString(),
  };
}
