import type { CampaignPerformanceAuditSummary } from "@/lib/performance/campaign-performance-audit";

export type CampaignPerformanceAlertKind =
  | "metrics_regression"
  | "avatar_resolution_failed"
  | "platform_detection_unknown"
  | "screenshot_generation_failed"
  | "missing_metrics";

export type CampaignPerformanceAlert = {
  kind: CampaignPerformanceAlertKind;
  severity: "warning" | "critical";
  count: number;
  message: string;
  samplePublicationIds?: string[];
};

export type CampaignPerformanceMonitorResult = {
  scannedAt: string;
  ok: boolean;
  alerts: CampaignPerformanceAlert[];
  summary: Pick<
    CampaignPerformanceAuditSummary,
    | "totalPublications"
    | "missingAvatarsCount"
    | "missingPreviewScreenshotsCount"
    | "missingMetricsCount"
    | "platformMismatchesCount"
    | "recoverableMetricsCount"
  >;
};

function sampleIds(
  findings: CampaignPerformanceAuditSummary["findings"],
  issue: CampaignPerformanceAuditSummary["findings"][number]["issue"],
  limit = 5
): string[] {
  return findings.filter((f) => f.issue === issue).slice(0, limit).map((f) => f.publication_id);
}

export function buildCampaignPerformanceAlerts(
  audit: CampaignPerformanceAuditSummary
): CampaignPerformanceMonitorResult {
  const alerts: CampaignPerformanceAlert[] = [];

  if (audit.recoverableMetricsCount > 0) {
    alerts.push({
      kind: "metrics_regression",
      severity: "critical",
      count: audit.recoverableMetricsCount,
      message:
        "Publications have fewer stored metrics than their latest successful sync log snapshot (possible null overwrite).",
      samplePublicationIds: sampleIds(audit.findings, "metrics_regression"),
    });
  }

  if (audit.missingAvatarsCount > 0) {
    alerts.push({
      kind: "avatar_resolution_failed",
      severity: "warning",
      count: audit.missingAvatarsCount,
      message: "Creator avatars could not be resolved from profile, metadata, or social accounts.",
      samplePublicationIds: sampleIds(audit.findings, "missing_profile_photo"),
    });
  }

  const unknownPlatformCount = audit.findings.filter(
    (f) => f.issue === "wrong_platform_icon" && /unknown/i.test(f.detail)
  ).length;
  if (audit.platformMismatchesCount > 0) {
    alerts.push({
      kind: "platform_detection_unknown",
      severity: audit.platformMismatchesCount > 5 ? "critical" : "warning",
      count: audit.platformMismatchesCount,
      message:
        "Publication platform field does not match content URL host (may show wrong platform icon).",
      samplePublicationIds: sampleIds(audit.findings, "wrong_platform_icon"),
    });
  }
  if (unknownPlatformCount > 0) {
    alerts.push({
      kind: "platform_detection_unknown",
      severity: "warning",
      count: unknownPlatformCount,
      message: "Platform detection returned unknown for publications with content URLs.",
      samplePublicationIds: sampleIds(audit.findings, "wrong_platform_icon"),
    });
  }

  if (audit.missingPreviewScreenshotsCount > 0) {
    alerts.push({
      kind: "screenshot_generation_failed",
      severity: "warning",
      count: audit.missingPreviewScreenshotsCount,
      message: "Publications are missing screenshot_url and thumbnail_url preview assets.",
      samplePublicationIds: sampleIds(audit.findings, "missing_screenshot"),
    });
  }

  const criticalMissingMetrics = audit.findings.filter(
    (f) => f.issue === "missing_metrics" || f.issue === "completed_without_metrics"
  ).length;
  if (criticalMissingMetrics > 0) {
    alerts.push({
      kind: "missing_metrics",
      severity: "warning",
      count: criticalMissingMetrics,
      message: "Publications with content URLs have no stored engagement metrics.",
      samplePublicationIds: [
        ...sampleIds(audit.findings, "missing_metrics"),
        ...sampleIds(audit.findings, "completed_without_metrics"),
      ].slice(0, 5),
    });
  }

  return {
    scannedAt: audit.scannedAt,
    ok: alerts.filter((a) => a.severity === "critical").length === 0,
    alerts,
    summary: {
      totalPublications: audit.totalPublications,
      missingAvatarsCount: audit.missingAvatarsCount,
      missingPreviewScreenshotsCount: audit.missingPreviewScreenshotsCount,
      missingMetricsCount: audit.missingMetricsCount,
      platformMismatchesCount: audit.platformMismatchesCount,
      recoverableMetricsCount: audit.recoverableMetricsCount,
    },
  };
}

export async function dispatchCampaignPerformanceAlerts(
  result: CampaignPerformanceMonitorResult
): Promise<{ webhookSent: boolean }> {
  const payload = {
    source: "thinkway-campaign-performance-monitor",
    ...result,
  };

  console.info("[campaign-performance-monitor]", JSON.stringify(payload));

  const webhookUrl =
    process.env.CAMPAIGN_PERFORMANCE_ALERT_WEBHOOK?.trim() ||
    process.env.ALERT_WEBHOOK_URL?.trim();

  if (!webhookUrl || result.alerts.length === 0) {
    return { webhookSent: false };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { webhookSent: response.ok };
  } catch (error) {
    console.error(
      "[campaign-performance-monitor] webhook failed",
      error instanceof Error ? error.message : error
    );
    return { webhookSent: false };
  }
}
