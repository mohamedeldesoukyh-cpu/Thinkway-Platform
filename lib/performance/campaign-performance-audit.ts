import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveCreatorAvatarUrl } from "@/lib/performance/creator-avatar";
import { normalizePublicationPlatform } from "@/lib/performance/metrics-collector/detect-platform";
import {
  mergeCollectedMetrics,
  storedMetricsFromPublication,
} from "@/lib/performance/metrics-collector/merge-metrics";
import { PLATFORM_ICON_STYLES } from "@/lib/performance/platform-icon";
import type {
  AuditVerdict,
  AuditVerdictResult,
} from "@/lib/domains/audit/types";

export type {
  AuditVerdict,
  AuditVerdictResult,
} from "@/lib/domains/audit/types";

export type CampaignPerformanceAuditPublication = {
  id: string;
  campaign_header_id: string;
  influencer_id: string | null;
  platform: string;
  content_url: string | null;
  thumbnail_url: string | null;
  screenshot_url: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  metrics_refresh_status: string | null;
  metrics_provider: string | null;
  updated_at: string | null;
};

export type CampaignPerformanceAuditFinding = {
  publication_id: string;
  campaign_header_id: string;
  creator: string;
  platform: string;
  issue:
    | "missing_screenshot"
    | "missing_profile_photo"
    | "wrong_platform_icon"
    | "metrics_regression"
    | "missing_metrics"
    | "completed_without_metrics";
  detail: string;
  recoverable?: Record<string, number>;
};

export type CampaignPerformanceAuditSummary = {
  scannedAt: string;
  totalPublications: number;
  missingAvatarsCount: number;
  missingPreviewScreenshotsCount: number;
  missingMetricsCount: number;
  platformMismatchesCount: number;
  recoverableMetricsCount: number;
  findings: CampaignPerformanceAuditFinding[];
};

export type CampaignPerformanceExtendedAudit = CampaignPerformanceAuditSummary & {
  totalCampaigns: number;
  campaignsWithPublications: number;
  publicationsMissingMetrics: number;
  publicationsMissingScreenshots: number;
  creatorsMissingAvatars: number;
  staleMetricsCount: number;
  failedSyncJobsCount: number;
  queueBacklog: number;
  orphanMetricsRows: number;
  orphanScreenshots: number;
  reportGenerationFailures: number;
  queueStats: import("@/lib/performance/campaign-performance-queues").QueueStats[];
};

export type MetricsIntegrityFinding = {
  publication_id: string;
  campaign_header_id: string;
  issue: string;
  detail: string;
};

export type ScreenshotAuditFinding = {
  publication_id: string;
  campaign_header_id: string;
  issue: "missing_url" | "broken_url" | "zero_size" | "inaccessible";
  detail: string;
  screenshot_url: string | null;
};

const STALE_METRICS_HOURS = 24;
const REPORT_SAMPLE_LIMIT = 25;

type SyncLogRow = {
  publication_id: string;
  metrics_snapshot: Record<string, unknown> | null;
  created_at: string;
  provider: string;
  status: string;
};

type InfluencerMeta = {
  display_name: string;
  profile_id: string | null;
  metadata: Record<string, unknown> | null;
};

function hostPlatform(url: string | null): string | null {
  if (!url) return null;
  try {
    const host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname.toLowerCase();
    if (host.includes("instagram")) return "instagram";
    if (host.includes("tiktok")) return "tiktok";
    if (host.includes("youtube") || host.includes("youtu.be")) return "youtube";
    if (host.includes("facebook") || host.includes("fb.")) return "facebook";
    if (host.includes("snapchat")) return "snapchat";
  } catch {
    return null;
  }
  return null;
}

function metricCount(row: CampaignPerformanceAuditPublication): number {
  return [row.views, row.likes, row.comments, row.shares, row.saves].filter(
    (v) => v != null && v > 0
  ).length;
}

