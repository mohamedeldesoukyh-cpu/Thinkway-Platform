"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangleIcon,
  BarChart3Icon,
  DatabaseIcon,
  PercentIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react";

import { KpiStrip, type KpiCarouselItem } from "@/components/shared/kpi/kpi-strip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IntelligenceBenchmarksTab } from "@/features/intelligence/components/intelligence-benchmarks-tab";
import { IntelligenceInfluencersTab } from "@/features/intelligence/components/intelligence-influencers-tab";
import { IntelligenceMarginTab } from "@/features/intelligence/components/intelligence-margin-tab";
import { INTELLIGENCE_MARGIN_THRESHOLD } from "@/lib/intelligence/constants";
import type { IntelligenceWorkspacePayload } from "@/types/intelligence";

type Props = {
  data: IntelligenceWorkspacePayload;
};

function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function IntelligenceWorkspace({ data }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = data.tab;

  const kpiItems: KpiCarouselItem[] = [
    {
      id: "revenue",
      label: "Hist. revenue",
      value: formatUsd(data.stats.totalRevenueUsd),
      icon: TrendingUpIcon,
      accentKey: "blue",
    },
    {
      id: "margin",
      label: "Median margin",
      value: data.stats.medianMarginPct != null ? `${data.stats.medianMarginPct.toFixed(1)}%` : "—",
      icon: PercentIcon,
      accentKey: "purple",
      valueSemantic: "margin",
      valueNumeric: data.stats.medianMarginPct ?? undefined,
    },
    {
      id: "vendors",
      label: "Vendors",
      value: String(data.stats.totalInfluencers),
      icon: UsersIcon,
      accentKey: "pink",
    },
    {
      id: "lines",
      label: "Campaign lines",
      value: String(data.stats.totalCampaignLines),
      icon: DatabaseIcon,
      accentKey: "green",
    },
    {
      id: "low-margin",
      label: `< ${INTELLIGENCE_MARGIN_THRESHOLD}% lines`,
      value: String(data.stats.lowMarginLineCount),
      icon: AlertTriangleIcon,
      accentKey: "amber",
      valueAlert: data.stats.lowMarginLineCount > 0 ? "warning" : undefined,
    },
    {
      id: "benchmarks",
      label: "Benchmark slices",
      value: String(data.stats.benchmarkSliceCount),
      icon: BarChart3Icon,
      accentKey: "neutral",
    },
  ];

  const setTab = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`/intelligence?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Historical intelligence (2023–2026). Metrics use{" "}
        <span className="font-medium text-foreground">Rev − Cost</span> — not live billable GP (Rev + UR + AF).
      </p>

      {data.warnings.length > 0 ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          {data.warnings.join(" · ")}
        </div>
      ) : null}

      {!data.stats.dataAvailable ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">No intelligence data loaded yet</p>
          <p className="mt-2">
            Apply migration{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">20260623010000_intelligence_warehouse.sql</code>{" "}
            then run{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">npx tsx scripts/intelligence-etl/run.ts</code>.
            See <code className="rounded bg-muted px-1 py-0.5 text-xs">docs/INTELLIGENCE_ETL.md</code>.
          </p>
        </div>
      ) : null}

      <KpiStrip items={kpiItems} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto w-full justify-start gap-1 rounded-2xl bg-muted/50 p-1">
          <TabsTrigger value="influencers" className="rounded-xl px-4 py-2">
            Influencer Intelligence
          </TabsTrigger>
          <TabsTrigger value="benchmarks" className="rounded-xl px-4 py-2">
            Campaign Benchmarking
          </TabsTrigger>
          <TabsTrigger value="margin" className="rounded-xl px-4 py-2">
            Margin Protection
          </TabsTrigger>
        </TabsList>

        <TabsContent value="influencers" className="mt-4">
          <IntelligenceInfluencersTab rows={data.topInfluencers} />
        </TabsContent>
        <TabsContent value="benchmarks" className="mt-4">
          <IntelligenceBenchmarksTab rows={data.benchmarks} />
        </TabsContent>
        <TabsContent value="margin" className="mt-4">
          <IntelligenceMarginTab rows={data.marginAlerts} />
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground">
        Read-only warehouse · isolated from billing and operational workflows ·{" "}
        <Link href="/reports" className="text-brand-green hover:underline">
          Live reports
        </Link>
      </p>
    </div>
  );
}
