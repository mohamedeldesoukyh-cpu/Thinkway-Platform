import type { DiscoveryJobOutcome, DiscoveryJobRow, DiscoveryJobStatus } from "@/lib/discovery/types";

export type JobFeedbackTone = "neutral" | "success" | "warning" | "error" | "info";

export function jobStatusLabel(status: DiscoveryJobStatus): string {
  switch (status) {
    case "pending":
      return "Queued";
    case "running":
      return "Crawling";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export function jobOutcomeLabel(outcome: DiscoveryJobOutcome | undefined): string {
  switch (outcome) {
    case "crawl_success":
      return "Live crawl succeeded";
    case "seeded_fallback":
      return "Sample creators loaded (crawl empty)";
    case "partial_success":
      return "Partial success — sample creators used";
    case "crawl_blocked":
      return "Crawl blocked";
    case "empty":
      return "No creators found";
    default:
      return "Processing";
  }
}

export function jobFeedbackTone(job: DiscoveryJobRow): JobFeedbackTone {
  if (job.status === "failed") return "error";
  if (job.status === "running" || job.status === "pending") return "info";
  const outcome = job.result?.outcome;
  if (outcome === "crawl_success") return "success";
  if (outcome === "partial_success" || outcome === "seeded_fallback") return "warning";
  if (outcome === "crawl_blocked" || outcome === "empty") return "error";
  return "success";
}

export function jobSummaryMessage(job: DiscoveryJobRow): string {
  const result = job.result;
  const added = result?.profiles_added ?? job.profiles_discovered ?? 0;
  const live = result?.crawl_discovered ?? 0;

  if (job.status === "pending") return "Crawl queued — waiting for worker…";
  if (job.status === "running") return "Crawl in progress…";

  if (job.status === "failed") {
    return job.error_message ?? "Crawl failed before profiles could be added.";
  }

  if (result?.outcome === "crawl_success") {
    return `Crawl completed — ${added} creator${added === 1 ? "" : "s"} found from live sources.`;
  }
  if (result?.outcome === "seeded_fallback") {
    return `Crawl returned empty — loaded ${added} sample creator${added === 1 ? "" : "s"} for testing.`;
  }
  if (result?.outcome === "partial_success") {
    return `Live crawl failed — loaded ${added} sample creator${added === 1 ? "" : "s"} as fallback.`;
  }
  if (result?.outcome === "crawl_blocked") {
    return result.crawl_error ?? job.error_message ?? "Crawl was blocked.";
  }
  if (added > 0) {
    return `Completed — ${added} creator${added === 1 ? "" : "s"} added (${live} from live crawl).`;
  }
  return "Crawl completed with no new creators.";
}

export function isTerminalJobStatus(status: DiscoveryJobStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}