function snapshotMetricCount(snapshot: Record<string, unknown> | null): number {
  if (!snapshot) return 0;
  const stored = storedMetricsFromPublication(snapshot);
  return [stored.views, stored.likes, stored.comments, stored.shares, stored.saves].filter(
    (v) => v != null && v > 0
  ).length;
}

export async function runCampaignPerformanceAudit(
  supabase: SupabaseClient
): Promise<CampaignPerformanceAuditSummary> {
  const { data: publications, error } = await supabase
    .from("campaign_publications")
    .select(
      "id, campaign_header_id, influencer_id, platform, content_url, thumbnail_url, screenshot_url, views, likes, comments, shares, saves, metrics_refresh_status, metrics_provider, updated_at"
    )
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = (publications ?? []) as CampaignPerformanceAuditPublication[];
  const influencerIds = [
    ...new Set(rows.map((r) => r.influencer_id).filter((id): id is string => id != null)),
  ];

  const influencerById = new Map<string, InfluencerMeta>();
  const profileImageByProfileId = new Map<string, string | null>();
  const platformPictures = new Map<string, string | null>();

  if (influencerIds.length > 0) {
    const { data: influencers } = await supabase
      .from("influencers")
      .select("id, display_name, profile_id, metadata")
      .in("id", influencerIds);

    for (const row of influencers ?? []) {
      influencerById.set(row.id, {
        display_name: row.display_name,
        profile_id: row.profile_id,
        metadata: row.metadata as Record<string, unknown> | null,
      });
    }

    const profileIds = (influencers ?? [])
      .map((r) => r.profile_id)
      .filter((id): id is string => id != null);

    if (profileIds.length > 0) {
      const { data: profiles } = await supabase
        .from("discovered_profiles")
        .select("id, profile_image_url")
        .in("id", profileIds);
      for (const profile of profiles ?? []) {
        profileImageByProfileId.set(profile.id, profile.profile_image_url);
      }
    }

    const { data: accounts } = await supabase
      .from("influencer_platform_accounts")
      .select("influencer_id, platform, profile_picture_url")
      .in("influencer_id", influencerIds);

    for (const account of accounts ?? []) {
      platformPictures.set(
        `${account.influencer_id}:${account.platform ?? ""}`,
        account.profile_picture_url
      );
    }
  }

  const publicationIds = rows.map((r) => r.id);
  const latestSnapshots = new Map<string, SyncLogRow>();

  if (publicationIds.length > 0) {
    const { data: logs } = await supabase
      .from("publication_metric_sync_logs")
      .select("publication_id, metrics_snapshot, created_at, provider, status")
      .in("publication_id", publicationIds)
      .eq("status", "success")
      .order("created_at", { ascending: false });

    for (const log of (logs ?? []) as SyncLogRow[]) {
      if (!latestSnapshots.has(log.publication_id)) {
        latestSnapshots.set(log.publication_id, log);
      }
    }
  }

  const findings: CampaignPerformanceAuditFinding[] = [];
  let missingScreenshots = 0;
  let missingProfilePhotos = 0;
  let missingMetrics = 0;
  let metricRegressions = 0;
  let wrongPlatformIcons = 0;

  for (const row of rows) {
    const influencer = row.influencer_id ? influencerById.get(row.influencer_id) : undefined;
    const creator = influencer?.display_name ?? row.influencer_id ?? "Unknown";
    const metadata = influencer?.metadata;
    const profileImage =
      (influencer?.profile_id
        ? profileImageByProfileId.get(influencer.profile_id)
        : null) ??
      (typeof metadata?.profile_image_url === "string" ? metadata.profile_image_url : null);
    const avatarUrl = typeof metadata?.avatar_url === "string" ? metadata.avatar_url : null;
    const socialPicture =
      platformPictures.get(`${row.influencer_id}:${row.platform}`) ??
      platformPictures.get(`${row.influencer_id}:`) ??
      null;

    const creatorAvatar = resolveCreatorAvatarUrl({
      creator_profile_image_url: profileImage,
      influencer_avatar_url: avatarUrl,
      social_profile_picture_url: socialPicture,
    });

    if (!row.screenshot_url && !row.thumbnail_url) {
      missingScreenshots += 1;
      findings.push({
        publication_id: row.id,
        campaign_header_id: row.campaign_header_id,
        creator,
        platform: row.platform,
        issue: "missing_screenshot",
        detail: "No screenshot_url or thumbnail_url stored.",
      });
    }

    if (!creatorAvatar) {
      missingProfilePhotos += 1;
      findings.push({
        publication_id: row.id,
        campaign_header_id: row.campaign_header_id,
        creator,
        platform: row.platform,
        issue: "missing_profile_photo",
        detail: "No creator profile image, avatar, or social account picture found.",
      });
    }

    const urlPlatform = hostPlatform(row.content_url);
    const rowPlatform = normalizePublicationPlatform(row.platform);
    if (
      urlPlatform &&
      rowPlatform &&
      urlPlatform !== rowPlatform &&
      PLATFORM_ICON_STYLES[rowPlatform]
    ) {
      wrongPlatformIcons += 1;
      findings.push({
        publication_id: row.id,
        campaign_header_id: row.campaign_header_id,
        creator,
        platform: row.platform,
        issue: "wrong_platform_icon",
        detail: `Publication platform=${row.platform} but content URL host implies ${urlPlatform}.`,
      });
    }

    const currentMetrics = metricCount(row);
    if (currentMetrics === 0 && row.content_url) {
      missingMetrics += 1;
      findings.push({
        publication_id: row.id,
        campaign_header_id: row.campaign_header_id,
        creator,
        platform: row.platform,
        issue: "missing_metrics",
        detail: "No views, likes, comments, shares, or saves stored.",
      });
    }

    const snapshot = latestSnapshots.get(row.id)?.metrics_snapshot ?? null;
    const snapshotMetrics = snapshotMetricCount(snapshot);

    if (snapshotMetrics > currentMetrics && snapshot) {
      const stored = storedMetricsFromPublication(snapshot);
      const recoverable: Record<string, number> = {};
      for (const key of ["views", "likes", "comments", "shares", "saves"] as const) {
        const current = row[key];
        const fromLog = stored[key];
        if ((current == null || current === 0) && fromLog != null && fromLog > 0) {
          recoverable[key] = fromLog;
        }
      }

      if (Object.keys(recoverable).length > 0) {
        metricRegressions += 1;
        findings.push({
          publication_id: row.id,
          campaign_header_id: row.campaign_header_id,
          creator,
          platform: row.platform,
          issue: "metrics_regression",
          detail: `Stored metrics (${currentMetrics} fields) are lower than latest sync log (${snapshotMetrics} fields).`,
          recoverable,
        });
      }
    }

    if (
      row.metrics_refresh_status === "completed" &&
      currentMetrics === 0 &&
      row.content_url?.includes("instagram.com")
    ) {
      findings.push({
        publication_id: row.id,
        campaign_header_id: row.campaign_header_id,
        creator,
        platform: row.platform,
        issue: "completed_without_metrics",
        detail: "Metrics refresh marked completed but views/likes/comments/shares are all empty.",
      });
    }
  }

  return {
    scannedAt: new Date().toISOString(),
    totalPublications: rows.length,
    missingAvatarsCount: missingProfilePhotos,
    missingPreviewScreenshotsCount: missingScreenshots,
    missingMetricsCount: missingMetrics,
    platformMismatchesCount: wrongPlatformIcons,
    recoverableMetricsCount: metricRegressions,
    findings,
  };
}

