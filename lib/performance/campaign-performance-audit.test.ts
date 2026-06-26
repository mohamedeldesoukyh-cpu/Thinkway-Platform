import assert from "node:assert/strict";

import { buildCampaignPerformanceAlerts } from "@/lib/performance/campaign-performance-monitoring";
import {
  buildAuditVerdict,
  filterFindingsByCreator,
  type CampaignPerformanceAuditSummary,
  type CampaignPerformanceExtendedAudit,
} from "@/lib/performance/campaign-performance-audit";

const baseAudit: CampaignPerformanceAuditSummary = {
  scannedAt: new Date().toISOString(),
  totalPublications: 10,
  missingAvatarsCount: 2,
  missingPreviewScreenshotsCount: 1,
  missingMetricsCount: 3,
  platformMismatchesCount: 1,
  recoverableMetricsCount: 1,
  findings: [
    {
      publication_id: "pub-1",
      campaign_header_id: "camp-1",
      creator: "Shimaa Saber",
      platform: "instagram",
      issue: "metrics_regression",
      detail: "regression",
      recoverable: { views: 1000 },
    },
    {
      publication_id: "pub-2",
      campaign_header_id: "camp-1",
      creator: "Hussein",
      platform: "tiktok",
      issue: "missing_profile_photo",
      detail: "no avatar",
    },
    {
      publication_id: "pub-3",
      campaign_header_id: "camp-1",
      creator: "Creator",
      platform: "tiktok",
      issue: "wrong_platform_icon",
      detail: "mismatch",
    },
    {
      publication_id: "pub-4",
      campaign_header_id: "camp-1",
      creator: "Creator",
      platform: "instagram",
      issue: "missing_screenshot",
      detail: "no preview",
    },
    {
      publication_id: "pub-5",
      campaign_header_id: "camp-1",
      creator: "Creator",
      platform: "instagram",
      issue: "missing_metrics",
      detail: "empty",
    },
  ],
};

{
  const monitor = buildCampaignPerformanceAlerts(baseAudit);
  assert.equal(monitor.summary.totalPublications, 10);
  assert.equal(monitor.summary.recoverableMetricsCount, 1);
  assert.equal(monitor.ok, false);
  assert.ok(monitor.alerts.some((a) => a.kind === "metrics_regression"));
  assert.ok(monitor.alerts.some((a) => a.kind === "avatar_resolution_failed"));
  assert.ok(monitor.alerts.some((a) => a.kind === "screenshot_generation_failed"));
}

{
  const clean = buildCampaignPerformanceAlerts({
    ...baseAudit,
    missingAvatarsCount: 0,
    missingPreviewScreenshotsCount: 0,
    missingMetricsCount: 0,
    platformMismatchesCount: 0,
    recoverableMetricsCount: 0,
    findings: [],
  });
  assert.equal(clean.ok, true);
  assert.equal(clean.alerts.length, 0);
}

{
  const extended: CampaignPerformanceExtendedAudit = {
    ...baseAudit,
    totalCampaigns: 5,
    campaignsWithPublications: 4,
    publicationsMissingMetrics: baseAudit.missingMetricsCount,
    publicationsMissingScreenshots: baseAudit.missingPreviewScreenshotsCount,
    creatorsMissingAvatars: baseAudit.missingAvatarsCount,
    staleMetricsCount: 0,
    failedSyncJobsCount: 0,
    queueBacklog: 0,
    orphanMetricsRows: 0,
    orphanScreenshots: 0,
    reportGenerationFailures: 0,
    queueStats: [],
  };
  const verdict = buildAuditVerdict(extended);
  assert.equal(verdict.verdict, "FAIL");
}

{
  const shimaaOnly = filterFindingsByCreator(baseAudit.findings, /shimaa/i);
  assert.equal(shimaaOnly.length, 1);
  assert.equal(shimaaOnly[0]?.creator, "Shimaa Saber");
  assert.equal(filterFindingsByCreator(baseAudit.findings, /nobody/i).length, 0);
}

{
  const warnAudit: CampaignPerformanceExtendedAudit = {
    ...baseAudit,
    recoverableMetricsCount: 0,
    missingMetricsCount: 2,
    missingPreviewScreenshotsCount: 1,
    missingAvatarsCount: 1,
    platformMismatchesCount: 0,
    findings: baseAudit.findings.filter((f) => f.issue !== "metrics_regression"),
    totalCampaigns: 5,
    campaignsWithPublications: 4,
    publicationsMissingMetrics: 2,
    publicationsMissingScreenshots: 1,
    creatorsMissingAvatars: 1,
    staleMetricsCount: 0,
    failedSyncJobsCount: 0,
    queueBacklog: 0,
    orphanMetricsRows: 0,
    orphanScreenshots: 0,
    reportGenerationFailures: 0,
    queueStats: [],
  };
  const verdict = buildAuditVerdict(warnAudit);
  assert.equal(verdict.verdict, "WARN");
  assert.equal(verdict.failReasons.length, 0);
  assert.ok(verdict.warnReasons.length > 0);
}

{
  const passAudit: CampaignPerformanceExtendedAudit = {
    ...baseAudit,
    missingAvatarsCount: 0,
    missingPreviewScreenshotsCount: 0,
    missingMetricsCount: 0,
    platformMismatchesCount: 0,
    recoverableMetricsCount: 0,
    findings: [],
    totalCampaigns: 1,
    campaignsWithPublications: 1,
    publicationsMissingMetrics: 0,
    publicationsMissingScreenshots: 0,
    creatorsMissingAvatars: 0,
    staleMetricsCount: 0,
    failedSyncJobsCount: 0,
    queueBacklog: 0,
    orphanMetricsRows: 0,
    orphanScreenshots: 0,
    reportGenerationFailures: 0,
    queueStats: [],
  };
  assert.equal(buildAuditVerdict(passAudit).verdict, "PASS");
}

console.log("campaign-performance-audit tests passed");
