import type { UnifiedCreatorResult } from "@/lib/creators/types";
import type { DataSource } from "@/features/discovery/enrichment/components/data-source-badge";

/** Discovery list source column: Apify acquisition vs file/catalog import. */
export function resolveCreatorDiscoverySource(
  creator: UnifiedCreatorResult,
  options?: { sessionApify?: boolean }
): Extract<DataSource, "apify" | "imported"> {
  if (options?.sessionApify) return "apify";
  if (creator.enrichment_source === "apify") return "apify";
  if (creator.notes?.toLowerCase().includes("apify")) return "apify";
  if (creator.platforms.some((platform) => platform.sync_source === "apify")) return "apify";
  return "imported";
}