export function filterFindingsByCreator(
  findings: CampaignPerformanceAuditFinding[],
  pattern: RegExp
): CampaignPerformanceAuditFinding[] {
  return findings.filter((f) => pattern.test(f.creator));
}

function hoursSince(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  return ms / (1000 * 60 * 60);
}

export function buildAuditVerdict(audit: CampaignPerformanceExtendedAudit): AuditVerdictResult {
  const failReasons: string[] = [];
  const warnReasons: string[] = [];

  if (audit.recoverableMetricsCount > 0) {
    failReasons.push(`${audit.recoverableMetricsCount} metrics regression(s) detected`);
  }
  if (audit.failedSyncJobsCount > 0) {
    failReasons.push(`${audit.failedSyncJobsCount} failed sync job(s) in last 7 days`);
  }
  if (audit.queueStats.some((q) => q.failed > 0)) {
    failReasons.push("One or more queues have failed jobs");
  }
  if (audit.queueStats.some((q) => q.waiting > 1000)) {
    failReasons.push("Queue waiting backlog exceeds 1000");
  }
  if (audit.reportGenerationFailures > 0) {
    failReasons.push(`${audit.reportGenerationFailures} campaign report(s) failed to generate`);
  }
  if (audit.orphanMetricsRows > 0) {
    failReasons.push(`${audit.orphanMetricsRows} orphan metrics sync log row(s)`);
  }

  if (audit.missingMetricsCount > 0) {
    warnReasons.push(`${audit.missingMetricsCount} publication(s) missing metrics`);
  }
  if (audit.missingPreviewScreenshotsCount > 0) {
    warnReasons.push(`${audit.missingPreviewScreenshotsCount} publication(s) missing screenshots`);
  }
  if (audit.missingAvatarsCount > 0) {
    warnReasons.push(`${audit.missingAvatarsCount} creator(s) missing avatars`);
  }
  if (audit.staleMetricsCount > 0) {
    warnReasons.push(`${audit.staleMetricsCount} publication(s) with stale metrics (>24h)`);
  }
  if (audit.platformMismatchesCount > 0) {
    warnReasons.push(`${audit.platformMismatchesCount} platform mismatch(es)`);
  }
  if (audit.orphanScreenshots > 0) {
    warnReasons.push(`${audit.orphanScreenshots} orphan screenshot reference(s)`);
  }

  let verdict: AuditVerdict = "PASS";
  if (failReasons.length > 0) verdict = "FAIL";
  else if (warnReasons.length > 0) verdict = "WARN";

  return { verdict, failReasons, warnReasons };
}

