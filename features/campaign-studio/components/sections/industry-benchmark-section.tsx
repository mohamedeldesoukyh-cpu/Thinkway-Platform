"use client";

import { SectionSkeleton } from "./shared/section-skeleton";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import { BenchCard, BenchGrid } from "./shared/studio-ui-primitives";
import { resolveIndustryBenchmark } from "../../services/section-data-resolver";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CampaignStudioSectionStatus } from "../../types/campaign-studio";

type IndustryBenchmarkSectionProps = {
  campaignObject?: CampaignObject;
  fallbackText: string;
  status: CampaignStudioSectionStatus;
};

export function IndustryBenchmarkSection({
  campaignObject,
  fallbackText,
  status,
}: IndustryBenchmarkSectionProps) {
  if (status === "running" && !campaignObject) {
    return <SectionSkeleton variant="cards" />;
  }

  const benchmark = resolveIndustryBenchmark(campaignObject);
  if (!benchmark) {
    if (shouldShowPendingPlaceholder(status, false)) {
      return <SectionPendingMessage label="Industry benchmarks pending…" />;
    }
    return <SectionFallbackContent text={fallbackText} />;
  }

  const extraRows = [
    { metric: "Est. CPM", expected: benchmark.estCpm, industry: "Mass reach inventory" },
    { metric: "Est. CPC/CPE", expected: benchmark.estCpc, industry: "Category benchmark" },
    { metric: "Est. Reach", expected: benchmark.estReach, industry: "Tier-weighted forecast" },
    {
      metric: "Posting Frequency",
      expected: benchmark.postingFrequency,
      industry: "Activation cadence",
    },
    {
      metric: "Creator Mix",
      expected: benchmark.creatorMixBenchmark,
      industry: "Director tier mix",
    },
    {
      metric: "Budget Efficiency",
      expected: benchmark.budgetEfficiency,
      industry: "Historical patterns",
    },
  ].filter((row) => row.expected?.trim());

  return (
    <div className="min-w-0 space-y-2.5">
      <BenchGrid>
        {benchmark.comparisons.map((row) => (
          <BenchCard
            key={row.metric}
            metric={row.metric}
            source={row.source}
            expected={row.expected}
            industry={row.industry}
          />
        ))}
        {extraRows.map((row) => (
          <BenchCard
            key={row.metric}
            metric={row.metric}
            source="Industry Intelligence"
            expected={row.expected}
            industry={row.industry}
          />
        ))}
      </BenchGrid>
    </div>
  );
}
