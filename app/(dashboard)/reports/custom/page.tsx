import { FinanceSuiteShell } from "@/components/finance/suite/finance-suite-shell";
import { CustomReportBuilder } from "@/features/reports/components/custom-report-builder";
import { loadOverviewReportInput } from "@/lib/reports/queries/get-overview-report";
import { buildCustomReport, CUSTOM_CURRENCIES, type CustomCurrency } from "@/lib/reports/custom/custom-report";

export default async function CustomReportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const requested = params.currency;
  const currency: CustomCurrency = CUSTOM_CURRENCIES.find(c => c === requested) ?? "EGP";
  const input = await loadOverviewReportInput({ ...params, currency: currency === "Foreign" ? "EGP" : currency });
  const report = buildCustomReport(input, currency);
  return <FinanceSuiteShell title="Custom report" description="Choose your columns, arrange them and preview your report." backFallbackHref="/reports" backLabel="Reports">
    <CustomReportBuilder report={report} />
  </FinanceSuiteShell>;
}