async function countOrphanMetricsRows(supabase: SupabaseClient): Promise<number> {
  const { data: logs, error } = await supabase
    .from("publication_metric_sync_logs")
    .select("publication_id")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error || !logs?.length) return 0;

  const pubIds = [...new Set(logs.map((l) => l.publication_id))];
  const { data: pubs } = await supabase
    .from("campaign_publications")
    .select("id")
    .in("id", pubIds);

  const existing = new Set((pubs ?? []).map((p) => p.id));
  return pubIds.filter((id) => !existing.has(id)).length;
}

async function countFailedSyncJobs(supabase: SupabaseClient): Promise<number> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("publication_metric_sync_logs")
    .select("id", { count: "exact", head: true })
    .eq("status", "failed")
    .gte("created_at", since);

  if (error) return 0;
  return count ?? 0;
}

async function countReportGenerationFailures(supabase: SupabaseClient): Promise<number> {
  const { loadPerformanceReportDocumentData } = await import(
    "@/lib/performance/report/performance-report-document-data"
  );

  const { data: campaigns } = await supabase
    .from("campaign_headers")
    .select("id")
    .order("updated_at", { ascending: false })
    .limit(REPORT_SAMPLE_LIMIT);

  if (!campaigns?.length) return 0;

  let failures = 0;
  for (const campaign of campaigns) {
    try {
      await loadPerformanceReportDocumentData(supabase, campaign.id, "combined");
      await loadPerformanceReportDocumentData(supabase, campaign.id, "influencers");
    } catch {
      failures += 1;
    }
  }
  return failures;
}

