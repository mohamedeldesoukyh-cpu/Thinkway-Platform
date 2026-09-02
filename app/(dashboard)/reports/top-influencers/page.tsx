import { FinanceSuiteShell } from "@/components/finance/suite";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { TopInfluencersView } from "@/features/reports/components/top-influencers-view";
import {
  getTopInfluencersReport,
  parseTopInfluencersSearchParams,
} from "@/lib/analytics/queries/top-influencers-report";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TopInfluencersReportPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = parseTopInfluencersSearchParams(params);
  const report = await getTopInfluencersReport(query);

  return (
    <FinanceSuiteShell
      title="Top influencers"
      description="Rank vendors by spending, revenue, or gross profit for a period."
      backFallbackHref="/reports"
      backLabel="Reports"
    >
      <PlatformErrorBoundary surface="analytics">
        <TopInfluencersView report={report} />
      </PlatformErrorBoundary>
    </FinanceSuiteShell>
  );
}
