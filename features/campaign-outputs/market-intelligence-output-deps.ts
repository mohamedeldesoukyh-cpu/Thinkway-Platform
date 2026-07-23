/**
 * Outputs whose generated views depend on campaign market intelligence config.
 * SSOT for staleness (via `market_intelligence` input key) and batch regeneration.
 */

import type { CampaignOutputKind } from "./output-types";

/** Campaign outputs that read `meta.mediaPlanSchedule.marketIntelligence` when generating. */
export const MARKET_INTELLIGENCE_DEPENDENT_KINDS = [
  "full_strategy",
  "media_plan",
  "kpi_forecast",
  "content_calendar",
  "posting_timeline",
] as const satisfies readonly CampaignOutputKind[];

export type MarketIntelligenceDependentKind = (typeof MARKET_INTELLIGENCE_DEPENDENT_KINDS)[number];

export function outputDependsOnMarketIntelligence(kind: CampaignOutputKind): boolean {
  return (MARKET_INTELLIGENCE_DEPENDENT_KINDS as readonly CampaignOutputKind[]).includes(kind);
}