export async function runCampaignPerformanceExtendedAudit(
  supabase: SupabaseClient
): Promise<CampaignPerformanceExtendedAudit> {
  const { getAllCampaignPerformanceQueueStats, totalQueueBacklog } = await import(
    "@/lib/performance/campaign-performance-queues"
  );

  const base = await runCampaignPerformanceAudit(supabase);
  const queueStats = await getAllCampaignPerformanceQueueStats();

  const { count: totalCampaigns } = await supabase
    .from("campaign_headers")
    .select("id", { count: "exact", head: true });

  const { data: campaignPubCounts } = await supabase
    .from("campaign_publications")
    .select("campaign_header_id");

  const campaignsWithPublications = new Set(
    (campaignPubCounts ?? []).map((r) => r.campaign_header_id)
  ).size;

  const staleMetricsCount = base.findings.filter((f) => {
    if (f.issue !== "missing_metrics" && f.issue !== "completed_without_metrics") return false;
    return true;
  }).length;

  const { data: staleRows } = await supabase
    .from("campaign_publications")
    .select("id, last_synced_at, updated_at, metrics_refresh_status")
    .not("content_url", "is", null)
    .in("metrics_refresh_status", ["completed", "partial"]);

  let staleFromTimestamp = 0;
  for (const row of staleRows ?? []) {
    const ref = row.last_synced_at ?? row.updated_at;
    const hours = hoursSince(ref);
    if (hours != null && hours > STALE_METRICS_HOURS) staleFromTimestamp += 1;
  }

  const [orphanMetricsRows, failedSyncJobsCount, reportGenerationFailures] = await Promise.all([
    countOrphanMetricsRows(supabase),
    countFailedSyncJobs(supabase),
    countReportGenerationFailures(supabase),
  ]);

  const orphanScreenshots = base.findings.filter((f) => f.issue === "missing_screenshot").length;

  return {
    ...base,
    totalCampaigns: totalCampaigns ?? 0,
    campaignsWithPublications,
    publicationsMissingMetrics: base.missingMetricsCount,
    publicationsMissingScreenshots: base.missingPreviewScreenshotsCount,
    creatorsMissingAvatars: base.missingAvatarsCount,
    staleMetricsCount: Math.max(staleMetricsCount, staleFromTimestamp),
    failedSyncJobsCount,
    queueBacklog: totalQueueBacklog(queueStats),
    orphanMetricsRows,
    orphanScreenshots,
    reportGenerationFailures,
    queueStats,
  };
}

export async function auditMetricsIntegrity(
  supabase: SupabaseClient
): Promise<MetricsIntegrityFinding[]> {
  const { data: rows, error } = await supabase
    .from("campaign_publications")
    .select(
      "id, campaign_header_id, views, likes, comments, shares, saves, engagements, engagement_rate"
    )
    .not("content_url", "is", null);

  if (error) throw new Error(error.message);

  const findings: MetricsIntegrityFinding[] = [];

  for (const row of rows ?? []) {
    const nums = [row.views, row.likes, row.comments, row.shares, row.saves];
    for (const [key, value] of Object.entries({
      views: row.views,
      likes: row.likes,
      comments: row.comments,
      shares: row.shares,
      saves: row.saves,
    })) {
      if (value != null && (value < 0 || !Number.isFinite(Number(value)))) {
        findings.push({
          publication_id: row.id,
          campaign_header_id: row.campaign_header_id,
          issue: "negative_metric",
          detail: `${key}=${value} is negative or invalid`,
        });
      }
    }

    const likes = row.likes ?? 0;
    const comments = row.comments ?? 0;
    const engagements = row.engagements;
    if (engagements != null && engagements < likes + comments) {
      findings.push({
        publication_id: row.id,
        campaign_header_id: row.campaign_header_id,
        issue: "engagements_below_sum",
        detail: `engagements=${engagements} < likes+comments=${likes + comments}`,
      });
    }

    const er = row.engagement_rate;
    if (er != null && (er < 0 || er > 100)) {
      findings.push({
        publication_id: row.id,
        campaign_header_id: row.campaign_header_id,
        issue: "er_out_of_range",
        detail: `engagement_rate=${er} outside 0-100%`,
      });
    }

    const hasAnyMetric = nums.some((v) => v != null && v > 0);
    if (hasAnyMetric && er != null && er > 50) {
      findings.push({
        publication_id: row.id,
        campaign_header_id: row.campaign_header_id,
        issue: "er_anomaly",
        detail: `engagement_rate=${er}% unusually high (>50%)`,
      });
    }
  }

  return findings;
}

