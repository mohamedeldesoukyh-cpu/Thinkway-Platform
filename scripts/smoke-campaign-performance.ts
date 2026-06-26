#!/usr/bin/env node
/**
 * End-to-end smoke test for campaign performance pipeline.
 * Run: npm run smoke:campaign-performance
 */
import "@/lib/performance/script-env-preload";

import { Queue } from "bullmq";

import {
  buildPerformanceReportExcelBuffer,
  loadPerformanceReportDocumentData,
  renderPerformanceReportHtml,
} from "@/lib/performance/report";
import { PUBLICATION_METRICS_QUEUE } from "@/lib/performance/metrics-collector/queue";
import { queuePublicationForMetrics } from "@/lib/performance/metrics-collector/persist";
import { enqueuePublicationMetricsJob } from "@/lib/performance/metrics-collector/queue";
import { createScriptSupabase } from "@/lib/performance/script-env";

const TAG = `SMOKE-${Date.now()}`;
const JOB_TIMEOUT_MS = 120_000;
const POLL_MS = 2_000;

type StepResult = { step: string; ok: boolean; detail: string };
const steps: StepResult[] = [];

function record(step: string, ok: boolean, detail: string) {
  steps.push({ step, ok, detail });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${step}: ${detail}`);
  if (!ok) throw new Error(`${step} — ${detail}`);
}

async function waitForJob(redisUrl: string, jobId: string): Promise<void> {
  const queue = new Queue(PUBLICATION_METRICS_QUEUE, { connection: { url: redisUrl } });
  const deadline = Date.now() + JOB_TIMEOUT_MS;

  try {
    while (Date.now() < deadline) {
      const job = await queue.getJob(jobId);
      if (!job) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        continue;
      }
      const state = await job.getState();
      if (state === "completed") return;
      if (state === "failed") {
        throw new Error(job.failedReason ?? "job failed");
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
    throw new Error("job timeout");
  } finally {
    await queue.close();
  }
}

async function main(): Promise<void> {
  const supabase = createScriptSupabase();
  const redisUrl = process.env.REDIS_URL?.trim();

  console.log(`\n=== Campaign Performance Smoke Test (${TAG}) ===\n`);

  const { data: brand } = await supabase
    .from("brands")
    .select("id, client_id, group_id, currency_code")
    .limit(1)
    .maybeSingle();

  if (!brand) {
    record("Seed brand", false, "No brand found — cannot create temp campaign");
    return;
  }

  const { data: campaign, error: campError } = await supabase
    .from("campaign_headers")
    .insert({
      document_number: `TW-SMOKE-${TAG}`,
      name: `${TAG} Performance Smoke`,
      status: "draft",
      group_id: brand.group_id,
      client_id: brand.client_id,
      brand_id: brand.id,
      currency_code: brand.currency_code ?? "USD",
      metadata: { smoke_test: true, tag: TAG },
    })
    .select("id")
    .single();

  if (campError || !campaign) {
    record("Create temp campaign", false, campError?.message ?? "insert failed");
    return;
  }
  record("Create temp campaign", true, campaign.id);

  const testUrl = "https://www.instagram.com/reel/DBwYpV0xK9a/";
  const { data: publication, error: pubError } = await supabase
    .from("campaign_publications")
    .insert({
      campaign_header_id: campaign.id,
      platform: "instagram",
      publication_type: "reel",
      content_url: testUrl,
      status: "published",
      auto_detected: false,
      detected_by: "smoke_test",
      metrics_refresh_status: "pending",
    })
    .select("id")
    .single();

  if (pubError || !publication) {
    record("Add test publication", false, pubError?.message ?? "insert failed");
    await cleanup(supabase, campaign.id);
    return;
  }
  record("Add test publication", true, publication.id);

  await queuePublicationForMetrics(supabase, {
    publicationId: publication.id,
    campaignHeaderId: campaign.id,
  });

  let jobId: string | undefined;
  if (redisUrl) {
    const enqueued = await enqueuePublicationMetricsJob({
      publicationId: publication.id,
      campaignHeaderId: campaign.id,
      triggeredBy: "smoke_test",
    });
    jobId = enqueued.jobId;
    record("Queue metrics refresh", enqueued.enqueued, jobId ? `jobId=${jobId}` : "enqueue failed");
  } else {
    const { collectPublicationMetricsById } = await import("@/lib/performance/metrics-collector");
    const outcome = await collectPublicationMetricsById(supabase, {
      publicationId: publication.id,
      campaignHeaderId: campaign.id,
      triggeredBy: "smoke_test_inline",
    });
    record("Inline metrics refresh", true, outcome.status);
  }

  if (jobId && redisUrl) {
    try {
      await waitForJob(redisUrl, jobId);
      record("Wait for worker", true, `jobId=${jobId}`);
    } catch (error) {
      record(
        "Wait for worker",
        false,
        error instanceof Error ? error.message : "worker timeout — run discovery-worker locally"
      );
    }
  } else if (redisUrl && !jobId) {
    record("Wait for worker", false, "No job id returned");
  }

  const { data: afterPub } = await supabase
    .from("campaign_publications")
    .select("views, likes, comments, metrics_refresh_status, screenshot_url, thumbnail_url")
    .eq("id", publication.id)
    .single();

  const hasWrite =
    afterPub &&
    (afterPub.metrics_refresh_status !== "pending" ||
      afterPub.views != null ||
      afterPub.likes != null ||
      afterPub.screenshot_url != null);
  record("Verify DB writes", Boolean(hasWrite), JSON.stringify(afterPub ?? {}));

  try {
    const combined = await loadPerformanceReportDocumentData(supabase, campaign.id, "combined");
    const html = renderPerformanceReportHtml(combined);
    record("Generate combined report", html.length > 500, `${html.length} chars HTML`);
  } catch (error) {
    record(
      "Generate combined report",
      false,
      error instanceof Error ? error.message : "report failed"
    );
  }

  try {
    const influencer = await loadPerformanceReportDocumentData(supabase, campaign.id, "influencers");
    const buffer = await buildPerformanceReportExcelBuffer(influencer);
    record("Generate influencer report", buffer.byteLength > 0, `${buffer.byteLength} bytes xlsx`);
  } catch (error) {
    record(
      "Generate influencer report",
      false,
      error instanceof Error ? error.message : "report failed"
    );
  }

  const hasScreenshot = Boolean(afterPub?.screenshot_url || afterPub?.thumbnail_url);
  record("Verify screenshot", hasScreenshot, hasScreenshot ? "present" : "pending — may need worker");

  await cleanup(supabase, campaign.id, publication.id);
  record("Cleanup test records", true, "removed");

  console.log(`\n=== SMOKE TEST: PASS (${steps.length} steps) ===\n`);
}

async function cleanup(
  supabase: ReturnType<typeof createScriptSupabase>,
  campaignId: string,
  publicationId?: string
): Promise<void> {
  if (publicationId) {
    await supabase.from("publication_metric_sync_logs").delete().eq("publication_id", publicationId);
    await supabase.from("campaign_publications").delete().eq("id", publicationId);
  } else {
    await supabase.from("campaign_publications").delete().eq("campaign_header_id", campaignId);
  }
  await supabase.from("campaign_headers").delete().eq("id", campaignId);
}

main().catch((error) => {
  console.error(`\n=== SMOKE TEST: FAIL ===\n${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
