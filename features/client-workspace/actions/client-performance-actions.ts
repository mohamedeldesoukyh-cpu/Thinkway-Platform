"use server";

import { isUuid } from "@/lib/validation/uuid";
import { clientPerformanceAccess } from "../client-performance-access";
import { loadWorkspaceSettings } from "../load-tab-visibility";

export async function loadClientPerformanceAllowanceAction(token: string) {
  try {
    const { db, workspaceId, campaignId } = await clientPerformanceAccess(token);
    const settings = await loadWorkspaceSettings(db, workspaceId);
    const { count, error } = await db.from("campaign_publications").select("id", { count: "exact", head: true })
      .eq("campaign_header_id", campaignId).in("metrics_refresh_status", ["queued", "collecting", "pending"]);
    if (error) throw error;
    return { ok: true as const, limit: settings.refreshLimit, used: settings.refreshUsed, refreshing: (count ?? 0) > 0, lastRefreshAt: settings.lastRefreshAt,
      coolingDown: Boolean(settings.lastRefreshAt && Date.now() - Date.parse(settings.lastRefreshAt) < 300000) };
  } catch {
    return { ok: false as const, message: "Performance refresh controls are currently unavailable." };
  }
}

export async function refreshClientPerformanceAction(token: string, requestId: string) {
  let reserved = false;
  try {
    if (!isUuid(requestId)) return { ok: false as const, message: "Invalid refresh request.", retryable: false };
    const { db, workspaceId, campaignId, review } = await clientPerformanceAccess(token);
    if (review.status === "superseded") return { ok: false as const, message: "Open the current workspace to refresh metrics.", retryable: false };
    const { isMetricsQueueAvailable, enqueueClientWorkspaceMetrics } = await import("@/lib/performance/metrics-collector/queue");
    if (!isMetricsQueueAvailable()) return { ok: false as const, message: "Metrics refresh is temporarily unavailable. No credit was used.", retryable: false };
    const publicationIds: string[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db.from("campaign_publications").select("id, metrics_refresh_status")
        .eq("campaign_header_id", campaignId).not("content_url", "is", null).order("id").range(offset, offset + 999);
      if (error) throw error;
      if (data.some((row) => ["queued", "collecting"].includes(row.metrics_refresh_status))) {
        return { ok: false as const, message: "A metrics refresh is already running. Please wait for it to finish.", retryable: false };
      }
      publicationIds.push(...data.map((row) => row.id as string));
      if (data.length < 1000) break;
    }
    if (!publicationIds.length) return { ok: false as const, message: "There are no published links to refresh yet. No credit was used.", retryable: false };
    const { data: accepted, error } = await db.rpc("reserve_client_workspace_refresh", {
      p_workspace_id: workspaceId, p_campaign_id: campaignId, p_request_id: requestId,
    });
    if (error) throw error;
    if (!accepted) return { ok: false as const, message: "No refresh credits remain, or a refresh was requested in the last five minutes.", retryable: false };
    reserved = true;
    await enqueueClientWorkspaceMetrics(publicationIds.map((publicationId) => ({ publicationId, campaignHeaderId: campaignId, triggeredBy: "client_workspace" })), requestId);
    const { error: updateError } = await db.from("client_workspace_refresh_requests").update({ status: "queued" }).eq("id", requestId).eq("workspace_id", workspaceId);
    if (updateError) throw updateError;
    return { ok: true as const, message: "Metrics refresh requested. The report will update as collection completes." };
  } catch {
    return { ok: false as const, retryable: reserved, message: reserved
      ? "Your refresh credit is reserved. Retry this request to continue without using another credit."
      : "Could not start the refresh. No credit was used." };
  }
}