async function probeScreenshotUrl(
  supabase: SupabaseClient,
  storedValue: string
): Promise<{ ok: boolean; issue?: ScreenshotAuditFinding["issue"]; detail?: string }> {
  if (!storedValue?.trim()) {
    return { ok: false, issue: "missing_url", detail: "No screenshot_url or thumbnail_url" };
  }

  const { createPublicationMediaSignedUrl } = await import(
    "@/lib/performance/screenshot-capture/storage"
  );
  const resolved =
    storedValue.includes("://") ? storedValue : await createPublicationMediaSignedUrl(supabase, storedValue);

  if (!resolved) {
    return { ok: false, issue: "broken_url", detail: "Could not resolve storage path to URL" };
  }

  try {
    const response = await fetch(resolved, { method: "HEAD", signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      return {
        ok: false,
        issue: "inaccessible",
        detail: `HTTP ${response.status} for screenshot URL`,
      };
    }
    const length = Number(response.headers.get("content-length") ?? "0");
    if (length === 0) {
      return { ok: false, issue: "zero_size", detail: "Content-Length is 0" };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      issue: "inaccessible",
      detail: error instanceof Error ? error.message : "Fetch failed",
    };
  }
}

export async function auditScreenshots(
  supabase: SupabaseClient,
  options?: { limit?: number; probeRemote?: boolean }
): Promise<ScreenshotAuditFinding[]> {
  const limit = options?.limit ?? 500;
  const probeRemote = options?.probeRemote ?? true;

  const { data: rows, error } = await supabase
    .from("campaign_publications")
    .select("id, campaign_header_id, screenshot_url, thumbnail_url, content_url")
    .not("content_url", "is", null)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  const findings: ScreenshotAuditFinding[] = [];

  for (const row of rows ?? []) {
    const stored = row.screenshot_url ?? row.thumbnail_url;
    if (!stored) {
      findings.push({
        publication_id: row.id,
        campaign_header_id: row.campaign_header_id,
        issue: "missing_url",
        detail: "No screenshot_url or thumbnail_url",
        screenshot_url: null,
      });
      continue;
    }

    if (!probeRemote) continue;

    const probe = await probeScreenshotUrl(supabase, stored);
    if (!probe.ok && probe.issue) {
      findings.push({
        publication_id: row.id,
        campaign_header_id: row.campaign_header_id,
        issue: probe.issue,
        detail: probe.detail ?? probe.issue,
        screenshot_url: stored,
      });
    }
  }

  return findings;
}

export async function requeueFailedScreenshots(
  supabase: SupabaseClient,
  publicationIds: string[]
): Promise<{ enqueued: number }> {
  if (publicationIds.length === 0) return { enqueued: 0 };

  const { enqueuePublicationScreenshotJob } = await import(
    "@/lib/performance/screenshot-capture/queue"
  );

  const { data: rows } = await supabase
    .from("campaign_publications")
    .select("id, campaign_header_id")
    .in("id", publicationIds);

  let enqueued = 0;
  for (const row of rows ?? []) {
    const result = await enqueuePublicationScreenshotJob({
      publicationId: row.id,
      campaignHeaderId: row.campaign_header_id,
      triggeredBy: "screenshot_audit_requeue",
    });
    if (result.enqueued) enqueued += 1;
  }
  return { enqueued };
}
