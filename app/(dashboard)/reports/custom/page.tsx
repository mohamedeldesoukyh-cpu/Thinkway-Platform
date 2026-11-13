import { FinanceSuiteShell } from "@/components/finance/suite/finance-suite-shell";
import { CustomReportBuilder } from "@/features/reports/components/custom-report-builder";
import { getCustomReport } from "@/lib/reports/queries/get-custom-report";
import { CUSTOM_CURRENCIES, type CustomCurrency } from "@/lib/reports/custom/custom-report";

export default async function CustomReportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const requested = params.currency;
  const currency: CustomCurrency = CUSTOM_CURRENCIES.find(c => c === requested) ?? "EGP";
  const report = await getCustomReport(params, currency);
  return <FinanceSuiteShell hideDefaultActions title="Custom report" description="Choose your columns, arrange them and preview your report." backFallbackHref="/reports" backLabel="Reports">
    <CustomReportBuilder report={report} />
  </FinanceSuiteShell>;
}
